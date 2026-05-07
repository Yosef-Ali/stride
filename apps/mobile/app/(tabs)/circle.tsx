import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { success, tapLight } from '../../src/lib/haptics';
import Svg, { Path } from 'react-native-svg';
import { apiGet } from '../../src/lib/api';
import { useSession } from '../../src/stores/session';
import { colors } from '../../src/lib/tokens';

type Circle = {
  id: string;
  name: string;
  inviteCode: string;
  createdBy: string;
};
type Member = {
  userId: string;
  name: string;
  avatarColor: string;
  joinedAt: string;
};
type LeaderRow = {
  rank: number;
  userId: string;
  name: string;
  avatarColor: string;
  distanceKm: number;
  activeMinutes: number;
};
type Winner = {
  id: string;
  userId: string;
  name: string;
  avatarColor: string;
  weekNumber: number;
  year: number;
  distanceKm: string;
  awardedAt: string;
};

function StarBadge({ size = 12 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2.5L14.85 8.55L21.5 9.1L16.45 13.55L17.95 20.05L12 16.7L6.05 20.05L7.55 13.55L2.5 9.1L9.15 8.55Z"
        fill={colors.amber}
      />
    </Svg>
  );
}

export default function CircleTab() {
  const router = useRouter();
  const { userId, circleId, setActiveCircle } = useSession();
  const [circles, setCircles] = useState<Circle[] | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[] | null>(null);
  const [winners, setWinners] = useState<Winner[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { circles } = await apiGet<{ circles: Circle[] }>(
        '/api/circles/mine',
      );
      setCircles(circles);
      const active = circles.find((c) => c.id === circleId) ?? circles[0];
      if (active) {
        if (active.id !== circleId) {
          setActiveCircle({
            circleId: active.id,
            circleName: active.name,
            inviteCode: active.inviteCode,
          });
        }
        try {
          const membersRes = await apiGet<{ members: Member[] }>(
            `/api/circles/${active.id}/members`,
          );
          setMembers(membersRes.members);
        } catch (e: any) {
          throw new Error(`members: ${e?.message ?? e}`);
        }
        try {
          const lbRes = await apiGet<{ leaderboard: LeaderRow[] }>(
            `/api/circles/${active.id}/leaderboard`,
          );
          setLeaderboard(lbRes.leaderboard);
        } catch (e: any) {
          // leaderboard is non-critical; show members even if it fails
          console.warn('leaderboard failed', e?.message ?? e);
          setLeaderboard([]);
        }
        try {
          const wRes = await apiGet<{ winners: Winner[] }>(
            `/api/circles/${active.id}/winners`,
          );
          setWinners(wRes.winners);
        } catch (e: any) {
          console.warn('winners failed', e?.message ?? e);
          setWinners([]);
        }
      } else {
        setMembers(null);
        setLeaderboard(null);
        setWinners(null);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load circle');
    } finally {
      setLoading(false);
    }
  }, [userId, circleId, setActiveCircle]);

  useEffect(() => {
    load();
  }, [load]);

  const active = circles?.find((c) => c.id === circleId) ?? circles?.[0];
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    if (!active) return;
    await Clipboard.setStringAsync(active.inviteCode);
    success();
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }, [active]);

  const onShare = useCallback(async () => {
    if (!active) return;
    tapLight();
    const message = `Join my Stride walking circle "${active.name}" — use invite code ${active.inviteCode} in the app.`;
    try {
      await Share.share({ message });
    } catch (e) {
      console.warn('share failed', e);
    }
  }, [active]);

  const me = useMemo(
    () => leaderboard?.find((r) => r.userId === userId) ?? null,
    [leaderboard, userId],
  );

  const yourWeekCopy = useMemo(() => {
    if (!leaderboard || leaderboard.length === 0 || !me) return null;
    const leader = leaderboard[0]!;
    const second = leaderboard[1];
    if (me.userId === leader.userId) {
      if (!second || second.distanceKm <= 0) return 'Out front — keep it up';
      const ahead = me.distanceKm - second.distanceKm;
      return ahead < 0.05
        ? 'Neck and neck with #2'
        : `${ahead.toFixed(1)} km ahead of #2`;
    }
    const gap = leader.distanceKm - me.distanceKm;
    return gap < 0.05
      ? 'Within reach of first'
      : `${gap.toFixed(1)} km behind first`;
  }, [leaderboard, me]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await load();
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={colors.teal}
            colors={[colors.teal]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>your circle</Text>
          <Text style={styles.title}>
            {active?.name ?? (loading ? 'Loading…' : 'No circle yet')}
          </Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {loading && !circles && (
          <View style={{ paddingTop: 40, alignItems: 'center' }}>
            <ActivityIndicator color={colors.teal} />
          </View>
        )}

        {!loading && circles && circles.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>You're walking solo</Text>
            <Text style={styles.emptySub}>
              Create a circle or join one with an invite code.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <Pressable
                style={styles.emptyCta}
                onPress={() => router.push('/(onboarding)/create')}
              >
                <Text style={styles.emptyCtaLabel}>Create</Text>
              </Pressable>
              <Pressable
                style={[styles.emptyCta, styles.emptyCtaGhost]}
                onPress={() => router.push('/(onboarding)/join')}
              >
                <Text style={[styles.emptyCtaLabel, { color: colors.ink }]}>
                  Join
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {active && members && (
          <>
            {/* Your week — personal hero */}
            {me && yourWeekCopy && leaderboard && (
              <View style={styles.heroCard}>
                <Text style={styles.heroEyebrow}>your week</Text>
                <View style={styles.heroRow}>
                  <View style={styles.heroRankCol}>
                    <Text style={styles.heroRank}>#{me.rank}</Text>
                    <Text style={styles.heroRankSub}>
                      of {leaderboard.length}
                    </Text>
                  </View>
                  <View style={styles.heroSep} />
                  <View style={styles.heroKmCol}>
                    <View
                      style={{ flexDirection: 'row', alignItems: 'baseline' }}
                    >
                      <Text style={styles.heroKm}>
                        {me.distanceKm.toFixed(1)}
                      </Text>
                      <Text style={styles.heroUnit}> km</Text>
                    </View>
                    <Text style={styles.heroGap}>{yourWeekCopy}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Top 3 podium */}
            {leaderboard && leaderboard.length >= 3 && (
              <View style={styles.podiumCard}>
                <View style={styles.podiumRow}>
                  {([1, 0, 2] as const).map((idx) => {
                    const r = leaderboard[idx]!;
                    const heights = { 0: 96, 1: 68, 2: 50 } as const;
                    const h = heights[idx];
                    const isYou = r.userId === userId;
                    const fill =
                      idx === 0
                        ? colors.teal
                        : idx === 1
                          ? '#7BC0A4'
                          : '#A8D4BF';
                    return (
                      <View key={r.userId} style={styles.podiumCol}>
                        <View style={styles.podiumTop}>
                          {idx === 0 && (
                            <View style={styles.podiumStar}>
                              <StarBadge size={12} />
                            </View>
                          )}
                          <View
                            style={[
                              styles.podiumAvatar,
                              { backgroundColor: r.avatarColor },
                              idx === 0 && styles.podiumAvatarFirst,
                            ]}
                          >
                            <Text style={styles.podiumAvatarLetter}>
                              {r.name[0]?.toUpperCase() ?? '?'}
                            </Text>
                          </View>
                        </View>
                        <Text
                          style={[
                            styles.podiumName,
                            isYou && {
                              color: colors.teal,
                              fontWeight: '500',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {isYou ? 'You' : r.name.split(' ')[0]}
                        </Text>
                        <Text style={styles.podiumKm}>
                          {r.distanceKm.toFixed(1)} km
                        </Text>
                        <View
                          style={[
                            styles.podiumBar,
                            { height: h, backgroundColor: fill },
                          ]}
                        >
                          <Text style={styles.podiumRankNum}>{idx + 1}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {leaderboard && leaderboard.length > 0 && (
              <>
                <View style={styles.membersHeader}>
                  <Text style={styles.sectionTitle}>This week</Text>
                  <Text style={styles.sectionCount}>Mon – Sun</Text>
                </View>
                <View style={styles.card}>
                  {leaderboard.map((r, i) => {
                    const leaderKm = leaderboard[0]!.distanceKm || 1;
                    const pct = Math.max(
                      0.04,
                      Math.min(1, r.distanceKm / leaderKm),
                    );
                    const isYou = r.userId === userId;
                    return (
                      <View
                        key={r.userId}
                        style={[
                          styles.lbRow,
                          isYou && styles.lbRowYou,
                          i < leaderboard.length - 1 && styles.rowDivider,
                        ]}
                      >
                        <Text
                          style={[
                            styles.lbRank,
                            i === 0 && {
                              color: colors.teal,
                              fontWeight: '500',
                            },
                          ]}
                        >
                          {r.rank}
                        </Text>
                        <View
                          style={[
                            styles.lbAvatar,
                            { backgroundColor: r.avatarColor },
                          ]}
                        >
                          <Text style={styles.avatarLetter}>
                            {r.name[0]?.toUpperCase() ?? '?'}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.lbNameRow}>
                            <Text
                              style={[
                                styles.rowName,
                                isYou && { fontWeight: '500' },
                              ]}
                            >
                              {isYou ? `${r.name} (you)` : r.name}
                            </Text>
                            <Text style={styles.lbKm}>
                              {r.distanceKm.toFixed(1)} km
                            </Text>
                          </View>
                          <View style={styles.lbBarTrack}>
                            <View
                              style={[
                                styles.lbBarFill,
                                {
                                  width: `${pct * 100}%`,
                                  backgroundColor: isYou
                                    ? colors.teal
                                    : '#6EBFA0',
                                },
                              ]}
                            />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {winners && winners.length > 0 && (
              <Pressable
                style={styles.championCard}
                onPress={() => {
                  const w = winners[0]!;
                  const me = leaderboard?.find((r) => r.userId === userId);
                  router.push({
                    pathname: '/winner',
                    params: {
                      week: String(w.weekNumber),
                      year: String(w.year),
                      winnerUserId: w.userId,
                      winnerName: w.name,
                      winnerInitials: (w.name[0] ?? '?').toUpperCase(),
                      winnerColor: w.avatarColor,
                      distanceKm: String(w.distanceKm),
                      viewerKm: me ? String(me.distanceKm) : '0',
                      viewerRank: me ? String(me.rank) : '0',
                    },
                  });
                }}
              >
                <View style={styles.championHeader}>
                  <Text style={styles.championEyebrow}>
                    Last week's champion
                  </Text>
                  <Text style={styles.championWeek}>
                    Week {winners[0]!.weekNumber} · {winners[0]!.year}
                  </Text>
                </View>
                <View style={styles.championBody}>
                  <View
                    style={[
                      styles.championAvatar,
                      { backgroundColor: winners[0]!.avatarColor },
                    ]}
                  >
                    <Text style={styles.championAvatarLetter}>
                      {winners[0]!.name[0]?.toUpperCase() ?? '?'}
                    </Text>
                    <View style={styles.championBadge}>
                      <StarBadge size={12} />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.championName}>
                      {winners[0]!.userId === userId
                        ? `${winners[0]!.name} (you)`
                        : winners[0]!.name}
                    </Text>
                    <Text style={styles.championKm}>
                      {Number(winners[0]!.distanceKm).toFixed(1)} km walked
                    </Text>
                  </View>
                  <Svg width={8} height={14} viewBox="0 0 8 14" fill="none">
                    <Path
                      d="M1 1l6 6-6 6"
                      stroke={colors.amberDeep}
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </Svg>
                </View>
              </Pressable>
            )}

            <View style={styles.membersHeader}>
              <Text style={styles.sectionTitle}>Members</Text>
              <Text style={styles.sectionCount}>{members.length} / 10</Text>
            </View>

            <View style={styles.card}>
              {members.map((m, i) => (
                <View
                  key={m.userId}
                  style={[
                    styles.row,
                    i < members.length - 1 && styles.rowDivider,
                  ]}
                >
                  <View
                    style={[styles.avatar, { backgroundColor: m.avatarColor }]}
                  >
                    <Text style={styles.avatarLetter}>
                      {m.name[0]?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>
                      {m.userId === userId ? `${m.name} (you)` : m.name}
                    </Text>
                    <Text style={styles.rowMeta}>
                      Joined{' '}
                      {new Date(m.joinedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                  {m.userId === active.createdBy && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeLabel}>Owner</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>

            {/* Invite — combined Copy + Share */}
            <View style={styles.inviteCard}>
              <Text style={styles.inviteEyebrow}>invite</Text>
              <Text style={styles.inviteHeading}>
                Add friends to {active.name}
              </Text>
              <View style={styles.inviteCodeChip}>
                <Text style={styles.inviteCodeBig}>{active.inviteCode}</Text>
              </View>
              <View style={styles.inviteActions}>
                <Pressable
                  style={[styles.inviteAction, styles.inviteActionGhost]}
                  onPress={onCopy}
                >
                  <Text
                    style={[styles.inviteActionLabel, { color: colors.teal }]}
                  >
                    {copied ? 'Copied' : 'Copy code'}
                  </Text>
                </Pressable>
                <Pressable style={styles.inviteAction} onPress={onShare}>
                  <Text style={[styles.inviteActionLabel, { color: '#fff' }]}>
                    Share
                  </Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingBottom: 24 },
  header: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 20 },
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
  errorBox: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FDECEB',
  },
  errorText: { color: colors.danger, fontSize: 13 },
  empty: {
    marginHorizontal: 20,
    marginTop: 24,
    padding: 24,
    borderRadius: 12,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  emptyCta: {
    flex: 1,
    backgroundColor: colors.teal,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyCtaGhost: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  emptyCtaLabel: { color: '#fff', fontSize: 14, fontWeight: '500' },

  // Hero "Your week"
  heroCard: {
    marginHorizontal: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: colors.tealSoft,
    marginBottom: 14,
  },
  heroEyebrow: {
    fontSize: 10,
    color: colors.tealDeep,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '500',
    marginBottom: 10,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroRankCol: {
    minWidth: 64,
  },
  heroRank: {
    fontSize: 38,
    fontWeight: '500',
    color: colors.tealDeep,
    letterSpacing: -1.6,
    fontVariant: ['tabular-nums'],
    lineHeight: 40,
  },
  heroRankSub: {
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 0.4,
    marginTop: 2,
  },
  heroSep: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: '#C7E0D6',
    marginHorizontal: 16,
  },
  heroKmCol: { flex: 1 },
  heroKm: {
    fontSize: 38,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -1.6,
    fontVariant: ['tabular-nums'],
    lineHeight: 40,
  },
  heroUnit: {
    fontSize: 16,
    color: colors.muted,
    letterSpacing: -0.2,
  },
  heroGap: {
    fontSize: 13,
    color: colors.tealDeep,
    marginTop: 4,
    letterSpacing: -0.1,
  },

  // Podium
  podiumCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 12,
    borderRadius: 14,
    backgroundColor: colors.card,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 14,
  },
  podiumCol: { flex: 1, alignItems: 'center' },
  podiumTop: {
    position: 'relative',
    marginBottom: 6,
  },
  podiumAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumAvatarFirst: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: colors.amber,
  },
  podiumAvatarLetter: { color: '#fff', fontSize: 14, fontWeight: '500' },
  podiumStar: {
    position: 'absolute',
    top: -8,
    right: -6,
    zIndex: 1,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#F3D9A8',
  },
  podiumName: {
    fontSize: 12,
    color: colors.ink,
    letterSpacing: -0.1,
    marginTop: 4,
    maxWidth: 80,
  },
  podiumKm: {
    fontSize: 11,
    color: colors.muted,
    fontVariant: ['tabular-nums'],
    marginTop: 1,
    marginBottom: 8,
  },
  podiumBar: {
    width: '100%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumRankNum: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: -0.5,
  },

  // Section headers + shared cards
  membersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 24,
    marginTop: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -0.1,
  },
  sectionCount: { fontSize: 12, color: colors.muted },
  card: {
    marginHorizontal: 20,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: '#fff', fontSize: 15, fontWeight: '500' },
  rowName: { fontSize: 15, color: colors.ink, letterSpacing: -0.1 },
  rowMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  badge: {
    backgroundColor: colors.tealSoft,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeLabel: {
    color: colors.teal,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  // Leaderboard rows
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  lbRowYou: {
    backgroundColor: colors.tealSoft,
  },
  lbRank: {
    width: 18,
    fontSize: 13,
    color: colors.muted,
    fontVariant: ['tabular-nums'],
  },
  lbAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lbNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  lbKm: {
    fontSize: 13,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.1,
  },
  lbBarTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.lineSoft,
    overflow: 'hidden',
  },
  lbBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Champion
  championCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: '#F3D9A8',
  },
  championHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  championEyebrow: {
    fontSize: 11,
    color: colors.amberDeep,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  championWeek: {
    fontSize: 11,
    color: colors.amberDeep,
    fontVariant: ['tabular-nums'],
  },
  championBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  championAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  championAvatarLetter: { color: '#fff', fontSize: 18, fontWeight: '500' },
  championBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#F3D9A8',
  },
  championName: {
    fontSize: 17,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  championKm: {
    fontSize: 13,
    color: colors.amberDeep,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },

  // Invite (combined)
  inviteCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 18,
    borderRadius: 14,
    backgroundColor: colors.card,
  },
  inviteEyebrow: {
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  inviteHeading: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  inviteCodeChip: {
    marginTop: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
  },
  inviteCodeBig: {
    fontSize: 22,
    fontWeight: '500',
    color: colors.tealDeep,
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  inviteActions: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  inviteAction: {
    flex: 1,
    backgroundColor: colors.teal,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  inviteActionGhost: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.tealSoft,
  },
  inviteActionLabel: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
});
