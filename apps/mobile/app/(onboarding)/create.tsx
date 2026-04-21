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
import { useSession } from '../../src/stores/session';
import { apiPost } from '../../src/lib/api';
import { colors } from '../../src/lib/tokens';

const MAX_NAME = 24;

type Circle = {
  id: string;
  name: string;
  inviteCode: string;
};

export default function CreateCircle() {
  const router = useRouter();
  const { circleName, setCircleName, setInviteCode } = useOnboarding();
  const setActiveCircle = useSession((s) => s.setActiveCircle);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = circleName.trim().length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const { circle } = await apiPost<{ circle: Circle }>('/api/circles', {
        name: circleName.trim(),
      });
      setInviteCode(circle.inviteCode);
      setActiveCircle({
        circleId: circle.id,
        circleName: circle.name,
        inviteCode: circle.inviteCode,
      });
      router.push('/(onboarding)/success');
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const initial = circleName.trim()[0]?.toUpperCase() ?? '?';

  return (
    <OnboardingShell
      step={5}
      footer={
        <PrimaryCTA
          label={submitting ? 'Creating…' : 'Create circle'}
          disabled={!canSubmit}
          onPress={submit}
        />
      }
    >
      <View style={{ paddingTop: 40 }}>
        <Heading>Name your circle</Heading>
        <Sub>This is what your people will see.</Sub>
      </View>

      <View style={{ marginTop: 28 }}>
        <View
          style={[
            styles.inputWrap,
            { borderColor: circleName ? colors.teal : colors.line },
          ]}
        >
          <TextInput
            style={styles.input}
            value={circleName}
            onChangeText={(t) => setCircleName(t.slice(0, MAX_NAME))}
            placeholder="Family, Running club…"
            placeholderTextColor={colors.faint}
            autoCapitalize="words"
            autoCorrect={false}
            selectionColor={colors.teal}
            cursorColor={colors.teal}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          <Text style={styles.counter}>
            {circleName.length} / {MAX_NAME}
          </Text>
        </View>
      </View>

      {circleName.trim().length > 0 && (
        <View style={{ marginTop: 28 }}>
          <View style={{ paddingLeft: 4, marginBottom: 10 }}>
            <Eyebrow>Preview</Eyebrow>
          </View>
          <View style={styles.preview}>
            <View style={styles.previewAvatar}>
              <Text style={styles.previewInitial}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.previewTitle}>{circleName.trim()}</Text>
              <Text style={styles.previewSub}>0 members · Week starts Monday</Text>
            </View>
          </View>
        </View>
      )}

      {error && (
        <Text style={{ color: colors.danger, marginTop: 16, fontSize: 13 }}>
          {error}
        </Text>
      )}

      <View style={{ flex: 1 }} />
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
  },
  input: {
    flex: 1,
    height: 56,
    fontSize: 18,
    color: colors.ink,
    letterSpacing: -0.3,
  },
  counter: { fontSize: 12, color: colors.faint },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 12,
    backgroundColor: colors.card,
  },
  previewAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewInitial: {
    color: colors.teal,
    fontSize: 16,
    fontWeight: '500',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  previewSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
