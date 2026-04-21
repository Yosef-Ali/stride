import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../lib/tokens';

export type BarChartDatum = {
  label: string;
  value: number;
  highlighted?: boolean;
};

export type BarChartProps = {
  data: BarChartDatum[];
  height?: number;
  color?: string;
  trackColor?: string;
  highlightColor?: string;
  showLabels?: boolean;
};

export function BarChart({
  data,
  height = 140,
  color = colors.teal,
  trackColor = colors.lineSoft,
  highlightColor,
  showLabels = true,
}: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <View style={styles.wrap}>
      <View style={[styles.bars, { height }]}>
        {data.map((d, i) => {
          const ratio = d.value / max;
          const barColor = d.highlighted ? highlightColor ?? color : color;
          const fillHeight = Math.max(3, Math.round(height * ratio));
          return (
            <View key={`${d.label}-${i}`} style={styles.col}>
              <View
                style={[
                  styles.track,
                  { height, backgroundColor: trackColor },
                ]}
              >
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: fillHeight,
                    backgroundColor: barColor,
                    borderRadius: 4,
                    opacity: d.highlighted ? 1 : 0.9,
                  }}
                />
              </View>
            </View>
          );
        })}
      </View>
      {showLabels && (
        <View style={styles.labels}>
          {data.map((d, i) => (
            <Text
              key={`lbl-${i}`}
              style={[
                styles.label,
                d.highlighted && { color: colors.ink, fontWeight: '500' },
              ]}
            >
              {d.label}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  col: { flex: 1 },
  track: {
    width: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  labels: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 10,
  },
  label: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    color: colors.faint,
    letterSpacing: 0.2,
  },
});
