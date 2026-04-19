// src/components/shared/StatusPill.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ViewStyle,
} from 'react-native';

type Size    = 'sm' | 'md';
type Variant = 'tracking' | 'online' | 'shift' | 'custom';

// ── Preset variants ───────────────────────────────────────────────
const PRESETS: Record<Variant, {
  activeLabel:   string;
  inactiveLabel: string;
  activeBg:      string;
  inactiveBg:    string;
  activeColor:   string;
  inactiveColor: string;
  activeDot:     string;
  inactiveDot:   string;
}> = {
  tracking: {
    activeLabel:   'Active — location is being shared',
    inactiveLabel: 'Inactive — tap to start your shift',
    activeBg:      '#cedcd8',
    inactiveBg:    '#f3f0ec',
    activeColor:   '#01696f',
    inactiveColor: '#7a7974',
    activeDot:     '#01696f',
    inactiveDot:   '#bab9b4',
  },
  online: {
    activeLabel:   'Online',
    inactiveLabel: 'Offline',
    activeBg:      '#d4dfcc',
    inactiveBg:    '#f3f0ec',
    activeColor:   '#437a22',
    inactiveColor: '#7a7974',
    activeDot:     '#437a22',
    inactiveDot:   '#bab9b4',
  },
  shift: {
    activeLabel:   'On Shift',
    inactiveLabel: 'Off Shift',
    activeBg:      '#cedcd8',
    inactiveBg:    '#f3f0ec',
    activeColor:   '#01696f',
    inactiveColor: '#7a7974',
    activeDot:     '#01696f',
    inactiveDot:   '#bab9b4',
  },
  custom: {
    activeLabel:   'Active',
    inactiveLabel: 'Inactive',
    activeBg:      '#cedcd8',
    inactiveBg:    '#f3f0ec',
    activeColor:   '#01696f',
    inactiveColor: '#7a7974',
    activeDot:     '#01696f',
    inactiveDot:   '#bab9b4',
  },
};

interface Props {
  active:         boolean;
  variant?:       Variant;
  activeLabel?:   string;    // override preset label
  inactiveLabel?: string;    // override preset label
  size?:          Size;
  pulse?:         boolean;   // pulsing dot animation when active
  style?:         ViewStyle;
}

export default function StatusPill({
  active,
  variant       = 'tracking',
  activeLabel,
  inactiveLabel,
  size          = 'md',
  pulse         = true,
  style,
}: Props) {
  const preset = PRESETS[variant];

  // Override labels if provided
  const label = active
    ? (activeLabel   ?? preset.activeLabel)
    : (inactiveLabel ?? preset.inactiveLabel);

  const bg    = active ? preset.activeBg    : preset.inactiveBg;
  const color = active ? preset.activeColor : preset.inactiveColor;
  const dot   = active ? preset.activeDot   : preset.inactiveDot;

  // ── Pulse animation on active dot ──────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active || !pulse) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue:         1.6,
          duration:        900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue:         1,
          duration:        900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  return (
    <View style={[
      styles.pill,
      styles[`size_${size}`],
      { backgroundColor: bg },
      style,
    ]}>

      {/* ── Dot with optional pulse ring ── */}
      <View style={styles.dotWrapper}>
        {/* Pulse ring — only when active */}
        {active && pulse && (
          <Animated.View
            style={[
              styles.pulseRing,
              {
                backgroundColor: dot,
                transform: [{ scale: pulseAnim }],
                opacity: pulseAnim.interpolate({
                  inputRange:  [1, 1.6],
                  outputRange: [0.4, 0],
                }),
              },
            ]}
          />
        )}
        {/* Solid dot */}
        <View style={[
          styles.dot,
          styles[`dot_${size}`],
          { backgroundColor: dot },
        ]} />
      </View>

      {/* ── Label ── */}
      <Text style={[
        styles.label,
        styles[`label_${size}`],
        { color },
      ]}>
        {label}
      </Text>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems:    'center',
    borderRadius:  10,
    gap:           8,
  },

  // Sizes
  size_sm: { padding: 8  },
  size_md: { padding: 10 },

  // Dot wrapper (positions pulse ring behind dot)
  dotWrapper: {
    width:          16,
    height:         16,
    alignItems:     'center',
    justifyContent: 'center',
  },

  // Pulse ring
  pulseRing: {
    position:     'absolute',
    width:         14,
    height:        14,
    borderRadius:  7,
  },

  // Solid dot
  dot:    { borderRadius: 999 },
  dot_sm: { width: 6, height: 6 },
  dot_md: { width: 8, height: 8 },

  // Label
  label:       { flex: 1, fontWeight: '500' },
  label_sm:    { fontSize: 12 },
  label_md:    { fontSize: 13 },
});