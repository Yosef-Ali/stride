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
import { apiPost } from '../../src/lib/api';
import { useSession } from '../../src/stores/session';
import { colors } from '../../src/lib/tokens';

type Circle = { id: string; name: string; inviteCode: string };

export default function JoinCircle() {
  const router = useRouter();
  const setActiveCircle = useSession((s) => s.setActiveCircle);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = code.trim().length === 8 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const { circle } = await apiPost<{ circle: Circle }>(
        '/api/circles/join',
        { code },
      );
      setActiveCircle({
        circleId: circle.id,
        circleName: circle.name,
        inviteCode: circle.inviteCode,
      });
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(
        e?.message === 'circle not found'
          ? "We couldn't find that code."
          : e?.message ?? 'Something went wrong',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingShell
      step={5}
      footer={
        <PrimaryCTA
          label={submitting ? 'Joining…' : 'Join circle'}
          disabled={!canSubmit}
          onPress={submit}
        />
      }
    >
      <View style={{ paddingTop: 40 }}>
        <Heading>Enter invite code</Heading>
        <Sub>Paste the 8-character code from your invite.</Sub>
      </View>

      <View style={{ marginTop: 28, gap: 8 }}>
        <Eyebrow>Code</Eyebrow>
        <View
          style={[
            styles.inputWrap,
            { borderColor: code.length === 8 ? colors.teal : colors.line },
          ]}
        >
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={(t) =>
              setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))
            }
            placeholder="XK7F9M2R"
            placeholderTextColor={colors.faint}
            autoCapitalize="characters"
            autoCorrect={false}
            selectionColor={colors.teal}
            cursorColor={colors.teal}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
        </View>
        {error && (
          <Text style={{ color: colors.danger, fontSize: 13, marginTop: 4 }}>
            {error}
          </Text>
        )}
      </View>

      <View style={{ flex: 1 }} />
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
  },
  input: {
    height: 56,
    fontSize: 22,
    color: colors.ink,
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
});
