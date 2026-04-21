import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiPost } from '../../src/lib/api';
import {
  Heading,
  LinkCTA,
  OnboardingShell,
  PrimaryCTA,
  Sub,
} from '../../src/components/onboarding/OnboardingShell';
import { useSession } from '../../src/stores/session';
import { colors } from '../../src/lib/tokens';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = 'email' | 'code';

export default function Login() {
  const router = useRouter();
  const { setUser } = useSession();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  async function requestCode() {
    setError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email.');
      return;
    }
    setBusy(true);
    try {
      const res = await apiPost<{ ok: true; devCode?: string }>(
        '/api/auth/request',
        { email: email.trim() },
      );
      setStep('code');
      setCode('');
      setDevCode(res.devCode ?? null);
    } catch (e: any) {
      setError(e?.message ?? 'Could not send code.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code.');
      return;
    }
    setBusy(true);
    try {
      const res = await apiPost<{
        user: { id: string; name: string; email: string };
      }>('/api/auth/verify', { email: email.trim(), code });
      await setUser({ userId: res.user.id, name: res.user.name });
      router.replace('/(tabs)/home');
    } catch (e: any) {
      const msg = e?.message ?? 'Verification failed.';
      setError(
        msg === 'invalid'
          ? 'That code is wrong. Try again.'
          : msg === 'expired'
            ? 'Code expired — request a new one.'
            : msg === 'too_many_attempts'
              ? 'Too many tries — request a new code.'
              : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <OnboardingShell
      step={step === 'email' ? 1 : 2}
      footer={
        step === 'email' ? (
          <PrimaryCTA
            label={busy ? 'Sending…' : 'Send code'}
            disabled={busy}
            onPress={requestCode}
          />
        ) : (
          <>
            <PrimaryCTA
              label={busy ? 'Verifying…' : 'Verify & sign in'}
              disabled={busy}
              onPress={verifyCode}
            />
            <LinkCTA
              label={busy ? ' ' : 'Resend code'}
              muted
              onPress={busy ? undefined : requestCode}
            />
          </>
        )
      }
    >
      <View style={styles.content}>
        {step === 'email' ? (
          <>
            <Heading>{`Sign in with\nyour email.`}</Heading>
            <View style={{ marginTop: 10 }}>
              <Sub>
                We’ll email you a 6-digit code. No passwords, ever.
              </Sub>
            </View>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.faint}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              style={styles.input}
              onSubmitEditing={requestCode}
              returnKeyType="send"
            />
          </>
        ) : (
          <>
            <Heading>{`Enter the\ncode.`}</Heading>
            <View style={{ marginTop: 10 }}>
              <Sub>
                We sent a 6-digit code to{' '}
                <Text style={{ color: colors.ink }}>{email.trim()}</Text>. It
                expires in 10 minutes.
              </Sub>
            </View>
            <TextInput
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="• • • • • •"
              placeholderTextColor={colors.faint}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              style={[styles.input, styles.codeInput]}
              onSubmitEditing={verifyCode}
              returnKeyType="go"
              autoFocus
              maxLength={6}
            />
            {devCode && (
              <View style={styles.devBanner}>
                <Text style={styles.devBannerLabel}>DEV</Text>
                <Text style={styles.devBannerCode}>{devCode}</Text>
              </View>
            )}
            <LinkCTA
              label="Use a different email"
              muted
              onPress={() => {
                setStep('email');
                setCode('');
                setDevCode(null);
                setError(null);
              }}
            />
          </>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {busy && (
          <ActivityIndicator
            color={colors.teal}
            style={{ marginTop: 16 }}
          />
        )}
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingTop: 36 },
  input: {
    marginTop: 32,
    height: 54,
    borderRadius: 12,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
  },
  codeInput: {
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  devBanner: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: colors.amberSoft,
  },
  devBannerLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.amberDeep,
    letterSpacing: 0.8,
  },
  devBannerCode: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  errorBox: {
    marginTop: 18,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FDECEB',
  },
  errorText: { color: colors.danger, fontSize: 13 },
});
