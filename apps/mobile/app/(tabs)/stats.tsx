import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { apiGet } from '../../src/lib/api';
import { useSession } from '../../src/stores/session';
import { colors } from '../../src/lib/tokens';

type Range = '7d' | '30d' | '90d';
type Stats = {
  range: Range;
  from: string;
  to: string;
  totalKm: number;
  totalSteps: number;
  totalActiveMin: number;
  activeDays: number;
  avgKmPerDay: number;
  avgPaceKmh: number;
  deltaPct: number | null;
  dailySeries: { date: string; distanceKm: number }[];
  bestDay: { date: string; distanceKm: number } | null;
  bestWeek: { startDate: string; distanceKm: number } | null;
};

const RANGES: { key: Range; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
];

function fmtDate(iso: string, short = false): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: short ? 'short' : 'long',
    day: 'numeric',
  });
}

export default function StatsTab() {
  const { userId } = useSession();
  const [range, setRange] = useState<Range>('7d');
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const s = await apiGet<Stats>(`/api/stats?range=${range}`);
      setStats(s);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, [userId, range]);

  useEffect(() => {
    load();
  }, [load]);

  const delta = stats?.deltaPct;
  const deltaPositive = delta !== null && delta !== undefined && delta >= 0;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>your stats</Text>
          <Text style={styles.title}>Progress</Text>
        </View>

        {/* Range toggle */}
        <View style={styles.pill}>
          {RANGES.map((r) => {
            const active = r.key === range;
            return (
              <Pressable
                key={r.key}
                onPress={() => setRange(r.key)}
                style={[styles.pillBtn, active && styles.pillBtnActive]}
              >
                <Text
                  style={[styles.pillLabel, active && styles.pillLabelActive]}
                >
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {loading && !stats && (
          <View style={{ paddingTop: 40, alignItems: 'center' }}>
            <ActivityIndicator color={colors.teal} />
          </View>
        )}

        {stats && (
          <>
            {/* Headline */}
            <View style={styles.headline}>
              <View style={styles.headlineRow}>
                <Text style={styles.headlineValue}>
                  {stats.totalKm.toFixed(1)}
                </Text>
                <Text style={styles.headlineUnit}>km</Text>
              </View>
              <View style={styles.headlineMeta}>
                <Text style={styles.headlineLabel}>
                  {fmtDate(stats.from, true)} – {fmtDate(stats.to, true)}
                </Text>
                {delta !== null && delta !== undefined && (
                  <View
                    style={[
                      styles.deltaPill,
                      {
                        backgroundColor: deltaPositive
                          ? colors.tealSoft
                          : colors.lineSoft,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.deltaLabel,
                        {
                          color: deltaPositive ? colors.teal : colors.muted,
                        },
                      ]}
                    >
                      {deltaPositive ? '▲' : '▼'} {Math.abs(delta)}% vs prev
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Sparkline */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Daily distance</Text>
                <Text style={styles.cardSub}>
                  avg {stats.avgKmPerDay.toFixed(1)} km/day
                </Text>
              </View>
              <Sparkline series={stats.dailySeries} range={range} />
            </View>

            {/* Stat cards row */}
            <View style={styles.statRow}>
              <StatCard
                label="Active days"
                value={`${stats.activeDays}`}
                sub={`of ${stats.dailySeries.length}`}
              />
              <StatCard
                label="Avg pace"
                value={stats.avgPaceKmh.toFixed(1)}
                sub="km/h"
              />
              <StatCard
                label="Steps"
                value={
                  stats.totalSteps >= 10000
                    ? `${(stats.totalSteps / 1000).toFixed(0)}k`
                    : stats.totalSteps.toLocaleString()
                }
              />
            </View>

            {/* Personal records */}
            <View style={styles.prHeader}>
              <Text style={styles.sectionTitle}>Personal records</Text>
              <Text style={styles.sectionSub}>within range</Text>
            </View>

            <View style={styles.card}>
              {stats.bestDay && (
                <View style={[styles.prRow, styles.rowDivider]}>
                  <View style={styles.prIcon}>
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M12 2l2.3 6.9h7.2l-5.8 4.2 2.2 6.9L12 15.8l-5.9 4.2 2.2-6.9L2.5 8.9h7.2L12 2z"
                        fill={colors.amber}
                      />
                    </Svg>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prLabel}>Best day</Text>
                    <Text style={styles.prSub}>
                      {fmtDate(stats.bestDay.date)}
                    </Text>
                  </View>
                  <Text style={styles.prValue}>
                    {stats.bestDay.distanceKm.toFixed(1)} km
                  </Text>
                </View>
              )}
              {stats.bestWeek && (
                <View style={styles.prRow}>
                  <View style={styles.prIcon}>
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M7 11V7a5 5 0 0 1 10 0v4"
                        stroke={colors.teal}
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                      <Rect
                        x={5}
                        y={11}
                        width={14}
                        height={10}
                        rx={2}
                        fill={colors.tealSoft}
                        stroke={colors.teal}
                        strokeWidth={2}
                      />
                    </Svg>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prLabel}>Best week</Text>
                    <Text style={styles.prSub}>
                      from {fmtDate(stats.bestWeek.startDate)}
                    </Text>
                  </View>
                  <Text style={styles.prValue}>
                    {stats.bestWeek.distanceKm.toFixed(1)} km
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        {sub && <Text style={styles.statSub}>{sub}</Text>}
      </View>
    </View>
  );
}

function Sparkline({
  series,
  range,
}: {
  series: { date: string; distanceKm: number }[];
  range: Range;
}) {
  const W = 300;
  const H = 88;
  const max = Math.max(...series.map((d) => d.distanceKm), 1);

  if (range === '7d') {
    // Show bars for 7-day view
    const gap = 8;
    const barWidth = (W - gap * (series.length - 1)) / series.length;
    return (
      <View style={styles.spark}>
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
          {series.map((d, i) => {
            const h = Math.max(3, (d.distanceKm / max) * (H - 10));
            const x = i * (barWidth + gap);
            const y = H - h;
            return (
              <Rect
                key={i}
                x={x}
                y={y}
                width={barWidth}
                height={h}
                rx={3}
                fill={colors.teal}
                opacity={d.distanceKm > 0 ? 1 : 0.15}
              />
            );
          })}
        </Svg>
        <View style={styles.axis}>
          {series.map((d, i) => {
            const label = new Date(d.date)
              .toLocaleDateString('en-US', { weekday: 'short' })[0];
            return (
              <Text key={i} style={styles.axisLabel}>
                {label}
              </Text>
            );
          })}
        </View>
      </View>
    );
  }

  // Area line for 30d / 90d
  const step = W / (series.length - 1 || 1);
  const points = series.map((d, i) => {
    const x = i * step;
    const y = H - 6 - (d.distanceKm / max) * (H - 12);
    return { x, y };
  });
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${W} ${H} L 0 ${H} Z`;

  return (
    <View style={styles.spark}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Path d={areaPath} fill={colors.tealSoft} />
        <Path
          d={linePath}
          stroke={colors.teal}
          strokeWidth={2}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.axis}>
        <Text style={styles.axisLabel}>{fmtDate(series[0]!.date, true)}</Text>
        <Text style={styles.axisLabel}>
          {fmtDate(series[series.length - 1]!.date, true)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingBottom: 24 },
  header: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 16 },
  eyebrow: {
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '500',
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '500',
    letterSpacing: -0.5,
    color: colors.ink,
  },
  pill: {
    marginHorizontal: 20,
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 4,
    marginBottom: 18,
  },
  pillBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  pillBtnActive: { backgroundColor: colors.teal },
  pillLabel: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  pillLabelActive: { color: '#fff' },
  errorBox: {
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FDECEB',
  },
  errorText: { color: colors.danger, fontSize: 13 },
  headline: {
    paddingHorizontal: 24,
    paddingTop: 6,
    paddingBottom: 18,
  },
  headlineRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  headlineValue: {
    fontSize: 52,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -2,
    lineHeight: 56,
    fontVariant: ['tabular-nums'],
  },
  headlineUnit: { fontSize: 17, color: colors.muted, marginLeft: 4 },
  headlineMeta: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headlineLabel: { fontSize: 12, color: colors.muted },
  deltaPill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  deltaLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  card: {
    marginHorizontal: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -0.1,
  },
  cardSub: { fontSize: 12, color: colors.muted },
  spark: { gap: 8 },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  axisLabel: { fontSize: 10, color: colors.faint, letterSpacing: 0.4 },
  statRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  statLabel: {
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontWeight: '500',
    marginBottom: 6,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  statValue: {
    fontSize: 22,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  statSub: { fontSize: 11, color: colors.muted },
  prHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 24,
    marginTop: 4,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -0.1,
  },
  sectionSub: { fontSize: 12, color: colors.muted },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  prIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prLabel: {
    fontSize: 14,
    color: colors.ink,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  prSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  prValue: {
    fontSize: 15,
    color: colors.ink,
    fontWeight: '500',
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
});
