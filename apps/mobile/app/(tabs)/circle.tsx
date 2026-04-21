import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
            <View style={styles.inviteCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inviteLabel}>Invite code</Text>
                <Text style={styles.inviteCode}>{active.inviteCode}</Text>
              </View>
              <Pressable style={styles.copyBtn} onPress={onCopy}>
                <Text style={styles.copyLabel}>{copied ? 'Copied' : 'Copy'}</Text>
              </Pressable>
            </View>

            {winners && winners.length > 0 && (
              <View style={styles.championCard}>
                <View style={styles.championHeader}>
                  <Text style={styles.championEyebrow}>Last week's champion</Text>
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
                    <View style={styles.championCrown}>
                      <Text style={{ fontSize: 13 }}>👑</Text>
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
                </View>
              </View>
            )}

            {leaderboard && leaderboard.length > 0 && (
              <>
                <View style={styles.membersHeader}>
                  <Text style={styles.sectionTitle}>This week</Text>
                  <Text style={styles.sectionCount}>
                    Mon – Sun
                  </Text>
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
                          i < leaderboard.length - 1 && styles.rowDivider,
                        ]}
                      >
                        <Text
                          style={[
                            styles.lbRank,
                            i === 0 && { color: colors.teal, fontWeight: '500' },
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

            <View style={styles.membersHeader}>
              <Text style={styles.sectionTitle}>Members</Text>
              <Text style={styles.sectionCount}>
                {members.length} / 10
              </Text>
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

            <Pressable style={styles.inviteRowBtn} onPress={onShare}>
              <Text style={styles.inviteRowLabel}>Share invite link</Text>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M9 6l6 6-6 6"
                  stroke={colors.teal}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
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
  inviteCard: {
    marginHorizontal: 20,
    padding: 16,
    paddingLeft: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    backgroundColor: colors.card,
    marginBottom: 14,
  },
  inviteLabel: {
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  inviteCode: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: 2,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  copyBtn: {
    backgroundColor: colors.teal,
    borderRadius: 9,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  copyLabel: { color: '#fff', fontSize: 13, fontWeight: '500' },
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
  inviteRowBtn: {
    marginHorizontal: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: colors.tealSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inviteRowLabel: {
    color: colors.teal,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
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
  championCrown: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
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
});
