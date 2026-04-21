import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  Heading,
  LinkCTA,
  OnboardingShell,
  PrimaryCTA,
  Sub,
} from '../../src/components/onboarding/OnboardingShell';
import { colors } from '../../src/lib/tokens';

export default function Welcome() {
  const router = useRouter();
  return (
    <OnboardingShell
      step={1}
      footer={
        <>
          <PrimaryCTA
            label="Get started"
            onPress={() => router.push('/(onboarding)/login')}
          />
          <LinkCTA
            label="I already have an account"
            onPress={() => router.push('/(onboarding)/login')}
          />
        </>
      }
    >
      <View style={styles.hero}>
        <Walker />
      </View>
      <View style={styles.copy}>
        <Heading>{`Walk with the\npeople who matter.`}</Heading>
        <View style={{ maxWidth: 300, alignSelf: 'center', marginTop: 10 }}>
          <Sub>
            Stride records your daily walks and shows how you're doing alongside
            your circle.
          </Sub>
        </View>
      </View>
    </OnboardingShell>
  );
}

function Walker() {
  return (
    <Svg width={88} height={88} viewBox="0 0 88 88" fill="none">
      <Circle cx={48} cy={16} r={7} fill={colors.teal} />
      <Path
        d="M42 26 L36 48 L30 64 L26 72"
        stroke={colors.teal}
        strokeWidth={6.5}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M42 26 L54 34 L60 48 L68 54"
        stroke={colors.teal}
        strokeWidth={6.5}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M36 48 L48 62 L44 76"
        stroke={colors.teal}
        strokeWidth={6.5}
        strokeLinecap="round"
        fill="none"
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
  copy: {
    alignItems: 'center',
    paddingBottom: 24,
  },
});
