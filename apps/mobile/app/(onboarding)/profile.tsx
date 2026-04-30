import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import {
  Eyebrow,
  Heading,
  OnboardingShell,
  PrimaryCTA,
  Sub,
} from '../../src/components/onboarding/OnboardingShell';
import { useOnboarding } from '../../src/stores/onboarding';
import { apiPatch } from '../../src/lib/api';
import { colors } from '../../src/lib/tokens';

export default function Profile() {
  const router = useRouter();
  const { name, setName } = useOnboarding();
  const [saving, setSaving] = useState(false);
  const canContinue = name.trim().length > 0 && !saving;

  const onContinue = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await apiPatch('/api/me', { name: trimmed });
    } catch {
      // non-fatal: user can retry from settings later.
    } finally {
      setSaving(false);
      router.push('/(onboarding)/circle');
    }
  };

  return (
    <OnboardingShell
      step={3}
      footer={
        <PrimaryCTA
          label="Continue"
          disabled={!canContinue}
          onPress={onContinue}
        />
      }
    >
      <View style={{ paddingTop: 40 }}>
        <Heading>What should we call you?</Heading>
        <Sub>Used for your greeting and on the circle leaderboard.</Sub>
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
});
