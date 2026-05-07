import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { useSession } from '../src/stores/session';

// Stride Winner palette — amber owns this screen.
const WC = {
  amber: '#EF9F27',
  amberDeep: '#C47B10',
  amberSoft: '#FAEEDA',
  amberTint: '#F5DFB0',
  ink: '#0A0A0A',
  text: '#1A1A1A',
  muted: '#7A6D58',
  line: 'rgba(196, 123, 16, 0.14)',
  white: '#FFFFFF',
};

export default function WinnerReveal() {
  const router = useRouter();
  const { userId } = useSession();
  const params = useLocalSearchParams<{
    week?: string;
    year?: string;
    winnerUserId?: string;
    winnerName?: string;
    winnerInitials?: string;
    winnerColor?: string;
    distanceKm?: string;
    viewerKm?: string;
    viewerRank?: string;
    daysWalked?: string;
    dailyAvgKm?: string;
  }>();

  const weekNum = Number(params.week ?? 0);
  const year = Number(params.year ?? new Date().getFullYear());
  const distanceKm = Number(params.distanceKm ?? 0);
  const winnerName = params.winnerName ?? 'Walker';
  const initials = (params.winnerInitials ?? winnerName.slice(0, 2)).toUpperCase();
  const winnerColor = params.winnerColor || WC.amber;
  const isMe = !!userId && params.winnerUserId === userId;
  const viewerKm = Number(params.viewerKm ?? 0);
  const viewerRank = Number(params.viewerRank ?? 0);
  const daysWalked = Number(params.daysWalked ?? 7);
  const dailyAvgKm = Number(params.dailyAvgKm ?? distanceKm / 7);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/circle');
  }

  async function shareCongrats() {
    try {
      const msg = isMe
        ? `I won Week ${weekNum} on Stride — ${distanceKm.toFixed(1)} km. 🏆`
        : `Congrats ${winnerName.split(' ')[0]} — top of the circle this week with ${distanceKm.toFixed(1)} km!`;
      await Share.share({ message: msg });
    } catch {
      // user cancelled
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar — eyebrow + close */}
        <View style={styles.topBar}>
          <Text style={styles.eyebrow}>
            Week {weekNum > 0 ? weekNum : '—'} winner
          </Text>
          <Pressable style={styles.closeBtn} onPress={close} hitSlop={10}>
            <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
              <Path
                d="M2 2l8 8M10 2l-8 8"
                stroke={WC.amberDeep}
                strokeWidth={1.6}
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        </View>

        {/* Spotlight */}
        <View style={styles.spotlight}>
          <Trophy size={isMe ? 112 : 92} />

          <View
            style={[
              styles.avatar,
              { backgroundColor: isMe ? WC.amber : winnerColor },
            ]}
          >
            <Text style={styles.avatarLetter}>{initials.slice(0, 2)}</Text>
          </View>

          <Text style={styles.headline}>
            {isMe ? 'You won this week' : winnerName}
          </Text>

          {!isMe && (
            <Text style={styles.distanceLine}>
              {distanceKm.toFixed(1)} km this week
            </Text>
          )}
          {!isMe && (
            <Text style={styles.message}>
              {winnerName.split(' ')[0]} led the circle this week.
            </Text>
          )}

          {isMe ? (
            <View style={styles.statsRow}>
              <Stat
                value={distanceKm.toFixed(1)}
                unit="km"
                label="Distance"
              />
              <StatDivider />
              <Stat
                value={dailyAvgKm.toFixed(1)}
                unit="km"
                label="Daily avg"
              />
              <StatDivider />
              <Stat
                value={String(daysWalked)}
                unit={`of ${daysWalked > 7 ? daysWalked : 7}`}
                label="Days walked"
              />
            </View>
          ) : (
            <View style={styles.rankCard}>
              <View style={styles.rankRow}>
                <View style={styles.rankAvatar}>
                  <Text style={styles.rankAvatarLetter}>YO</Text>
                </View>
                <View>
                  <Text style={styles.rankEyebrow}>You finished</Text>
                  <Text style={styles.rankValue}>
                    {viewerRank > 0 ? ordinal(viewerRank) : '—'}
                    {viewerKm > 0 ? ` · ` : ''}
                    {viewerKm > 0 && (
                      <Text style={styles.rankKm}>{viewerKm.toFixed(1)} km</Text>
                    )}
                  </Text>
                </View>
              </View>
              <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <Path
                  d="M6 4l4 4-4 4"
                  stroke={WC.muted}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable style={styles.primaryBtn} onPress={shareCongrats}>
            <Text style={styles.primaryBtnLabel}>
              {isMe ? 'Share with circle' : 'Send congrats'}
            </Text>
          </Pressable>
          <Pressable onPress={close} hitSlop={10}>
            <Text style={styles.secondaryLink}>
              {isMe ? 'View your badge' : 'See full results'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.weekFooter}>
          {year > 0 ? `${year} · ` : ''}Week {weekNum > 0 ? weekNum : '—'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function Trophy({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Path
        d="M24 18 H18 a8 8 0 0 0 -8 8 v4 a14 14 0 0 0 14 14"
        stroke={WC.amber}
        strokeWidth={3.5}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M72 18 H78 a8 8 0 0 1 8 8 v4 a14 14 0 0 1 -14 14"
        stroke={WC.amber}
        strokeWidth={3.5}
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M24 14 H72 V36 a24 24 0 0 1 -48 0 Z" fill={WC.amber} />
      <Rect x={42} y={58} width={12} height={14} fill={WC.amber} />
      <Rect x={28} y={72} width={40} height={6} rx={2} fill={WC.amber} />
      <Rect x={22} y={80} width={52} height={6} rx={2} fill={WC.amber} />
    </Svg>
  );
}

function Stat({
  value,
  unit,
  label,
}: {
  value: string;
  unit: string;
  label: string;
}) {
  return (
    <View style={styles.stat}>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statUnit}>{unit}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function StatDivider() {
  return <View style={styles.statDivider} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: WC.amberSoft },
  scroll: { flexGrow: 1, paddingBottom: 24 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 14,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: WC.amberDeep,
    fontWeight: '500',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(196, 123, 16, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  spotlight: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 36,
    paddingBottom: 8,
    alignItems: 'center',
  },
  avatar: {
    marginTop: 30,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  headline: {
    marginTop: 14,
    fontSize: 34,
    fontWeight: '500',
    letterSpacing: -1,
    color: WC.ink,
    textAlign: 'center',
    lineHeight: 38,
  },
  distanceLine: {
    marginTop: 6,
    fontSize: 14,
    color: WC.muted,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.1,
  },
  message: {
    marginTop: 22,
    fontSize: 15,
    color: WC.text,
    lineHeight: 22,
    maxWidth: 260,
    textAlign: 'center',
  },

  rankCard: {
    marginTop: 26,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rankAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#5E8C7E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankAvatarLetter: { color: '#fff', fontSize: 12, fontWeight: '500' },
  rankEyebrow: {
    fontSize: 11,
    color: WC.muted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  rankValue: {
    fontSize: 14,
    color: WC.ink,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  rankKm: {
    fontWeight: '400',
    color: WC.text,
    fontVariant: ['tabular-nums'],
  },

  statsRow: {
    marginTop: 22,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: WC.line,
    marginVertical: 4,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  statValue: {
    fontSize: 22,
    fontWeight: '500',
    color: WC.ink,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  statUnit: { fontSize: 11, color: WC.muted },
  statLabel: {
    fontSize: 10,
    color: WC.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  actions: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 8 },
  primaryBtn: {
    backgroundColor: WC.amber,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  secondaryLink: {
    textAlign: 'center',
    marginTop: 14,
    fontSize: 14,
    color: WC.amberDeep,
    letterSpacing: 0.1,
  },

  weekFooter: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 11,
    color: WC.amberDeep,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    opacity: 0.6,
  },
});
