import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import {
  Heading,
  OnboardingShell,
  PrimaryCTA,
  Sub,
} from '../../src/components/onboarding/OnboardingShell';
import { useOnboarding } from '../../src/stores/onboarding';
import { colors } from '../../src/lib/tokens';

export default function Success() {
  const router = useRouter();
  const { circleName, inviteCode } = useOnboarding();
  const link = `stride.app/c/${inviteCode ?? 'XXXXXXXX'}`;

  return (
    <OnboardingShell
      step={5}
      footer={
        <PrimaryCTA
          label="Done"
          onPress={() => router.replace('/(tabs)/home')}
        />
      }
    >
      <View style={styles.hero}>
        <View style={styles.check}>
          <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
            <Path
              d="M5 12.5l4 4L19 6.5"
              stroke={colors.teal}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>

        <Heading>{(circleName.trim() || 'Your circle') + ' is ready'}</Heading>
        <View style={{ maxWidth: 300, alignSelf: 'center', marginTop: 10 }}>
          <Sub>
            Share this link with up to 9 others. You can manage the circle from
            your profile.
          </Sub>
        </View>

        <View style={styles.inviteRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inviteLabel}>Invite link</Text>
            <Text style={styles.inviteLink} numberOfLines={1}>
              {link}
            </Text>
          </View>
          <Pressable style={styles.copyBtn} onPress={() => {}}>
            <Svg width={12} height={12} viewBox="0 0 16 16" fill="none">
              <Rect
                x={5}
                y={5}
                width={9}
                height={9}
                rx={1.5}
                stroke="#fff"
                strokeWidth={1.8}
              />
              <Path
                d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2H3.5A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"
                stroke="#fff"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.copyLabel}>Copy</Text>
          </Pressable>
        </View>
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 48,
  },
  check: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  inviteRow: {
    marginTop: 28,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    paddingLeft: 18,
    borderRadius: 12,
    backgroundColor: colors.card,
  },
  inviteLabel: {
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  inviteLink: {
    fontSize: 13,
    color: colors.ink,
    marginTop: 3,
    letterSpacing: -0.1,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.teal,
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  copyLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
});
