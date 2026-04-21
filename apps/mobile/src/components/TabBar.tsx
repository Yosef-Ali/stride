import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors } from '../lib/tokens';

type IconKey = 'home' | 'circle' | 'stats' | 'me';

const Icons: Record<IconKey, React.FC<{ color: string; strokeWidth: number }>> =
  {
    home: ({ color, strokeWidth }) => (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d="M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1V11z"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    ),
    circle: ({ color, strokeWidth }) => (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Circle cx={9} cy={9} r={3.2} stroke={color} strokeWidth={strokeWidth} />
        <Circle
          cx={17}
          cy={10}
          r={2.6}
          stroke={color}
          strokeWidth={strokeWidth}
        />
        <Path
          d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <Path
          d="M14.5 20c.2-2.6 2.2-4.6 4.5-4.8"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      </Svg>
    ),
    stats: ({ color, strokeWidth }) => (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 20V10 M10 20V4 M16 20v-8 M22 20H2"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      </Svg>
    ),
    me: ({ color, strokeWidth }) => (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={strokeWidth} />
        <Path
          d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      </Svg>
    ),
  };

const LABELS: Record<IconKey, string> = {
  home: 'Home',
  circle: 'Circle',
  stats: 'Stats',
  me: 'Me',
};

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(10, insets.bottom), paddingTop: 10 },
      ]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const key = route.name as IconKey;
        const Icon = Icons[key];
        const color = focused ? colors.teal : colors.faint;
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityLabel={LABELS[key]}
            onPress={onPress}
            style={styles.item}
          >
            <Icon color={color} strokeWidth={focused ? 2 : 1.6} />
            <Text
              style={[
                styles.label,
                { color, fontWeight: focused ? '500' : '400' },
              ]}
            >
              {LABELS[key]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  item: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  label: { fontSize: 10, letterSpacing: 0.1 },
});
