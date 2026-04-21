import './global.css';
import React from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  Avatar,
  AvatarStack,
  BarChart,
  Button,
  Card,
  ProgressRing,
} from './src/components/ui';
import { colors, type } from './src/lib/tokens';

const weekly = [
  { label: 'M', value: 5.2 },
  { label: 'T', value: 6.1 },
  { label: 'W', value: 8.8 },
  { label: 'T', value: 4.9 },
  { label: 'F', value: 7.3, highlighted: true },
  { label: 'S', value: 9.1 },
  { label: 'S', value: 6.3 },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.canvas} />
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.h1}>Stride · primitives</Text>
          <Text style={styles.sub}>Step 1 · design tokens and base UI</Text>

          <Eyebrow>Buttons</Eyebrow>
          <View style={{ gap: 10 }}>
            <Button label="Continue" variant="primary" />
            <Button label="See full results" variant="secondary" />
            <Button label="View your badge" variant="ghost" />
            <Button label="Share with circle" variant="winner" />
            <Button label="Loading" variant="primary" loading />
            <Button label="Disabled" variant="primary" disabled />
          </View>

          <Eyebrow>Cards</Eyebrow>
          <View style={{ gap: 10 }}>
            <Card>
              <Text style={styles.body}>Flat card · default surface</Text>
            </Card>
            <Card bordered>
              <Text style={styles.body}>Bordered card · hairline outline</Text>
            </Card>
          </View>

          <Eyebrow>Avatars</Eyebrow>
          <View style={styles.rowWrap}>
            <Avatar initials="YO" size={80} />
            <Avatar initials="AS" color="#C49A6C" size={56} />
            <Avatar initials="RC" color="#8C7B9B" size={40} />
            <Avatar initials="SL" color="#D08A8A" size={28} />
          </View>
          <View style={{ marginTop: 14 }}>
            <AvatarStack
              members={[
                { initials: 'JR', color: '#C49A6C' },
                { initials: 'RC', color: '#8C7B9B' },
                { initials: 'SL', color: '#D08A8A' },
                { initials: 'BH', color: '#6E8FAE' },
              ]}
              extra={1}
            />
          </View>

          <Eyebrow>Progress ring</Eyebrow>
          <View style={{ alignItems: 'center', marginTop: 8 }}>
            <ProgressRing size={200} stroke={13} value={7.3 / 8}>
              <Text style={styles.metric}>7.3</Text>
              <Text style={styles.metricUnit}>km today</Text>
            </ProgressRing>
          </View>

          <Eyebrow>Bar chart</Eyebrow>
          <Card>
            <BarChart data={weekly} height={140} />
          </Card>

          <View style={{ height: 48 }} />
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  h1: { ...type.display, color: colors.ink },
  sub: { ...type.caption, color: colors.muted, marginBottom: 12 },
  eyebrow: {
    ...type.eyebrow,
    color: colors.muted,
    marginTop: 20,
    marginBottom: 6,
  },
  body: { ...type.body, color: colors.text },
  rowWrap: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metric: {
    fontSize: 56,
    fontWeight: '500',
    letterSpacing: -2,
    color: colors.ink,
  },
  metricUnit: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
    letterSpacing: 0.1,
  },
});
