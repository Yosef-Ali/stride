import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
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
const PHONE_RE = /^[+]?[\d\s\-().]{7,}$/;

type Mode = 'phone' | 'email';
type Step = 'identifier' | 'code';

/**
 * OTP-based restore path — for users whose account is linked to an email or
 * phone (e.g. coming back on a new device). New users should use the
 * invite-code flow at /(onboarding)/login instead.
 */
export default function SignIn() {
  const router = useRouter();
  const { setUser } = useSession();
  const [mode, setMode] = useState<Mode>('phone');
  const [step, setStep] = useState<Step>('identifier');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const identifier = mode === 'phone' ? phone : email;

  async function devSignIn() {
    setError(null);
    setBusy(true);
    try {
      const res = await apiPost<{ user: { id: string; name: string } }>(
        '/api/auth/dev-signin',
        {},
      );
      await setUser({ userId: res.user.id, name: res.user.name });
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(e?.message ?? 'Dev sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function requestCode() {
    setError(null);
    if (mode === 'email' && !EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email.');
      return;
    }
    if (mode === 'phone' && !PHONE_RE.test(phone.trim())) {
      setError('Enter a valid phone number.');
      return;
    }
    setBusy(true);
    try {
      const endpoint =
        mode === 'phone' ? '/api/auth/request-sms' : '/api/auth/request';
      const payload =
        mode === 'phone' ? { phone: phone.trim() } : { email: email.trim() };
      const res = await apiPost<{ ok: true; devCode?: string }>(
        endpoint,
        payload,
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
      const endpoint =
        mode === 'phone' ? '/api/auth/verify-sms' : '/api/auth/verify';
      const payload =
        mode === 'phone'
          ? { phone: phone.trim(), code }
          : { email: email.trim(), code };
      const res = await apiPost<{ user: { id: string; name: string } }>(
        endpoint,
        payload,
      );
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

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setError(null);
    setCode('');
    setDevCode(null);
    setStep('identifier');
  }

  return (
    <OnboardingShell
      step={step === 'identifier' ? 1 : 2}
      footer={
        step === 'identifier' ? (
          <>
            <PrimaryCTA
              label={busy ? 'Sending…' : 'Send code'}
              disabled={busy}
              onPress={requestCode}
            />
            {__DEV__ && (
              <LinkCTA
                label="Skip: sign in as Dev User"
                muted
                onPress={busy ? undefined : devSignIn}
              />
            )}
          </>
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
        {step === 'identifier' ? (
          <>
            <View style={styles.toggleRow}>
              <Pressable
                style={[
                  styles.toggleBtn,
                  mode === 'phone' && styles.toggleBtnActive,
                ]}
                onPress={() => switchMode('phone')}
              >
                <Text
                  style={[
                    styles.toggleLabel,
                    mode === 'phone' && styles.toggleLabelActive,
                  ]}
                >
                  Phone
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.toggleBtn,
                  mode === 'email' && styles.toggleBtnActive,
                ]}
                onPress={() => switchMode('email')}
              >
                <Text
                  style={[
                    styles.toggleLabel,
                    mode === 'email' && styles.toggleLabelActive,
                  ]}
                >
                  Email
                </Text>
              </Pressable>
            </View>

            <Heading>
              {mode === 'phone'
                ? `Sign in with\nyour phone.`
                : `Sign in with\nyour email.`}
            </Heading>
            <View style={{ marginTop: 10 }}>
              <Sub>
                {mode === 'phone'
                  ? 'We’ll text you a 6-digit code. No passwords, ever.'
                  : 'We’ll email you a 6-digit code. No passwords, ever.'}
              </Sub>
            </View>
            {mode === 'phone' ? (
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+251 9XX XXX XXX"
                placeholderTextColor={colors.faint}
                keyboardType="phone-pad"
                autoComplete="tel"
                style={styles.input}
                onSubmitEditing={requestCode}
                returnKeyType="send"
              />
            ) : (
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
            )}
          </>
        ) : (
          <>
            <Heading>{`Enter the\ncode.`}</Heading>
            <View style={{ marginTop: 10 }}>
              <Sub>
                We sent a 6-digit code to{' '}
                <Text style={{ color: colors.ink }}>{identifier.trim()}</Text>.
                It expires in 10 minutes.
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
              label={
                mode === 'phone'
                  ? 'Use a different number'
                  : 'Use a different email'
              }
              muted
              onPress={() => {
                setStep('identifier');
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
          <ActivityIndicator color={colors.teal} style={{ marginTop: 16 }} />
        )}
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingTop: 18 },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 3,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.line,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleBtnActive: { backgroundColor: colors.tealSoft },
  toggleLabel: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  toggleLabelActive: { color: colors.teal },
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
