import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../lib/tokens';

export function Placeholder({ title, step }: { title: string; step: number }) {
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>coming next</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>Arrives in step {step}.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 28,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
    fontWeight: '500',
    marginBottom: 6,
  },
  title: {
    fontSize: 30,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -0.8,
  },
  sub: { fontSize: 14, color: colors.muted },
});
