import React from 'react';
import { View, StyleSheet, type ViewProps } from 'react-native';
import { colors, radius } from '../../lib/tokens';

export type CardProps = ViewProps & {
  bordered?: boolean;
  padded?: boolean;
};

export function Card({
  bordered = false,
  padded = true,
  style,
  children,
  ...rest
}: CardProps) {
  return (
    <View
      style={[
        styles.base,
        padded && styles.padded,
        bordered && styles.bordered,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
  },
  padded: {
    padding: 16,
  },
  bordered: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
});
