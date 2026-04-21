import React, { useState } from 'react';
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radius } from '../../lib/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'winner';

export type ButtonProps = Omit<PressableProps, 'style'> & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  variant = 'primary',
  loading,
  disabled,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      {...rest}
    >
      <View
        style={[
          styles.base,
          variantStyles[variant].container,
          pressed && !isDisabled && styles.pressed,
          isDisabled && styles.disabled,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variantStyles[variant].label.color}
          />
        ) : (
          <Text style={[styles.label, variantStyles[variant].label]}>
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.4 },
});

const variantStyles: Record<
  Variant,
  { container: ViewStyle; label: { color: string } }
> = {
  primary: {
    container: { backgroundColor: colors.teal },
    label: { color: '#FFFFFF' },
  },
  secondary: {
    container: {
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
    },
    label: { color: colors.ink },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    label: { color: colors.tealDeep },
  },
  winner: {
    container: { backgroundColor: colors.amber },
    label: { color: '#FFFFFF' },
  },
};
