import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useFocusEffect, useRouter } from 'expo-router';
import { ProgressRing } from '../../src/components/ui/ProgressRing';
import { useSession } from '../../src/stores/session';
import { apiGet, apiPost } from '../../src/lib/api';
import { formatLongDate, greet } from '../../src/lib/mock-data';
import { Pedometer } from 'expo-sensors';
import {
  STEPS_PER_ACTIVE_MIN,
  STEPS_PER_KM,
  computeTodayStepsFromCumulative,
  readTodaysActivity,
  stepsToDistanceKm,
  todayLocal,
} from '../../src/lib/pedometer';
import {
  acquireSensorAsync,
  addStepCounterListener,
  startBackgroundTrackingAsync,
} from 'stride-steps';
import { colors } from '../../src/lib/tokens';

type LeaderRow = {
  rank: number;
  userId: string;
  name: string;
  distanceKm: number;
};

type DayStat = {
  date: string;
  distanceKm: number;
  steps: number;
  activeMinutes: number;
};

type HomePayload = {
  today: DayStat;
  week: DayStat[];
  todayIdx: number;
};

// Fixed visual reference. The ring fills from 0 → 20 km; past 20 km the
// overflow arc is drawn in an accent color. The same threshold splits each
// weekly bar into base + overflow segments. Not user-configurable — this is
// purely the chart scale, not a goal the user needs to set.
const KM_BENCHMARK = 20;

// Equivalent benchmarks for the alternative weekly-card units. Derived from
// the same stride-length / pace constants used everywhere else in the app so
// the two-color split lines up across views.
const STEP_BENCHMARK = KM_BENCHMARK * STEPS_PER_KM; // 27,000
const MIN_BENCHMARK = STEP_BENCHMARK / STEPS_PER_ACTIVE_MIN; // 270

type WeekUnit = 'km' | 'steps' | 'min';

const UNIT_LABEL: Record<WeekUnit, string> = {
  km: 'Distance',
  steps: 'Steps',
  min: 'Active',
};

function valueForUnit(d: DayStat, u: WeekUnit): number {
  if (u === 'steps') return d.steps;
  if (u === 'min') return d.activeMinutes;
  return d.distanceKm;
}

function benchmarkForUnit(u: WeekUnit): number {
  if (u === 'steps') return STEP_BENCHMARK;
  if (u === 'min') return MIN_BENCHMARK;
  return KM_BENCHMARK;
}

function formatTotal(n: number, u: WeekUnit): string {
  if (u === 'steps') return `${Math.round(n).toLocaleString()} steps`;
  if (u === 'min') return `${Math.round(n)} min`;
  return `${n.toFixed(1)} km`;
}

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId, circleId, name: sessionName } = useSession();
  const name = sessionName?.trim() || 'friend';

  const [home, setHome] = useState<HomePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[] | null>(null);
  // Live step count from the phone's sensor — overrides the server value
  // when present so the UI ticks per footfall. Distance and active minutes
  // are derived from this; no separate state needed.
  const [liveSteps, setLiveSteps] = useState<number | null>(null);

  const [sensorStatus, setSensorStatus] = useState<string | null>(null);

  const loadHome = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await apiGet<HomePayload>(
        `/api/home?today=${encodeURIComponent(todayLocal())}`,
      );
      setHome(res);
    } catch (e) {
      console.warn('home load failed', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadHome();
  }, [loadHome]);

  // Refetch when the home tab regains focus — covers returning from /log-walk.
  useFocusEffect(
    useCallback(() => {
      loadHome();
    }, [loadHome]),
  );

  // Single Android effect that ties together permission, push-event
  // subscription, foreground service, and AppState seeding.
  //
  // Order matters here. On Android 14+, the FOREGROUND_SERVICE_TYPE_HEALTH
  // service requires ACTIVITY_RECOGNITION to already be granted, otherwise
  // startForeground() throws and the service never holds the sensor alive.
  // On Android 10+, registering a STEP_COUNTER listener before grant means
  // events never fire on many Samsung ROMs (registration is sticky). So we:
  //   1) request permission first;
  //   2) only then attach the JS push listener;
  //   3) only then start the foreground service;
  //   4) seed from the cached cumulative count.
  // We also retry the whole sequence on AppState 'active' so a user who
  // grants permission later (via system Settings) recovers without a
  // restart.
  const homeRef = useRef<HomePayload | null>(null);
  useEffect(() => {
    homeRef.current = home;
  }, [home]);
  const lastUpdateAtRef = useRef(0);
  const lastStepsRef = useRef<number | null>(null);
  const liveStepsRef = useRef<number | null>(null);
  useEffect(() => {
    liveStepsRef.current = liveSteps;
  }, [liveSteps]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let cancelled = false;
    let sub: { remove: () => void } | null = null;
    let started = false;
    let inFlight = false;

    const start = async () => {
      if (inFlight || started || cancelled) return;
      inFlight = true;
      try {
        const perm = await Pedometer.requestPermissionsAsync();
        if (cancelled) return;
        if (!perm.granted) return;

        // Permission is now confirmed — explicitly tell the native side
        // to register the STEP_COUNTER listener (the OnCreate eager
        // acquire is a no-op pre-grant), then attach the JS subscriber
        // and start the foreground service.
        await acquireSensorAsync().catch(() => false);
        sub = addStepCounterListener(async (event) => {
          try {
            const { steps } = await computeTodayStepsFromCumulative(
              event.cumulative,
            );
            if (steps === lastStepsRef.current) return;
            const now = Date.now();
            if (now - lastUpdateAtRef.current < 500) return;
            lastUpdateAtRef.current = now;
            lastStepsRef.current = steps;
            setLiveSteps(steps);
            setSensorStatus(null); // sensor is working, clear any error
          } catch {
            // server post on next tick will catch up
          }
        });

        // Small delay: on some Android 14+ devices, the permission grant
        // isn't fully propagated when requestPermissionsAsync resolves,
        // causing startForeground(FOREGROUND_SERVICE_TYPE_HEALTH) to throw.
        await new Promise((r) => setTimeout(r, 300));

        try {
          await startBackgroundTrackingAsync();
          setSensorStatus(null);
        } catch (e: any) {
          const msg = e?.message ?? String(e);
          console.warn('[stride] foreground service failed:', msg);
          setSensorStatus(
            msg.includes('FOREGROUND_SERVICE')
              ? 'Permission needed: enable Physical Activity in Settings → Apps → Stride'
              : 'Step sensor unavailable. Check phone settings.',
          );
        }

        // Seed the UI from the latest cached cumulative reading so we
        // don't sit on 0 until the user takes their next step.
        const result = await readTodaysActivity();
        if (cancelled || !result.ok) return;
        if (result.steps === lastStepsRef.current) return;
        lastStepsRef.current = result.steps;
        setLiveSteps(result.steps);

        started = true;
      } finally {
        inFlight = false;
      }
    };

    start();
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
    });
    return () => {
      cancelled = true;
      sub?.remove();
      appSub.remove();
    };
  }, []);

  // iOS / web: still seed from expo-sensors (the only path on those
  // platforms today). No push listener and no foreground service —
  // those are Android-specific.
  useEffect(() => {
    if (Platform.OS === 'android') return;
    let cancelled = false;
    let inFlight = false;
    const seed = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await readTodaysActivity();
        if (cancelled || !result.ok) return;
        if (result.steps === lastStepsRef.current) return;
        lastStepsRef.current = result.steps;
        setLiveSteps(result.steps);
      } finally {
        inFlight = false;
      }
    };
    seed();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') seed();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  // ─── Server post logic (refactored so interval + background flush share it) ──
  const lastPostAtRef = useRef(0);
  const lastPostedStepsRef = useRef(0);
  // Mark whether we've already attempted an initial seed-post on this
  // component mount, so re-focus events (useFocusEffect) don't re-post
  // stale cached data if the server already has it.
  const seededRef = useRef(false);

  const postStepsToServer = useCallback(async () => {
    const steps = liveStepsRef.current;
    if (steps == null || steps === 0) return;
    const todayPayload = homeRef.current?.today;
    if (!todayPayload) return;
    const serverSteps = todayPayload.steps ?? 0;
    const now = Date.now();
    const delta = steps - lastPostedStepsRef.current;
    const shouldPost =
      steps > serverSteps &&
      (now - lastPostAtRef.current > 60_000 || delta >= 50);
    if (!shouldPost) return;
    try {
      await apiPost('/api/walks', {
        date: todayLocal(),
        distanceKm: stepsToDistanceKm(steps),
        steps,
        activeMinutes: Math.round(steps / STEPS_PER_ACTIVE_MIN),
      });
      lastPostAtRef.current = now;
      lastPostedStepsRef.current = steps;
      await loadHome();
    } catch {
      // silent — pull-to-refresh will surface real errors
    }
  }, [loadHome]);

  // Seed the server with any cached pedometer data as soon as we mount
  // and have a server baseline loaded. Without this, a user who opens the
  // app after a long walk yesterday would see yesterday's steps only on
  // the UI ring (from AsyncStorage) but never push to the server, so the
  // Steps tab shows yesterday as zero.
  useEffect(() => {
    if (!home || seededRef.current) return;
    if (liveSteps == null || liveSteps === 0) return;
    const todayPayload = home.today;
    if (!todayPayload) return;
    // Only seed the past day's data — today's steps are handled by the
    // interval timer below.
    const serverSteps = todayPayload.steps ?? 0;
    if (liveSteps > serverSteps) {
      seededRef.current = true;
      postStepsToServer();
    }
  }, [home, liveSteps, postStepsToServer]);

  // Server post timer: every 30s, post live step totals to the server if
  // they've grown past the throttle thresholds. Pure ref read — no sensor,
  // no AsyncStorage on this path.
  useEffect(() => {
    const interval = setInterval(postStepsToServer, 30_000);
    return () => clearInterval(interval);
  }, [postStepsToServer]);

  // Server data refresh timer: every 60s, refresh the home payload from the
  // server — regardless of step activity. This catches day-boundary rollovers
  // (new day, fresh week) and server-side edits without requiring the user to
  // pull-to-refresh. Without this, the weekly chart bars and leaderboard stay
  // stale until the user takes a step or manually refreshes.
  useEffect(() => {
    const interval = setInterval(loadHome, 60_000);
    return () => clearInterval(interval);
  }, [loadHome]);

  // Periodic leaderboard refresh — keeps the "vs. your circle" comparison
  // current without relying on the user pulling to refresh.
  useEffect(() => {
    if (!userId || !circleId) return;
    const interval = setInterval(() => {
      apiGet<{ leaderboard: LeaderRow[] }>(
        `/api/circles/${circleId}/leaderboard`,
      )
        .then((r) => setLeaderboard(r.leaderboard))
        .catch(() => {});
    }, 120_000);
    return () => clearInterval(interval);
  }, [userId, circleId]);

  // Flush steps to the server when the app goes to background or the user
  // switches tabs. Without this, closing the app mid-day means the last
  // ~29s of steps are never sent and the Stats tab shows an incomplete day.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        postStepsToServer();
      }
    });
    return () => sub.remove();
  }, [postStepsToServer]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadHome();
      if (userId && circleId) {
        const r = await apiGet<{ leaderboard: LeaderRow[] }>(
          `/api/circles/${circleId}/leaderboard`,
        );
        setLeaderboard(r.leaderboard);
      }
    } catch (e) {
      console.warn('refresh failed', e);
    } finally {
      setRefreshing(false);
    }
  }, [loadHome, userId, circleId]);

  useEffect(() => {
    if (!userId || !circleId) return;
    apiGet<{ leaderboard: LeaderRow[] }>(
      `/api/circles/${circleId}/leaderboard`,
    )
      .then((r) => setLeaderboard(r.leaderboard))
      .catch((e) => console.warn('leaderboard load failed', e));
  }, [userId, circleId]);

  const comparison = useMemo(() => {
    if (!leaderboard || leaderboard.length < 2 || !userId) return null;
    const me = leaderboard.find((r) => r.userId === userId);
    const others = leaderboard.filter((r) => r.userId !== userId);
    if (!me || others.length === 0) return null;
    const avgOthers =
      others.reduce((s, r) => s + r.distanceKm, 0) / others.length;
    if (avgOthers <= 0) return null;
    const diffPct = Math.round(((me.distanceKm - avgOthers) / avgOthers) * 100);
    return { diffPct, rank: me.rank, total: leaderboard.length };
  }, [leaderboard, userId]);

  const today = home?.today;
  const week = home?.week ?? [];
  const todayIdx = home?.todayIdx ?? 0;

  // Selected day — defaults to today, switches when the user taps a bar.
  // Re-pin to today whenever a fresh payload arrives, so a refresh after
  // midnight rolls the selection forward to the new "today".
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  useEffect(() => {
    setSelectedIdx(null);
  }, [home?.todayIdx, home?.week?.[0]?.date]);
  const activeIdx = selectedIdx ?? todayIdx;
  const isToday = activeIdx === todayIdx;
  const selectedDay = week[activeIdx];

  // Ring + side stats reflect step-counter data when viewing today; for any
  // other day they read straight from the server-recorded daily totals so
  // the user can scrub through the week and see each day's numbers.
  //
  const displaySteps = isToday
    ? (liveSteps ?? today?.steps ?? 0)
    : (selectedDay?.steps ?? 0);
  const displayDistanceKm = isToday
    ? stepsToDistanceKm(liveSteps ?? today?.steps ?? 0)
    : (selectedDay?.distanceKm ?? 0);
  const displayActiveMinutes = isToday
    ? Math.round((liveSteps ?? today?.steps ?? 0) / STEPS_PER_ACTIVE_MIN)
    : (selectedDay?.activeMinutes ?? 0);
  const paceKmh =
    displayActiveMinutes > 0
      ? displayDistanceKm / (displayActiveMinutes / 60)
      : 0;
  // Unit picked in the chip-row under the weekly card. Affects bars + total
  // only; ring + side stats are independent.
  const [weekUnit, setWeekUnit] = useState<WeekUnit>('km');
  const weekValues = week.map((w) => valueForUnit(w, weekUnit));
  const weekTotal = weekValues.reduce((s, v) => s + v, 0);
  const noWalksYet = !!home && week.reduce((s, w) => s + w.distanceKm, 0) === 0;
  const benchmark = benchmarkForUnit(weekUnit);
  // Bars scale to the larger of the benchmark or the week's max so a
  // benchmark-busting day still has a sensible bar height.
  const weekMax = Math.max(benchmark, ...weekValues);
  // Ring value is the day's km against the 20km benchmark. The ring itself
  // draws an overflow arc past 100% — no clamping here.
  const ringValue = displayDistanceKm / KM_BENCHMARK;
  const overBenchmarkKm = Math.max(0, displayDistanceKm - KM_BENCHMARK);

  // Week highlights — purely derived facts, no settings. Fills the gap
  // beneath the weekly card without re-introducing goal-shaped UI.
  const dayShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const activeDays = week.filter(
    (w, i) => i <= todayIdx && w.distanceKm > 0,
  ).length;
  const bestIdx = week.reduce(
    (best, w, i) =>
      i <= todayIdx && w.distanceKm > week[best].distanceKm ? i : best,
    0,
  );
  const bestDay = week[bestIdx];
  const hasBest = !!bestDay && bestDay.distanceKm > 0;
  // Current streak: count back from today over consecutive active days.
  let streak = 0;
  for (let i = todayIdx; i >= 0; i--) {
    if (week[i] && week[i].distanceKm > 0) streak++;
    else break;
  }

  return (
    // Plain View so we can apply both top + bottom safe-area insets
    // without nesting SafeAreaView (which would double-apply padding).
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.teal}
            colors={[colors.teal]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.date}>{formatLongDate()}</Text>
          <Text style={styles.greeting}>
            {greet()}, {name}
          </Text>
        </View>

        {loading && !home ? (
          <HomeSkeleton />
        ) : (
          <>
            {sensorStatus && (
              <View style={styles.sensorBanner}>
                <Text style={styles.sensorBannerText}>{sensorStatus}</Text>
              </View>
            )}
            <View style={styles.ringRow}>
              <ProgressRing size={200} stroke={13} value={ringValue}>
                <Text style={styles.ringEyebrow}>
                  {isToday
                    ? 'Today'
                    : new Date(`${selectedDay?.date}T12:00`).toLocaleDateString(
                        undefined,
                        { weekday: 'short', month: 'short', day: 'numeric' },
                      )}
                </Text>
                <View style={styles.ringMetric}>
                  <Text
                    style={styles.ringValue}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {displayDistanceKm.toFixed(1)}
                  </Text>
                  <Text style={styles.ringUnit}>km</Text>
                </View>
                {overBenchmarkKm > 0 && (
                  <Text style={styles.ringOver}>
                    +{overBenchmarkKm.toFixed(1)} km past {KM_BENCHMARK}
                  </Text>
                )}
              </ProgressRing>

<View style={styles.sideStats}>
          <SideStat
            label="Steps"
            value={displaySteps.toLocaleString()}
          />
          <View style={styles.hr} />
          <SideStat
            label="Active"
            value={String(displayActiveMinutes)}
            unit="min"
          />
          <View style={styles.hr} />
          <SideStat
            label="Pace"
            value={paceKmh.toFixed(1)}
            unit="km/h"
          />
        </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>This week</Text>
                <Text style={styles.cardTotal}>
                  {formatTotal(weekTotal, weekUnit)}
                </Text>
              </View>

              <View style={styles.bars}>
                {week.map((w, i) => {
                  const v = weekValues[i];
                  const isTodayBar = i === todayIdx;
                  const isFuture = i > todayIdx;
                  const isSelected = i === activeIdx;
                  const totalH = Math.max(6, (v / weekMax) * 78);
                  // Split the bar at the benchmark — base segment is teal up
                  // to the threshold, accent segment rides on top for any
                  // overage. Threshold scales with the chosen unit.
                  const baseV = Math.min(benchmark, v);
                  const overV = Math.max(0, v - benchmark);
                  const baseH = (baseV / weekMax) * 78;
                  const overH = (overV / weekMax) * 78;
                  const baseColor = isFuture
                    ? '#F0F0EC'
                    : isTodayBar
                      ? colors.teal
                      : '#6EBFA0';
                  return (
                    <Pressable
                      key={i}
                      style={styles.barCol}
                      disabled={isFuture}
                      onPress={() => setSelectedIdx(i)}
                      hitSlop={8}
                    >
                      {v === 0 ? (
                        <View
                          style={{
                            width: '100%',
                            height: totalH,
                            borderRadius: 4,
                            backgroundColor: baseColor,
                          }}
                        />
                      ) : (
                        <View
                          style={{
                            width: '100%',
                            height: totalH,
                            borderRadius: 4,
                            overflow: 'hidden',
                            flexDirection: 'column-reverse',
                          }}
                        >
                          <View
                            style={{
                              height: baseH,
                              backgroundColor: baseColor,
                            }}
                          />
                          {overH > 0 && (
                            <View
                              style={{
                                height: overH,
                                backgroundColor: colors.amber,
                              }}
                            />
                          )}
                        </View>
                      )}
                      {/* Selection indicator — small dot under the bar. */}
                      <View
                        style={{
                          marginTop: 4,
                          width: 4,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: isSelected
                            ? colors.ink
                            : 'transparent',
                        }}
                      />
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.dayLabels}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <Text
                    key={i}
                    style={[
                      styles.dayLabel,
                      i === activeIdx && {
                        color: colors.ink,
                        fontWeight: '500',
                      },
                    ]}
                  >
                    {d}
                  </Text>
                ))}
              </View>

              {/* Unit selector lives inside the card so it reads as part of
                  the same surface — no orphan floating row below. */}
              <View style={styles.unitRow}>
                {(['km', 'steps', 'min'] as const).map((u) => {
                  const active = u === weekUnit;
                  return (
                    <Pressable
                      key={u}
                      onPress={() => setWeekUnit(u)}
                      hitSlop={6}
                      style={[
                        styles.unitChip,
                        active && styles.unitChipActive,
                      ]}
                    >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.unitChipText,
                        active && styles.unitChipTextActive,
                      ]}
                    >
                      {UNIT_LABEL[u]}
                    </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {hasBest ? (
              <View style={styles.highlights}>
                <View style={styles.highlightCell}>
                  <Text style={styles.highlightLabel}>Best day</Text>
                  <Text style={styles.highlightValue}>
                    {bestDay.distanceKm.toFixed(1)}
                    <Text style={styles.highlightUnit}> km</Text>
                  </Text>
                  <Text style={styles.highlightSub}>{dayShort[bestIdx]}</Text>
                </View>
                <View style={styles.highlightDivider} />
                <View style={styles.highlightCell}>
                  <Text style={styles.highlightLabel}>Active days</Text>
                  <Text style={styles.highlightValue}>
                    {activeDays}
                    <Text style={styles.highlightUnit}> / 7</Text>
                  </Text>
                  <Text style={styles.highlightSub}>this week</Text>
                </View>
                <View style={styles.highlightDivider} />
                <View style={styles.highlightCell}>
                  <Text style={styles.highlightLabel}>Streak</Text>
                  <Text style={styles.highlightValue}>
                    {streak}
                    <Text style={styles.highlightUnit}>
                      {streak === 1 ? ' day' : ' days'}
                    </Text>
                  </Text>
                  <Text style={styles.highlightSub}>
                    {streak > 0 ? 'in a row' : 'start today'}
                  </Text>
                </View>
              </View>
            ) : (
              noWalksYet && (
                <View style={styles.emptyNudge}>
                  <Text style={styles.emptyNudgeTitle}>
                    Keep your phone on you
                  </Text>
                  <Text style={styles.emptyNudgeBody}>
                    Steps tracked automatically while you walk. Your circle
                    sees the progress on the leaderboard.
                  </Text>
                </View>
              )
            )}

            {comparison && (
              <Pressable
                style={styles.compare}
                onPress={() => router.push('/(tabs)/circle')}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.compareEyebrow}>vs. your circle</Text>
                  <Text style={styles.compareBody}>
                    {comparison.diffPct >= 0 ? (
                      <>
                        You're{' '}
                        <Text style={{ fontWeight: '500' }}>
                          {comparison.diffPct}% above
                        </Text>{' '}
                        the average · #{comparison.rank} of {comparison.total}
                      </>
                    ) : (
                      <>
                        You're{' '}
                        <Text style={{ fontWeight: '500' }}>
                          {Math.abs(comparison.diffPct)}% below
                        </Text>{' '}
                        the average · #{comparison.rank} of {comparison.total}
                      </>
                    )}
                  </Text>
                </View>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M9 6l6 6-6 6"
                    stroke={colors.teal}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </Pressable>
            )}

            <View style={{ height: 32 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function HomeSkeleton() {
  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
      <View style={styles.skelRingRow}>
        <View style={styles.skelRing} />
        <View style={{ flex: 1, gap: 14 }}>
          <View style={styles.skelLineShort} />
          <View style={styles.skelLineShort} />
          <View style={styles.skelLineShort} />
        </View>
      </View>
      <View style={styles.skelCard}>
        <View style={styles.skelLineTitle} />
        <View style={styles.skelBars}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <View
              key={i}
              style={[
                styles.skelBar,
                { height: 20 + ((i * 13) % 50) },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function SideStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <View>
      <Text style={styles.sideLabel}>{label}</Text>
      <View style={styles.sideValueRow}>
        <Text style={styles.sideValue}>{value}</Text>
        {unit && <Text style={styles.sideUnit}>{unit}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingBottom: 24 },
  header: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 12 },
  date: {
    fontSize: 13,
    color: colors.muted,
    letterSpacing: 0.1,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '500',
    letterSpacing: -0.5,
    color: colors.ink,
  },
  ringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 18,
    gap: 16,
  },
  ringEyebrow: {
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  ringMetric: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  ringValue: {
    fontSize: 44,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -1.5,
    lineHeight: 48,
  },
  ringUnit: { fontSize: 17, color: colors.muted },
  ringGoal: { fontSize: 12, color: colors.faint, marginTop: 6 },
  ringSteps: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  ringOver: {
    fontSize: 12,
    color: colors.amberDeep,
    marginTop: 6,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  sideStats: { flexDirection: 'column', gap: 18, minWidth: 92 },
  hr: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  sideLabel: {
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sideValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  sideValue: {
    fontSize: 22,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -0.6,
  },
  sideUnit: { fontSize: 12, color: colors.muted },
  card: {
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -0.1,
  },
  cardTotal: { fontSize: 12, color: colors.muted },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 88,
    gap: 8,
    marginBottom: 8,
  },
  barCol: { flex: 1, alignItems: 'center', minHeight: 40, justifyContent: 'flex-end' },
  dayLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    letterSpacing: 0.3,
    color: colors.faint,
  },
  compare: {
    marginHorizontal: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: colors.tealSoft,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compareEyebrow: {
    fontSize: 11,
    color: colors.teal,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '500',
    marginBottom: 4,
  },
  compareBody: { fontSize: 15, color: colors.ink, letterSpacing: -0.2 },
  skelRingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 16,
  },
  skelRing: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.card,
  },
  skelLineShort: {
    height: 14,
    borderRadius: 4,
    backgroundColor: colors.card,
    width: '72%',
  },
  skelCard: {
    marginTop: 8,
    padding: 20,
    borderRadius: 12,
    backgroundColor: colors.card,
  },
  skelLineTitle: {
    height: 14,
    width: 100,
    borderRadius: 4,
    backgroundColor: colors.lineSoft,
    marginBottom: 18,
  },
  skelBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 80,
    gap: 8,
  },
  skelBar: {
    flex: 1,
    borderRadius: 4,
    backgroundColor: colors.lineSoft,
  },
  unitRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  unitChip: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  unitChipActive: {
    backgroundColor: colors.tealSoft,
  },
  unitChipText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  unitChipTextActive: { color: colors.teal },
  highlights: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    alignItems: 'stretch',
  },
  highlightCell: {
    flex: 1,
    alignItems: 'flex-start',
    paddingHorizontal: 8,
  },
  highlightDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
  },
  highlightLabel: {
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '500',
    marginBottom: 4,
  },
  highlightValue: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  highlightUnit: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.muted,
    letterSpacing: 0,
  },
  highlightSub: {
    fontSize: 11,
    color: colors.faint,
    marginTop: 2,
  },
  emptyNudge: {
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 18,
    borderRadius: 12,
    backgroundColor: colors.tealSoft,
    borderWidth: 1,
    borderColor: '#CFE9DD',
  },
  emptyNudgeTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.teal,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  emptyNudgeBody: {
    fontSize: 13,
    color: colors.ink,
    lineHeight: 18,
  },
  sensorBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FFCC80',
  },
  sensorBannerText: {
    fontSize: 13,
    color: '#E65100',
    lineHeight: 18,
    fontWeight: '500',
  },
});
