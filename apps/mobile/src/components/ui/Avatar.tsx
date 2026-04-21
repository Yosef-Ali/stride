import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { colors } from '../../lib/tokens';

export type AvatarProps = {
  initials: string;
  color?: string;
  size?: number;
  ring?: boolean;
};

export function Avatar({
  initials,
  color = colors.teal,
  size = 40,
  ring = false,
}: AvatarProps) {
  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderWidth: ring ? 2 : 0,
          borderColor: ring ? '#FFFFFF' : 'transparent',
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          { fontSize: Math.max(10, Math.round(size * 0.36)) },
        ]}
      >
        {initials.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

export type AvatarStackProps = {
  members: { initials: string; color?: string }[];
  extra?: number;
  size?: number;
};

export function AvatarStack({ members, extra = 0, size = 28 }: AvatarStackProps) {
  const overlap = Math.round(size * 0.28);
  return (
    <View style={styles.row}>
      {members.map((m, i) => (
        <View
          key={`${m.initials}-${i}`}
          style={{
            marginLeft: i === 0 ? 0 : -overlap,
            zIndex: members.length - i,
          } as ViewStyle}
        >
          <Avatar initials={m.initials} color={m.color} size={size} ring />
        </View>
      ))}
      {extra > 0 && (
        <View
          style={{
            marginLeft: -overlap,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: '#E6E6E0',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: '#FFFFFF',
          }}
        >
          <Text
            style={{
              fontSize: Math.max(10, Math.round(size * 0.36)),
              color: colors.muted,
              fontWeight: '500',
            }}
          >
            +{extra}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  label: { color: '#FFFFFF', fontWeight: '500', letterSpacing: 0.3 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
