import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pedometer } from 'expo-sensors';

type Line = { label: string; value: string };

export default function DebugPedometer() {
  const [available, setAvailable] = useState<string>('…');
  const [permission, setPermission] = useState<string>('…');
  const [historical, setHistorical] = useState<string>('…');
  const [liveSteps, setLiveSteps] = useState<number | null>(null);
  const [watchError, setWatchError] = useState<string | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const subRef = useRef<{ remove: () => void } | null>(null);

  const log = (s: string) =>
    setEvents((e) => [`${new Date().toLocaleTimeString()}  ${s}`, ...e].slice(0, 40));

  const runDiagnostics = async () => {
    setAvailable('…');
    setPermission('…');
    setHistorical('…');
    try {
      const ok = await Pedometer.isAvailableAsync();
      setAvailable(String(ok));
      log(`isAvailableAsync → ${ok}`);
    } catch (e: any) {
      setAvailable(`error: ${e?.message ?? e}`);
      log(`isAvailableAsync threw: ${e?.message ?? e}`);
    }

    try {
      const perm = await Pedometer.requestPermissionsAsync();
      setPermission(JSON.stringify(perm));
      log(`requestPermissions → granted=${perm.granted} status=${perm.status}`);
    } catch (e: any) {
      setPermission(`error: ${e?.message ?? e}`);
      log(`requestPermissions threw: ${e?.message ?? e}`);
    }

    try {
      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const { steps } = await Pedometer.getStepCountAsync(start, now);
      setHistorical(`${steps} steps (midnight→now)`);
      log(`getStepCountAsync → ${steps}`);
    } catch (e: any) {
      setHistorical(`error: ${e?.message ?? e}`);
      log(`getStepCountAsync threw: ${e?.message ?? e}`);
    }
  };

  const startWatch = () => {
    if (subRef.current) return;
    setLiveSteps(0);
    setWatchError(null);
    try {
      const sub = Pedometer.watchStepCount((result) => {
        setLiveSteps(result.steps);
        log(`watch event: ${result.steps}`);
      });
      subRef.current = sub as any;
      log('watchStepCount subscribed');
    } catch (e: any) {
      setWatchError(e?.message ?? String(e));
      log(`watchStepCount threw: ${e?.message ?? e}`);
    }
  };

  const stopWatch = () => {
    subRef.current?.remove();
    subRef.current = null;
    log('watchStepCount unsubscribed');
  };

  useEffect(() => {
    runDiagnostics();
    return () => subRef.current?.remove();
  }, []);

  const lines: Line[] = [
    { label: 'Platform', value: `${Platform.OS} ${Platform.Version}` },
    { label: 'isAvailableAsync', value: available },
    { label: 'Permission', value: permission },
    { label: 'getStepCountAsync (today)', value: historical },
    {
      label: 'watchStepCount (live, since subscribe)',
      value:
        liveSteps === null
          ? 'not started'
          : watchError
            ? `error: ${watchError}`
            : `${liveSteps} steps`,
    },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={styles.h1}>Pedometer debug</Text>
        <Text style={styles.sub}>
          Walk with the phone to see if the live sensor fires. The "live" counter
          is the raw hardware step counter — no Google Fit / Samsung Health
          required.
        </Text>

        <View style={styles.card}>
          {lines.map((l) => (
            <View key={l.label} style={styles.row}>
              <Text style={styles.rowLabel}>{l.label}</Text>
              <Text style={styles.rowValue}>{l.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.buttons}>
          <Pressable style={styles.btn} onPress={runDiagnostics}>
            <Text style={styles.btnText}>Re-run diagnostics</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={startWatch}>
            <Text style={styles.btnText}>Start live watch</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnAlt]} onPress={stopWatch}>
            <Text style={styles.btnText}>Stop live watch</Text>
          </Pressable>
        </View>

        <Text style={styles.h2}>Event log</Text>
        <View style={styles.logBox}>
          {events.length === 0 ? (
            <Text style={styles.logEmpty}>no events yet</Text>
          ) : (
            events.map((e, i) => (
              <Text key={i} style={styles.logLine}>
                {e}
              </Text>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F6F5F0' },
  h1: { fontSize: 22, fontWeight: '600', marginBottom: 4, color: '#1A1A1A' },
  sub: { fontSize: 13, color: '#6B6B6B', marginBottom: 16, lineHeight: 18 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  row: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E0',
  },
  rowLabel: { fontSize: 11, color: '#8A8A85', textTransform: 'uppercase', letterSpacing: 0.6 },
  rowValue: { fontSize: 14, color: '#1A1A1A', marginTop: 2, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },
  buttons: { gap: 10, marginBottom: 20 },
  btn: {
    backgroundColor: '#2F6F57',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnAlt: { backgroundColor: '#8A8A85' },
  btnText: { color: '#fff', fontWeight: '500', fontSize: 15 },
  h2: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#1A1A1A' },
  logBox: {
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 12,
    minHeight: 120,
  },
  logEmpty: { color: '#888', fontSize: 12 },
  logLine: { color: '#A6E3C3', fontSize: 11, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }), marginBottom: 2 },
});
