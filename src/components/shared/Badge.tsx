// src/components/shared/Badge.tsx
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';

type Color  = 'teal' | 'green' | 'amber' | 'red' | 'gray' | 'purple';
type Size   = 'sm' | 'md';

// ── Token maps ────────────────────────────────────────────────────
const BG: Record<Color, string> = {
  teal:   '#cedcd8',
  green:  '#d4dfcc',
  amber:  '#e9e0c6',
  red:    '#e0ced7',
  gray:   '#f3f0ec',
  purple: '#dacfde',
};

const FG: Record<Color, string> = {
  teal:   '#01696f',
  green:  '#437a22',
  amber:  '#964219',
  red:    '#561740',
  gray:   '#7a7974',
  purple: '#431673',
};

interface Props {
  label:   string;
  color?:  Color;
  size?:   Size;
  dot?:    boolean;    // show a colored dot before label
  style?:  ViewStyle;
}

export default function Badge({
  label,
  color  = 'teal',
  size   = 'md',
  dot    = false,
  style,
}: Props) {
  return (
    <View style={[
      styles.badge,
      styles[`size_${size}`],
      { backgroundColor: BG[color] },
      style,
    ]}>
      {/* Optional status dot */}
      {dot && (
        <View style={[styles.dot, { backgroundColor: FG[color] }]} />
      )}
      <Text style={[
        styles.label,
        styles[`size_${size}_label`],
        { color: FG[color] },
      ]}>
        {label}
      </Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  badge: {
    flexDirection:  'row',
    alignItems:     'center',
    alignSelf:      'flex-start',
    borderRadius:   999,
    gap:            5,
  },

  // Sizes
  size_sm: { paddingHorizontal: 8,  paddingVertical: 3 },
  size_md: { paddingHorizontal: 10, paddingVertical: 5 },

  // Label sizes
  size_sm_label: { fontSize: 11, fontWeight: '600' },
  size_md_label: { fontSize: 12, fontWeight: '600' },

  // Dot
  dot: { width: 6, height: 6, borderRadius: 3 },

  label: { fontWeight: '600' },
});