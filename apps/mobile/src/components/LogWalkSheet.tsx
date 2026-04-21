import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiPost } from '../lib/api';
import { success, tapLight, warning } from '../lib/haptics';
import { colors } from '../lib/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const STEPS_PER_KM = 1350;
const MIN_PER_KM = 11;

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function dayOffset(offset: number): { label: string; date: string } {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  const labels = ['Today', 'Yesterday', '2 days ago'];
  return { label: labels[offset] ?? iso(d), date: iso(d) };
}

export function LogWalkSheet({ visible, onClose, onSaved }: Props) {
  const [km, setKm] = useState('');
  const [steps, setSteps] = useState('');
  const [minutes, setMinutes] = useState('');
  const [dateOffset, setDateOffset] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoFilled, setAutoFilled] = useState(true);

  // Clear on re-open
  useEffect(() => {
    if (visible) {
      setKm('');
      setSteps('');
      setMinutes('');
      setDateOffset(0);
      setError(null);
      setSaving(false);
      setAutoFilled(true);
    }
  }, [visible]);

  // Auto-estimate steps + minutes from distance (typical walking numbers).
  // Users can override either; as soon as they edit, we stop autofilling.
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
        date: dayOffset(dateOffset).date,
        distanceKm: d,
        steps: Math.round(s),
        activeMinutes: Math.round(m),
      });
      success();
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save walk.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheet}
      >
        <View style={styles.grabber} />

        <View style={styles.headerRow}>
          <Text style={styles.title}>Log a walk</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.close}>Cancel</Text>
          </Pressable>
        </View>

        {/* Date chips */}
        <View style={styles.chips}>
          {[0, 1, 2].map((o) => {
            const { label } = dayOffset(o);
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
              </Pressable>
            );
          })}
        </View>

        {/* Distance */}
        <Text style={styles.fieldLabel}>Distance</Text>
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

        {/* Steps + minutes row */}
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

        <Pressable
          style={[styles.saveBtn, saving && { opacity: 0.5 }]}
          disabled={saving}
          onPress={save}
        >
          <Text style={styles.saveLabel}>
            {saving ? 'Saving…' : 'Save walk'}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    backgroundColor: colors.surface,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.ghost,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -0.4,
  },
  close: { fontSize: 14, color: colors.muted },
  chips: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  chipLabel: { color: colors.ink, fontSize: 13 },
  chipLabelActive: { color: '#fff', fontWeight: '500' },
  fieldLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
    fontWeight: '500',
    marginBottom: 6,
  },
  bigField: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginBottom: 22,
  },
  bigInput: {
    fontSize: 52,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -2,
    minWidth: 120,
    fontVariant: ['tabular-nums'],
    padding: 0,
  },
  bigUnit: { fontSize: 20, color: colors.muted },
  smallRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
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
    fontSize: 20,
    color: colors.ink,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    padding: 0,
  },
  autoHint: { fontSize: 11, color: colors.faint, marginBottom: 18 },
  errorBox: {
    marginTop: 6,
    marginBottom: 10,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FDECEB',
  },
  errorText: { color: colors.danger, fontSize: 13 },
  saveBtn: {
    marginTop: 10,
    height: 52,
    backgroundColor: colors.teal,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLabel: { color: '#fff', fontSize: 16, fontWeight: '500' },
});
