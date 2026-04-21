import { useRouter } from 'expo-router';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import {
  Eyebrow,
  Heading,
  OnboardingShell,
  PrimaryCTA,
  Sub,
} from '../../src/components/onboarding/OnboardingShell';
import { GoalSlider } from '../../src/components/onboarding/GoalSlider';
import { useOnboarding } from '../../src/stores/onboarding';
import { colors } from '../../src/lib/tokens';

export default function Profile() {
  const router = useRouter();
  const { name, weeklyGoalKm, setName, setGoal } = useOnboarding();
  const canContinue = name.trim().length > 0;

  return (
    <OnboardingShell
      step={3}
      footer={
        <PrimaryCTA
          label="Continue"
          disabled={!canContinue}
          onPress={() => router.push('/(onboarding)/circle')}
        />
      }
    >
      <View style={{ paddingTop: 40 }}>
        <Heading>A little about you</Heading>
        <Sub>So we can tailor your goal and greeting.</Sub>
      </View>

      <View style={styles.fields}>
        <View style={styles.field}>
          <Eyebrow>Name</Eyebrow>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your first name"
              placeholderTextColor={colors.faint}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              selectionColor={colors.teal}
              cursorColor={colors.teal}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Eyebrow>Weekly goal</Eyebrow>
          <View style={styles.cardWrap}>
            <GoalSlider value={weeklyGoalKm} onChange={setGoal} />
          </View>
        </View>
      </View>

      <View style={{ flex: 1 }} />
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  fields: { marginTop: 36, gap: 22 },
  field: { gap: 8 },
  inputWrap: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  input: {
    height: 52,
    fontSize: 17,
    color: colors.ink,
    letterSpacing: -0.2,
  },
  cardWrap: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 18,
  },
});
