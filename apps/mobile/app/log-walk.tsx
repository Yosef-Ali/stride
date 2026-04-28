import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiPost } from '../src/lib/api';
import { success, tapLight, warning } from '../src/lib/haptics';
import { STEPS_PER_KM } from '../src/lib/pedometer';
import { colors } from '../src/lib/tokens';

const MIN_PER_KM = 11;
const DAY_OPTIONS = 7;

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function dayOption(offset: number): { label: string; sub: string; date: string } {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  const sub = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (offset === 0) return { label: 'Today', sub, date: iso(d) };
  if (offset === 1) return { label: 'Yesterday', sub, date: iso(d) };
  return {
    label: d.toLocaleDateString(undefined, { weekday: 'short' }),
    sub,
    date: iso(d),
  };
}

export default function LogWalkScreen() {
  const router = useRouter();
  const [km, setKm] = useState('');
  const [steps, setSteps] = useState('');
  const [minutes, setMinutes] = useState('');
  const [dateOffset, setDateOffset] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoFilled, setAutoFilled] = useState(true);

  function onKmChange(t: string) {
    const clean = t.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
    setKm(clean);
    if (autoFilled) {
      const n = Number(clean);
      if (Number.isFinite(n) && n > 0) {
        setSteps(Math.round(n * STEPS_PER_KM).toString());
        setMinutes(Math.round(n * MIN_PER_KM).toString());
      } else {
        setSteps('');
        setMinutes('');
      }
    }
  }

  async function save() {
    setError(null);
    const d = Number(km);
    if (!Number.isFinite(d) || d <= 0 || d > 100) {
      setError('Enter a distance between 0.1 and 100 km.');
      warning();
      return;
    }
    const s = Number(steps || 0);
    const m = Number(minutes || 0);
    setSaving(true);
    try {
      await apiPost('/api/walks', {
        date: dayOption(dateOffset).date,
        distanceKm: d,
        steps: Math.round(s),
        activeMinutes: Math.round(m),
      });
      success();
      router.back();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save walk.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={{ width: 64 }}
          >
            <Text style={styles.close}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>Log a walk</Text>
          <View style={{ width: 64 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.fieldLabel}>When</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {Array.from({ length: DAY_OPTIONS }).map((_, o) => {
              const { label, sub } = dayOption(o);
              const active = o === dateOffset;
              return (
                <Pressable
                  key={o}
                  onPress={() => {
                    tapLight();
                    setDateOffset(o);
                  }}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipLabel,
                      active && styles.chipLabelActive,
                    ]}
                  >
                    {label}
                  </Text>
                  <Text
                    style={[
                      styles.chipSub,
                      active && styles.chipSubActive,
                    ]}
                  >
                    {sub}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[styles.fieldLabel, { marginTop: 28 }]}>Distance</Text>
          <View style={styles.bigField}>
            <TextInput
              value={km}
              onChangeText={onKmChange}
              placeholder="0.0"
              placeholderTextColor={colors.faint}
              keyboardType="decimal-pad"
              style={styles.bigInput}
              autoFocus
            />
            <Text style={styles.bigUnit}>km</Text>
          </View>

          <View style={styles.smallRow}>
            <View style={styles.smallField}>
              <Text style={styles.fieldLabel}>Steps</Text>
              <TextInput
                value={steps}
                onChangeText={(t) => {
                  setAutoFilled(false);
                  setSteps(t.replace(/\D/g, ''));
                }}
                placeholder="0"
                placeholderTextColor={colors.faint}
                keyboardType="number-pad"
                style={styles.smallInput}
              />
            </View>
            <View style={styles.smallField}>
              <Text style={styles.fieldLabel}>Active min</Text>
              <TextInput
                value={minutes}
                onChangeText={(t) => {
                  setAutoFilled(false);
                  setMinutes(t.replace(/\D/g, ''));
                }}
                placeholder="0"
                placeholderTextColor={colors.faint}
                keyboardType="number-pad"
                style={styles.smallInput}
              />
            </View>
          </View>

          {autoFilled && km.length > 0 && (
            <Text style={styles.autoHint}>
              Steps & minutes estimated from distance — tap to adjust.
            </Text>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
            disabled={saving}
            onPress={save}
          >
            <Text style={styles.saveLabel}>
              {saving ? 'Saving…' : 'Save walk'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  close: { fontSize: 14, color: colors.muted },
  content: { paddingHorizontal: 22, paddingBottom: 24 },
  fieldLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
    fontWeight: '500',
    marginBottom: 10,
  },
  chips: { gap: 8, paddingRight: 22 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    minWidth: 78,
  },
  chipActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  chipLabel: { color: colors.ink, fontSize: 13, fontWeight: '500' },
  chipLabelActive: { color: '#fff' },
  chipSub: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  chipSubActive: { color: 'rgba(255,255,255,0.85)' },
  bigField: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginBottom: 24,
  },
  bigInput: {
    fontSize: 56,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -2,
    minWidth: 120,
    fontVariant: ['tabular-nums'],
    padding: 0,
  },
  bigUnit: { fontSize: 22, color: colors.muted },
  smallRow: { flexDirection: 'row', gap: 12 },
  smallField: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  smallInput: {
    fontSize: 22,
    color: colors.ink,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    padding: 0,
  },
  autoHint: { fontSize: 11, color: colors.faint, marginTop: 12 },
  errorBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FDECEB',
  },
  errorText: { color: colors.danger, fontSize: 13 },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
  },
  saveBtn: {
    height: 52,
    backgroundColor: colors.teal,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLabel: { color: '#fff', fontSize: 16, fontWeight: '500' },
});
