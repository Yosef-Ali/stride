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
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useFocusEffect, useRouter } from 'expo-router';
import { ProgressRing } from '../../src/components/ui/ProgressRing';
import { useSession } from '../../src/stores/session';
import { apiGet, apiPost } from '../../src/lib/api';
import { formatLongDate, greet } from '../../src/lib/mock-data';
import { tapMedium } from '../../src/lib/haptics';
import {
  STEPS_PER_ACTIVE_MIN,
  computeTodayStepsFromCumulative,
  readTodaysActivity,
  stepsToDistanceKm,
  todayLocal,
} from '../../src/lib/pedometer';
import { addStepCounterListener } from 'stride-steps';
import { colors } from '../../src/lib/tokens';

type LeaderRow = {
  rank: number;
  userId: string;
  name: string;
  distanceKm: number;
};

type HomePayload = {
  today: {
    date: string;
    distanceKm: number;
    steps: number;
    activeMinutes: number;
  };
  week: { date: string; distanceKm: number }[];
  todayIdx: number;
};

const DAILY_GOAL_KM = 8;

export default function Home() {
  const router = useRouter();
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

  const loadHome = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await apiGet<HomePayload>('/api/home');
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

  // STEP_COUNTER push events. Samsung delivers them at SENSOR_DELAY_FASTEST,
  // which on some devices is 5-10 events/sec while walking. Pushing every
  // event into setState re-renders the SVG ring at sensor cadence and reads
  // as visible flicker on slower phones — so we coalesce: skip identical
  // values, and rate-limit to ~2 visual updates/sec.
  const homeRef = useRef<HomePayload | null>(null);
  useEffect(() => {
    homeRef.current = home;
  }, [home]);
  const lastUpdateAtRef = useRef(0);
  const lastStepsRef = useRef<number | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = addStepCounterListener(async (event) => {
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
      } catch {
        // server post on next tick will catch up
      }
    });
    return () => sub.remove();
  }, []);

  // Initial seed on mount + on AppState 'active'. Push events take over from
  // there; we don't need to re-poll the sensor on a timer. Guard against
  // concurrent seed() calls — the permission prompt itself fires AppState
  // 'active' on dismissal, which would otherwise stack a second seed on top
  // of the first one mid-await.
  const liveStepsRef = useRef<number | null>(null);
  useEffect(() => {
    liveStepsRef.current = liveSteps;
  }, [liveSteps]);
  useEffect(() => {
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

  // Server post timer: every 30s, post live step totals to the server if
  // they've grown past the throttle thresholds. Pure ref read — no sensor,
  // no AsyncStorage on this path.
  useEffect(() => {
    const lastPostAt = { current: 0 };
    const lastPostedSteps = { current: 0 };
    const post = async () => {
      const steps = liveStepsRef.current;
      if (steps == null || steps === 0) return;
      const serverSteps = homeRef.current?.today?.steps ?? 0;
      const now = Date.now();
      const delta = steps - lastPostedSteps.current;
      const shouldPost =
        steps > serverSteps &&
        (now - lastPostAt.current > 60_000 || delta >= 50);
      if (!shouldPost) return;
      try {
        await apiPost('/api/walks', {
          date: todayLocal(),
          distanceKm: stepsToDistanceKm(steps),
          steps,
          activeMinutes: Math.round(steps / STEPS_PER_ACTIVE_MIN),
        });
        lastPostAt.current = now;
        lastPostedSteps.current = steps;
        await loadHome();
      } catch {
        // silent — pull-to-refresh will surface real errors
      }
    };
    const interval = setInterval(post, 30_000);
    return () => clearInterval(interval);
  }, [loadHome]);

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
  // Ring + side stats reflect step-counter data only — never logged walks.
  // Logged walks roll up into the weekly bar chart and stats, but the ring
  // stays a pure pedometer view. Sensor reading takes priority; server's
  // recorded step count is the fallback before the first sensor event.
  const displaySteps = liveSteps ?? today?.steps ?? 0;
  const displayDistanceKm = stepsToDistanceKm(displaySteps);
  const displayActiveMinutes = Math.round(displaySteps / STEPS_PER_ACTIVE_MIN);
  const paceKmh =
    displayActiveMinutes > 0
      ? displayDistanceKm / (displayActiveMinutes / 60)
      : 0;
  const weekTotal = week.reduce((s, w) => s + w.distanceKm, 0);
  const noWalksYet = !!home && weekTotal === 0;
  const weekMax = Math.max(1, ...week.map((w) => w.distanceKm));
  const ringValue = Math.min(1, displayDistanceKm / DAILY_GOAL_KM);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
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
            <View style={styles.ringRow}>
              <ProgressRing size={200} stroke={13} value={ringValue}>
                <Text style={styles.ringEyebrow}>Today</Text>
                <View style={styles.ringMetric}>
                  <Text style={styles.ringValue}>
                    {displayDistanceKm.toFixed(1)}
                  </Text>
                  <Text style={styles.ringUnit}>km</Text>
                </View>
                <Text style={styles.ringGoal}>of {DAILY_GOAL_KM} km goal</Text>
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
                <Text style={styles.cardTotal}>{weekTotal.toFixed(1)} km</Text>
              </View>

              <View style={styles.bars}>
                {week.map((w, i) => {
                  const isToday = i === todayIdx;
                  const isFuture = i > todayIdx;
                  const h = Math.max(6, (w.distanceKm / weekMax) * 78);
                  const bg = isFuture
                    ? '#F0F0EC'
                    : isToday
                      ? colors.teal
                      : '#6EBFA0';
                  return (
                    <Pressable
                      key={i}
                      style={styles.barCol}
                      disabled={isFuture}
                      onPress={() => router.push('/(tabs)/stats')}
                      hitSlop={8}
                    >
                      <View
                        style={{
                          width: '100%',
                          height: h,
                          borderRadius: 4,
                          backgroundColor: bg,
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
                      i === todayIdx && {
                        color: colors.ink,
                        fontWeight: '500',
                      },
                    ]}
                  >
                    {d}
                  </Text>
                ))}
              </View>
            </View>

            {noWalksYet && (
              <View style={styles.emptyNudge}>
                <Text style={styles.emptyNudgeTitle}>
                  Log your first walk
                </Text>
                <Text style={styles.emptyNudgeBody}>
                  Tap the green button to add how far you walked. Your circle
                  will see the progress on the leaderboard.
                </Text>
              </View>
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

            <View style={{ height: 90 }} />
          </>
        )}
      </ScrollView>

      {/* Floating action: Log walk only — step sync runs automatically. */}
      <View style={styles.fabRow}>
        <Pressable
          style={styles.fab}
          onPress={() => {
            tapMedium();
            router.push('/log-walk');
          }}
        >
          <Text style={styles.fabPlus}>＋</Text>
          <Text style={styles.fabLabel}>Log walk</Text>
        </Pressable>
      </View>

    </SafeAreaView>
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
  header: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 20 },
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
    paddingTop: 8,
    paddingBottom: 24,
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
    fontSize: 52,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -2,
    lineHeight: 56,
  },
  ringUnit: { fontSize: 17, color: colors.muted },
  ringGoal: { fontSize: 12, color: colors.faint, marginTop: 6 },
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
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 18,
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
  barCol: { flex: 1, alignItems: 'center' },
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
  fabRow: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: colors.teal,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabPlus: { color: '#fff', fontSize: 22, fontWeight: '500', lineHeight: 24 },
  fabLabel: { color: '#fff', fontSize: 15, fontWeight: '500' },
  syncFab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  syncIcon: { color: colors.teal, fontSize: 18, fontWeight: '600' },
  syncLabel: { color: colors.ink, fontSize: 14, fontWeight: '500' },
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
});
