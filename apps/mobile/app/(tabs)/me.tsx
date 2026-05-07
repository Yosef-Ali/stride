import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle as SvgCircle, Path } from 'react-native-svg';
import { apiGet, apiPatch, apiPost } from '../../src/lib/api';
import { useSession } from '../../src/stores/session';
import { colors } from '../../src/lib/tokens';

const TROPHY_SLOT_COUNT = 12;

type Me = {
  id: string;
  email: string;
  name: string;
  avatarColor: string;
  weeklyGoalKm: string;
  createdAt: string;
};

type Lifetime = {
  totalKm: number;
  daysWalked: number;
  weeksActive: number;
};

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
};

type Winner = {
  id: string;
  userId: string;
  weekNumber: number;
  year: number;
};

type HomeWeek = {
  date: string;
  distanceKm: number;
};

type HomePayload = {
  week: HomeWeek[];
  todayIdx: number;
};

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatJoinDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export default function MeTab() {
  const router = useRouter();
  const { userId, circleId, setUser, setActiveCircle, signOut } = useSession();
  const [me, setMe] = useState<Me | null>(null);
  const [lifetime, setLifetime] = useState<Lifetime | null>(null);
  const [activeCircle, setLocalActiveCircle] = useState<Circle | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [myWins, setMyWins] = useState<Winner[]>([]);
  const [weekKm, setWeekKm] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [devOpen, setDevOpen] = useState(false);
  const [devBusy, setDevBusy] = useState(false);
  const [devStatus, setDevStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [meRes, circlesRes, homeRes] = await Promise.all([
        apiGet<{ user: Me; lifetime: Lifetime }>('/api/me'),
        apiGet<{ circles: Circle[] }>('/api/circles/mine'),
        apiGet<HomePayload>(`/api/home?today=${encodeURIComponent(todayLocal())}`).catch(
          () => null,
        ),
      ]);
      setMe(meRes.user);
      setLifetime(meRes.lifetime);

      const active =
        circlesRes.circles.find((c) => c.id === circleId) ?? circlesRes.circles[0] ?? null;
      setLocalActiveCircle(active);

      if (active) {
        const [membersRes, winnersRes] = await Promise.all([
          apiGet<{ members: Member[] }>(`/api/circles/${active.id}/members`).catch(
            () => ({ members: [] }),
          ),
          apiGet<{ winners: (Winner & { userId: string })[] }>(
            `/api/circles/${active.id}/winners`,
          ).catch(() => ({ winners: [] })),
        ]);
        setMembers(membersRes.members);
        setMyWins(winnersRes.winners.filter((w) => w.userId === userId));
      } else {
        setMembers([]);
        setMyWins([]);
      }

      if (homeRes) {
        setWeekKm(homeRes.week.reduce((s, d) => s + d.distanceKm, 0));
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [userId, circleId]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(body: Partial<Me>) {
    try {
      const { user } = await apiPatch<{ user: Me }>('/api/me', body);
      setMe((prev) => ({ ...(prev as Me), ...user }));
      if (body.name) await setUser({ userId: user.id, name: user.name });
    } catch (e: any) {
      setError(e?.message ?? 'Update failed');
    }
  }

  function startEditName() {
    if (!me) return;
    setNameDraft(me.name);
    setEditingName(true);
  }

  async function saveName() {
    const next = nameDraft.trim();
    if (!next || next === me?.name) {
      setEditingName(false);
      return;
    }
    await patch({ name: next });
    setEditingName(false);
  }

  function confirmSignOut() {
    Alert.alert(
      'Sign out?',
      "You'll need to enter your email again to sign back in.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(onboarding)/login');
          },
        },
      ],
    );
  }

  function comingSoon(label: string) {
    Alert.alert(label, 'Coming soon.');
  }

  function openManageCircles() {
    Alert.alert('Manage circles', 'Circle management is coming soon.');
  }

  async function crownLastWeek() {
    setDevBusy(true);
    setDevStatus(null);
    try {
      const res = await apiPost<{
        year: number;
        week: number;
        results: { inserted: boolean }[];
      }>('/api/dev/crown-last-week', {});
      const n = res.results.filter((r) => r.inserted).length;
      setDevStatus(
        `Week ${res.year}-W${res.week}: ${n} new · ${res.results.length - n} already crowned`,
      );
    } catch (e: any) {
      setDevStatus(`Failed: ${e?.message ?? e}`);
    } finally {
      setDevBusy(false);
    }
  }

  if (loading || !me || !lifetime) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={{ paddingTop: 60, alignItems: 'center' }}>
          <ActivityIndicator color={colors.teal} />
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      </SafeAreaView>
    );
  }

  const initials = (me.name[0] ?? '?').toUpperCase();
  const goalKm = Number(me.weeklyGoalKm) || 40;
  const goalPct = Math.min(1, weekKm / goalKm);
  const stats = [
    { value: lifetime.totalKm.toFixed(0), unit: 'km', label: 'Total distance' },
    { value: String(lifetime.daysWalked), unit: '', label: 'Days walked' },
    { value: String(lifetime.weeksActive), unit: '', label: 'Weeks active' },
  ];
  const isOwner = activeCircle ? activeCircle.createdBy === userId : false;
  const stackedMembers = members.filter((m) => m.userId !== userId).slice(0, 4);
  const extraMembers = Math.max(0, members.length - 1 - stackedMembers.length);

  // 12 trophy slots — fill earned ones from most-recent wins backwards.
  const trophies = Array.from({ length: TROPHY_SLOT_COUNT }, (_, i) => {
    const win = myWins[myWins.length - 1 - i]; // newest first
    return win
      ? { earned: true, week: `W${String(win.weekNumber).padStart(2, '0')}` }
      : { earned: false, week: '' };
  }).reverse(); // oldest on the left

  const wins = myWins.length;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Edit pencil top-right */}
        <Pressable
          style={styles.editPencil}
          onPress={startEditName}
          hitSlop={10}
        >
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path
              d="M4 20h4l10-10-4-4L4 16v4z"
              stroke={colors.muted}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M14 6l4 4"
              stroke={colors.muted}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>

        {/* Profile header */}
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: me.avatarColor }]}>
            <Text style={styles.avatarLetter}>{initials}</Text>
          </View>
          {editingName ? (
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              autoFocus
              onBlur={saveName}
              onSubmitEditing={saveName}
              maxLength={40}
              style={styles.nameInput}
            />
          ) : (
            <Pressable onPress={startEditName}>
              <Text style={styles.nameText}>{me.name}</Text>
            </Pressable>
          )}
          <Text style={styles.joinedText}>
            Walking since {formatJoinDate(me.createdAt)}
          </Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Stats strip */}
        <View style={styles.statsCard}>
          {stats.map((s, i) => (
            <View key={s.label} style={styles.statsRow}>
              {i > 0 && <View style={styles.statsDivider} />}
              <View style={styles.statCell}>
                <View style={styles.statValueRow}>
                  <Text style={styles.statValue}>{s.value}</Text>
                  {s.unit ? <Text style={styles.statUnit}>{s.unit}</Text> : null}
                </View>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Weekly wins */}
        <Section
          title="Weekly wins"
          right={`${wins} of ${TROPHY_SLOT_COUNT}`}
        >
          {wins === 0 && (
            <Text style={styles.shelfHint}>Win a week to earn your first trophy.</Text>
          )}
          <View style={styles.shelfCard}>
            <View style={styles.shelfGrid}>
              {trophies.map((t, i) => (
                <TrophySlot key={i} earned={t.earned} week={t.week} />
              ))}
            </View>
          </View>
        </Section>

        {/* Weekly goal */}
        <Section title="Weekly goal">
          <View style={styles.goalCard}>
            <View style={styles.goalHeader}>
              <View style={styles.goalValueRow}>
                <Text style={styles.goalValue}>{goalKm.toFixed(0)}</Text>
                <Text style={styles.goalUnit}>km</Text>
              </View>
              <Text style={styles.goalSub}>
                {weekKm > 0 ? `${weekKm.toFixed(1)} km this week` : 'Tap to edit'}
              </Text>
            </View>
            <View style={styles.goalTrack}>
              <View
                style={[
                  styles.goalFill,
                  { width: `${Math.max(2, goalPct * 100)}%` },
                ]}
              />
            </View>
          </View>
        </Section>

        {/* Your circle */}
        {activeCircle && (
          <Section title="Your circle">
            <View style={styles.circleCard}>
              <Pressable
                style={styles.circleRow}
                onPress={() => router.push('/(tabs)/circle')}
              >
                <View style={styles.circleBadge}>
                  <Text style={styles.circleBadgeLetter}>
                    {activeCircle.name[0]?.toUpperCase() ?? 'C'}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.circleName}>{activeCircle.name}</Text>
                  <Text style={styles.circleMeta}>
                    {members.length} {members.length === 1 ? 'member' : 'members'}
                    {isOwner ? ' · Owner' : ''}
                  </Text>
                </View>
                <Chevron />
              </Pressable>
              <View style={styles.circleDivider} />
              <View style={styles.circleFooter}>
                <AvatarStack
                  avatars={stackedMembers.map((m) => ({
                    initials: (m.name[0] ?? '?').toUpperCase(),
                    color: m.avatarColor,
                  }))}
                  extra={extraMembers}
                />
                <Pressable onPress={openManageCircles} hitSlop={8}>
                  <Text style={styles.manageLink}>Manage</Text>
                </Pressable>
              </View>
            </View>
          </Section>
        )}

        {/* Settings */}
        <Section title="Settings">
          <View style={styles.settingsCard}>
            {[
              { label: 'Notifications', onPress: () => comingSoon('Notifications') },
              { label: 'Health data', onPress: () => comingSoon('Health data') },
              { label: 'Appearance', onPress: () => comingSoon('Appearance') },
              { label: 'Help & feedback', onPress: () => comingSoon('Help & feedback') },
              { label: 'Privacy policy', onPress: () => comingSoon('Privacy policy') },
            ].map((row, i, arr) => (
              <Pressable
                key={row.label}
                style={[
                  styles.settingsRow,
                  i < arr.length - 1 && styles.settingsRowDivider,
                ]}
                onPress={row.onPress}
              >
                <Text style={styles.settingsLabel}>{row.label}</Text>
                <Chevron />
              </Pressable>
            ))}
            <Pressable
              style={[styles.settingsRow, styles.settingsRowDivider]}
              onPress={confirmSignOut}
            >
              <Text style={styles.settingsDanger}>Sign out</Text>
            </Pressable>
          </View>
        </Section>

        {/* Version footer (long-press to reveal dev tools) */}
        <Pressable onLongPress={() => setDevOpen((v) => !v)} delayLongPress={600}>
          <Text style={styles.version}>Stride v1.0.31</Text>
        </Pressable>

        {devOpen && (
          <View style={styles.devCard}>
            <Pressable
              style={[styles.devBtn, devBusy && { opacity: 0.5 }]}
              disabled={devBusy}
              onPress={crownLastWeek}
            >
              <Text style={styles.devBtnLabel}>
                {devBusy ? 'Crowning…' : 'Crown last week'}
              </Text>
            </Pressable>
            {devStatus && <Text style={styles.devStatus}>{devStatus}</Text>}
            <Text style={styles.devIdLabel}>User ID</Text>
            <Text style={styles.devIdValue} numberOfLines={1}>
              {userId ?? '—'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {right ? <Text style={styles.sectionRight}>{right}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Chevron() {
  return (
    <Svg width={8} height={14} viewBox="0 0 8 14" fill="none">
      <Path
        d="M1 1l6 6-6 6"
        stroke="#C8C8C4"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function TrophySlot({ earned, week }: { earned: boolean; week: string }) {
  return (
    <View style={styles.trophySlot}>
      {earned ? (
        <>
          <View style={styles.trophyDisc}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M8 4h8v4a4 4 0 01-8 0V4z"
                stroke="#fff"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M8 6H5.5a2.5 2.5 0 002.5 2.5"
                stroke="#fff"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M16 6h2.5a2.5 2.5 0 01-2.5 2.5"
                stroke="#fff"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M10 14h4v4h-4z"
                stroke="#fff"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M8 19h8"
                stroke="#fff"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <Text style={styles.trophyWeek}>{week}</Text>
        </>
      ) : (
        <View style={styles.trophyEmpty} />
      )}
    </View>
  );
}

function AvatarStack({
  avatars,
  extra,
}: {
  avatars: { initials: string; color: string }[];
  extra: number;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {avatars.map((a, i) => (
        <View
          key={i}
          style={[
            styles.stackAvatar,
            { backgroundColor: a.color, marginLeft: i === 0 ? 0 : -8 },
          ]}
        >
          <Text style={styles.stackAvatarText}>{a.initials}</Text>
        </View>
      ))}
      {extra > 0 && (
        <View style={[styles.stackAvatar, styles.stackExtra]}>
          <Text style={styles.stackExtraText}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  errorBox: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FDECEB',
  },
  errorText: { color: colors.danger, fontSize: 13 },

  editPencil: {
    position: 'absolute',
    top: 14,
    right: 20,
    zIndex: 5,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  nameText: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -0.4,
  },
  nameInput: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -0.4,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.teal,
    paddingBottom: 2,
    minWidth: 160,
  },
  joinedText: {
    marginTop: 4,
    fontSize: 12,
    color: colors.muted,
    letterSpacing: 0.1,
  },

  statsCard: {
    marginHorizontal: 20,
    marginTop: 6,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  statsRow: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  statsDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
    marginVertical: 2,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  statValue: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  statUnit: { fontSize: 11, color: colors.muted },
  statLabel: {
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 0.2,
    textAlign: 'center',
  },

  section: { paddingHorizontal: 20, marginTop: 26 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  sectionRight: {
    fontSize: 12,
    color: colors.faint,
    letterSpacing: 0.1,
    fontVariant: ['tabular-nums'],
  },

  shelfHint: {
    fontSize: 13,
    color: colors.faint,
    letterSpacing: 0.1,
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  shelfCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 10,
  },
  shelfGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  trophySlot: {
    width: '25%',
    height: 66,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    marginBottom: 14,
  },
  trophyDisc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyEmpty: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E2E2DC',
    opacity: 0.9,
  },
  trophyWeek: {
    fontSize: 10,
    color: colors.amberDeep,
    letterSpacing: 0.6,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },

  goalCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: 18,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  goalValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  goalValue: {
    fontSize: 24,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  goalUnit: { fontSize: 13, color: colors.muted },
  goalSub: { fontSize: 12, color: colors.faint },
  goalTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.lineSoft,
    overflow: 'hidden',
  },
  goalFill: { height: '100%', backgroundColor: colors.teal, borderRadius: 2 },

  circleCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
  },
  circleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 12,
  },
  circleDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
  },
  circleBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBadgeLetter: { color: colors.teal, fontSize: 13, fontWeight: '500' },
  circleName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -0.1,
  },
  circleMeta: { fontSize: 12, color: colors.muted, marginTop: 1 },
  circleFooter: {
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stackAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  stackAvatarText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  stackExtra: { backgroundColor: '#E6E6E0', marginLeft: -8 },
  stackExtraText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  manageLink: {
    fontSize: 12,
    color: colors.tealDeep,
    letterSpacing: 0.1,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },

  settingsCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingsRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  settingsLabel: {
    flex: 1,
    fontSize: 15,
    color: colors.ink,
    letterSpacing: -0.1,
  },
  settingsDanger: {
    flex: 1,
    fontSize: 15,
    color: colors.danger,
    fontWeight: '500',
    letterSpacing: -0.1,
  },

  version: {
    textAlign: 'center',
    paddingVertical: 26,
    fontSize: 11,
    color: colors.ghost,
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
  devCard: {
    marginHorizontal: 20,
    marginTop: -10,
    marginBottom: 20,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0DACF',
  },
  devBtn: {
    backgroundColor: colors.teal,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  devBtnLabel: { color: '#fff', fontSize: 14, fontWeight: '500' },
  devStatus: {
    marginTop: 12,
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
  },
  devIdLabel: {
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 4,
  },
  devIdValue: { fontSize: 12, color: colors.faint, fontVariant: ['tabular-nums'] },
});
