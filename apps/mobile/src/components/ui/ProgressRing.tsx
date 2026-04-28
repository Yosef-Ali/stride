import React from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../../lib/tokens';

export type ProgressRingProps = {
  size?: number;
  stroke?: number;
  value?: number;
  color?: string;
  /** Arc color used for the portion past 100% (when value > 1). */
  overColor?: string;
  track?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
};

export function ProgressRing({
  size = 200,
  stroke = 13,
  value = 0,
  color = colors.teal,
  overColor = colors.amber,
  track = '#EEEEEA',
  children,
  style,
}: ProgressRingProps) {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  // Base arc fills the first lap; once past goal the base ring becomes the
  // "completed" track and the overflow arc rides on top in an accent color.
  const isOver = safe > 1;
  const baseFill = isOver ? 1 : safe;
  // Cap the visible overflow at one full extra lap so a runaway day can't
  // visually wrap around again — a single accent ring + numeric caption is
  // enough signal.
  const overFill = isOver ? Math.min(1, safe - 1) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg
        width={size}
        height={size}
        style={{ transform: [{ rotate: '-90deg' }] }}
      >
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={track}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - baseFill)}
          strokeLinecap="round"
        />
        {overFill > 0 && (
          <Circle
            cx={center}
            cy={center}
            r={r}
            stroke={overColor}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - overFill)}
            strokeLinecap="round"
          />
        )}
      </Svg>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </View>
  );
}
