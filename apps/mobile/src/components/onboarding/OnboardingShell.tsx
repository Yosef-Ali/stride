import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../lib/tokens';

export function ProgressDots({
  step,
  total = 5,
}: {
  step: number;
  total?: number;
}) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }).map((_, i) => {
        const on = i < step;
        const cur = i === step - 1;
        return (
          <View
            key={i}
            style={{
              width: cur ? 18 : 6,
              height: 6,
              borderRadius: 999,
              backgroundColor: on ? colors.teal : '#DDDDD8',
            }}
          />
        );
      })}
    </View>
  );
}

export function Heading({ children }: { children: React.ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

export function Sub({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sub}>{children}</Text>;
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function PrimaryCTA({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
    >
      <View
        style={[
          styles.cta,
          { backgroundColor: disabled ? '#C8D8D2' : colors.teal },
        ]}
      >
        <Text style={styles.ctaLabel}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function LinkCTA({
  label,
  muted,
  onPress,
}: {
  label: string;
  muted?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.linkWrap}>
      <Text style={[styles.link, { color: muted ? colors.muted : colors.tealDeep }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function OnboardingShell({
  step,
  children,
  footer,
  contentStyle,
}: {
  step: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
  contentStyle?: ViewStyle;
}) {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ProgressDots step={step} />
        <View style={[styles.content, contentStyle]}>{children}</View>
        {footer && <View style={styles.footer}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 14,
  },
  content: { flex: 1, paddingHorizontal: 28 },
  footer: { paddingHorizontal: 22, paddingBottom: 12 },
  heading: {
    fontSize: 30,
    fontWeight: '500',
    letterSpacing: -0.9,
    lineHeight: 35,
    color: colors.ink,
  },
  sub: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  cta: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  linkWrap: { paddingVertical: 10, alignItems: 'center' },
  link: { fontSize: 14, letterSpacing: 0.1 },
});
