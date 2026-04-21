import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import {
  Heading,
  LinkCTA,
  OnboardingShell,
  PrimaryCTA,
  Sub,
} from '../../src/components/onboarding/OnboardingShell';
import { colors } from '../../src/lib/tokens';

export default function Permissions() {
  const router = useRouter();
  const next = () => router.push('/(onboarding)/profile');

  return (
    <OnboardingShell
      step={2}
      footer={
        <>
          <PrimaryCTA label="Allow access" onPress={next} />
          <LinkCTA label="Not now" muted onPress={next} />
        </>
      }
    >
      <View style={styles.hero}>
        <PhoneMotion />
      </View>
      <View style={styles.copy}>
        <Heading>Track your walks automatically</Heading>
        <View style={{ maxWidth: 310, alignSelf: 'center', marginTop: 10 }}>
          <Sub>
            Stride reads step and distance data from your phone. Nothing is
            shared until you join a circle.
          </Sub>
        </View>
      </View>
    </OnboardingShell>
  );
}

function PhoneMotion() {
  return (
    <Svg width={110} height={110} viewBox="0 0 110 110" fill="none">
      <Rect
        x={34}
        y={14}
        width={42}
        height={82}
        rx={8}
        stroke={colors.teal}
        strokeWidth={3}
        fill="none"
      />
      <Rect x={48} y={20} width={14} height={2} rx={1} fill={colors.teal} />
      <Rect
        x={49}
        y={86}
        width={12}
        height={3}
        rx={1.5}
        fill={colors.teal}
        opacity={0.4}
      />
      <Path
        d="M28 56 C34 50 38 62 44 56 C50 50 54 62 60 56 C66 50 70 62 76 56 C82 50 86 62 92 56"
        stroke={colors.teal}
        strokeWidth={2.6}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  copy: { alignItems: 'center', paddingBottom: 24 },
});
