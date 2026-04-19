// src/components/tracking/ShiftTimer.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MC, MF } from '../../navigation/AppTheme';

interface Props {
  seconds: number;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export default function ShiftTimer({ seconds }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Shift Duration</Text>
      <Text style={styles.timerText}>{formatDuration(seconds)}</Text>
      <Text style={styles.timerLabel}>HH : MM : SS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: MC.surface,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    borderWidth: 1,
    borderColor: MC.border,
    borderTopColor: MC.borderBright,
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: MC.textSub,
    fontFamily: MF.mono,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  timerText: {
    marginTop: 2,
    fontSize: 34,
    fontWeight: '800',
    color: MC.green,
    textAlign: 'center',
    letterSpacing: 3,
    fontFamily: MF.mono,
  },
  timerLabel: {
    fontSize: 10,
    color: MC.textFaint,
    textAlign: 'center',
    letterSpacing: 4,
    marginTop: -2,
    fontFamily: MF.mono,
  },
});