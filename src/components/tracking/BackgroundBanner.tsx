// src/components/tracking/BackgroundBanner.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MC, MF } from '../../navigation/AppTheme';

export default function BackgroundBanner() {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>📡 Tracking in background</Text>
      <Text style={styles.sub}>Keep the app installed and permissions granted</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: MC.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: MC.border,
  },
  text: {
    fontSize: 12,
    color: MC.green,
    fontWeight: '700',
    fontFamily: MF.mono,
    letterSpacing: 0.5,
  },
  sub: {
    marginTop: 2,
    fontSize: 10,
    color: MC.textSub,
    fontFamily: MF.mono,
  },
});