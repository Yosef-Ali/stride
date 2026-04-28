import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiGet, apiPatch, apiPost } from '../../src/lib/api';
import { useSession } from '../../src/stores/session';
import { avatarPalette, colors } from '../../src/lib/tokens';

type Me = {
  id: string;
  email: string;
  name: string;
  avatarColor: string;
};

type Circle = {
  id: string;
  name: string;
  inviteCode: string;
  createdBy: string;
};

export default function MeTab() {
  const router = useRouter();
  const { userId, circleId, setUser, setActiveCircle, signOut } = useSession();
  const [me, setMe] = useState<Me | null>(null);
  const [circles, setCircles] = useState<Circle[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [devStatus, setDevStatus] = useState<string | null>(null);
  const [devBusy, setDevBusy] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [{ user }, { circles }] = await Promise.all([
        apiGet<{ user: Me }>('/api/me'),
        apiGet<{ circles: Circle[] }>('/api/circles/mine'),
      ]);
      setMe(user);
      setCircles(circles);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(body: Partial<Me>) {
    setSaving(true);
    try {
      const { user } = await apiPatch<{ user: Me }>('/api/me', body);
      setMe(user);
      if (body.name) await setUser({ userId: user.id, name: user.name });
    } catch (e: any) {
      setError(e?.message ?? 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  function startEditName() {
    if (!me) return;
    setNameDraft(me.name);
    setEditingName(true);
  }

  async function saveName() {
    const next = nameDraft.trim();
    if (!next || next === me?.name) {
      setEditingName(false);
      return;
    }
    await patch({ name: next });
    setEditingName(false);
  }

function confirmLeave(c: Circle) {
    if (c.createdBy === userId) {
      Alert.alert(
        'Owner can’t leave',
        'You created this circle. Delete it or hand ownership off first.',
      );
      return;
    }
    Alert.alert(`Leave ${c.name}?`, 'You can rejoin later with the invite code.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiPost(`/api/circles/${c.id}/leave`, {});
            if (circleId === c.id) {
              setActiveCircle({ circleId: '', circleName: '', inviteCode: '' });
            }
            await load();
          } catch (e: any) {
            Alert.alert('Could not leave', e?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  }

  function confirmSignOut() {
    Alert.alert(
      'Sign out?',
      'You’ll need to enter your email again to sign back in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(onboarding)/login');
          },
        },
      ],
    );
  }

  async function crownLastWeek() {
    setDevBusy(true);
    setDevStatus(null);
    try {
      const res = await apiPost<{
        year: number;
        week: number;
        results: { inserted: boolean }[];
      }>('/api/dev/crown-last-week', {});
      const n = res.results.filter((r) => r.inserted).length;
      setDevStatus(
        `Week ${res.year}-W${res.week}: ${n} new · ${res.results.length - n} already crowned`,
      );
    } catch (e: any) {
      setDevStatus(`Failed: ${e?.message ?? e}`);
    } finally {
      setDevBusy(false);
    }
  }

  if (loading || !me) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={{ paddingTop: 60, alignItems: 'center' }}>
          <ActivityIndicator color={colors.teal} />
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>account</Text>
          <Text style={styles.title}>You</Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: me.avatarColor }]}>
            <Text style={styles.avatarLetter}>
              {me.name[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          {editingName ? (
            <View style={{ alignItems: 'center', width: '100%' }}>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                autoFocus
                onBlur={saveName}
                onSubmitEditing={saveName}
                maxLength={40}
                style={styles.nameInput}
              />
            </View>
          ) : (
            <Pressable onPress={startEditName}>
              <Text style={styles.nameText}>{me.name}</Text>
            </Pressable>
          )}
          <Text style={styles.emailText}>{me.email}</Text>
        </View>

        {/* Avatar color picker */}
        <Text style={styles.sectionLabel}>Avatar color</Text>
        <View style={styles.card}>
          <View style={styles.swatchRow}>
            {[colors.teal, ...avatarPalette].map((c) => {
              const selected = c.toLowerCase() === me.avatarColor.toLowerCase();
              return (
                <Pressable
                  key={c}
                  onPress={() => patch({ avatarColor: c })}
                  style={[
                    styles.swatch,
                    { backgroundColor: c },
                    selected && styles.swatchSelected,
                  ]}
                />
              );
            })}
          </View>
        </View>

        {/* Circles */}
        <Text style={styles.sectionLabel}>Circles</Text>
        <View style={styles.card}>
          {circles && circles.length > 0 ? (
            circles.map((c, i) => (
              <View
                key={c.id}
                style={[
                  styles.circleRow,
                  i < circles.length - 1 && styles.rowDivider,
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.circleName}>{c.name}</Text>
                  <Text style={styles.circleMeta}>
                    {c.createdBy === userId ? 'Owner · ' : ''}
                    {c.inviteCode}
                  </Text>
                </View>
                <Pressable onPress={() => confirmLeave(c)}>
                  <Text
                    style={[
                      styles.leaveLabel,
                      c.createdBy === userId && { color: colors.faint },
                    ]}
                  >
                    Leave
                  </Text>
                </Pressable>
              </View>
            ))
          ) : (
            <Text style={styles.emptyLabel}>You're not in any circles yet.</Text>
          )}
        </View>

        {/* Sign out */}
        <Pressable style={styles.signOutBtn} onPress={confirmSignOut}>
          <Text style={styles.signOutLabel}>Sign out</Text>
        </Pressable>

        {/* Developer */}
        <Text style={styles.sectionLabel}>Developer</Text>
        <View style={styles.card}>
          <Pressable
            style={[styles.devBtn, devBusy && { opacity: 0.5 }]}
            disabled={devBusy}
            onPress={crownLastWeek}
          >
            <Text style={styles.devBtnLabel}>
              {devBusy ? 'Crowning…' : 'Crown last week'}
            </Text>
          </Pressable>
          {devStatus && <Text style={styles.devStatus}>{devStatus}</Text>}
          <Text style={styles.idLabel}>User ID</Text>
          <Text style={styles.idValue} numberOfLines={1}>
            {userId ?? '—'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingBottom: 40 },
  header: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 20 },
  eyebrow: {
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '500',
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '500',
    letterSpacing: -0.5,
    color: colors.ink,
  },
  errorBox: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FDECEB',
  },
  errorText: { color: colors.danger, fontSize: 13 },
  profileCard: {
    marginHorizontal: 20,
    marginBottom: 18,
    padding: 24,
    borderRadius: 16,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarLetter: { color: '#fff', fontSize: 32, fontWeight: '500' },
  nameText: {
    fontSize: 22,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -0.4,
  },
  nameInput: {
    fontSize: 22,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -0.4,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.teal,
    paddingBottom: 2,
    minWidth: 140,
  },
  emailText: { fontSize: 13, color: colors.muted, marginTop: 4 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.ink,
    paddingHorizontal: 24,
    marginTop: 4,
    marginBottom: 10,
  },
  card: {
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.card,
  },
  swatchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: {
    borderColor: colors.ink,
    transform: [{ scale: 1.12 }],
  },
  circleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  circleName: { fontSize: 15, color: colors.ink, fontWeight: '500' },
  circleMeta: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  leaveLabel: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  emptyLabel: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  signOutBtn: {
    marginHorizontal: 20,
    marginBottom: 22,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
  },
  signOutLabel: { color: colors.danger, fontSize: 14, fontWeight: '500' },
  devBtn: {
    backgroundColor: colors.teal,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  devBtnLabel: { color: '#fff', fontSize: 14, fontWeight: '500' },
  devStatus: {
    marginTop: 12,
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
  },
  idLabel: {
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 4,
  },
  idValue: {
    fontSize: 12,
    color: colors.faint,
    fontVariant: ['tabular-nums'],
  },
});
