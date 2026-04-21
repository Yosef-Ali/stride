import React, { useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../lib/tokens';

const MIN = 20;
const MAX = 80;

export function GoalSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const pct = (value - MIN) / (MAX - MIN);

  const handleMove = (x: number) => {
    if (width <= 0) return;
    const raw = Math.max(0, Math.min(1, x / width));
    const v = Math.round(MIN + raw * (MAX - MIN));
    if (v !== value) onChange(v);
  };

  const responder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, g) => handleMove(g.x0 - (_.nativeEvent.pageX - g.moveX)),
      onPanResponderMove: (e) => handleMove(e.nativeEvent.locationX),
    }),
  ).current;

  return (
    <View>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <Text style={styles.value}>{value}</Text>
          <Text style={styles.unit}>km / week</Text>
        </View>
        <Text style={styles.daily}>≈ {(value / 7).toFixed(1)} km a day</Text>
      </View>

      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={styles.trackRow}
        {...responder.panHandlers}
      >
        <View style={styles.track} />
        <View
          style={[
            styles.fill,
            { width: `${pct * 100}%` },
          ]}
        />
        <View
          style={[
            styles.thumb,
            { left: Math.max(0, Math.min(width - 24, pct * width - 12)) },
          ]}
        />
      </View>

      <View style={styles.scale}>
        <Text style={styles.scaleText}>{MIN}</Text>
        <Text style={styles.scaleText}>{MAX} km</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  value: {
    fontSize: 32,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -1,
  },
  unit: { fontSize: 14, color: colors.muted },
  daily: { fontSize: 12, color: colors.faint },
  trackRow: {
    position: 'relative',
    height: 24,
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#EFEFEC',
    borderRadius: 2,
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: 4,
    backgroundColor: colors.teal,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 0.5,
    borderColor: colors.line,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  scale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  scaleText: { fontSize: 11, color: colors.faint, letterSpacing: 0.2 },
});
