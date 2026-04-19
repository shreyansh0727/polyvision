// src/components/shared/ErrorBox.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ViewStyle,
} from 'react-native';

type Severity = 'error' | 'warning' | 'info';

// ── Token maps ────────────────────────────────────────────────────
const COLORS: Record<Severity, {
  bg:     string;
  border: string;
  text:   string;
  muted:  string;
  icon:   string;
}> = {
  error: {
    bg:     '#e0ced7',
    border: '#c9b0be',
    text:   '#561740',
    muted:  '#7a3060',
    icon:   '⚠️',
  },
  warning: {
    bg:     '#e9e0c6',
    border: '#d4c9a8',
    text:   '#4b2614',
    muted:  '#713417',
    icon:   '🔔',
  },
  info: {
    bg:     '#cedcd8',
    border: '#b0ceca',
    text:   '#0f3638',
    muted:  '#1a626b',
    icon:   'ℹ️',
  },
};

interface Props {
  message:     string;
  severity?:   Severity;
  dismissible?: boolean;          // show tap-to-dismiss hint
  onDismiss?:  () => void;        // called on tap or auto-dismiss
  autoDismiss?: number;           // ms — auto dismiss after N ms
  action?: {                      // optional inline action button
    label:   string;
    onPress: () => void;
  };
  style?:      ViewStyle;
}

export default function ErrorBox({
  message,
  severity     = 'error',
  dismissible  = true,
  onDismiss,
  autoDismiss,
  action,
  style,
}: Props) {
  const colors   = COLORS[severity];

  // ── Slide-in animation ────────────────────────────────────────
  const slideY   = useRef(new Animated.Value(-12)).current;
  const opacity  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(slideY, {
        toValue:         0,
        duration:        220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue:         1,
        duration:        220,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss timer
    if (autoDismiss && onDismiss) {
      const id = setTimeout(onDismiss, autoDismiss);
      return () => clearTimeout(id);
    }
  }, []);

  const handleDismiss = () => {
    // Animate out before calling onDismiss
    Animated.parallel([
      Animated.timing(slideY, {
        toValue:         -8,
        duration:        160,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue:         0,
        duration:        160,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss?.());
  };

  return (
    <Animated.View
      style={[
        styles.box,
        {
          backgroundColor: colors.bg,
          borderColor:     colors.border,
          transform:       [{ translateY: slideY }],
          opacity,
        },
        style,
      ]}
    >
      {/* ── Main row ── */}
      <View style={styles.row}>

        {/* Icon */}
        <Text style={styles.icon}>{colors.icon}</Text>

        {/* Message + dismiss hint */}
        <View style={styles.textGroup}>
          <Text style={[styles.message, { color: colors.text }]}>
            {message}
          </Text>
          {dismissible && onDismiss && (
            <Text style={[styles.hint, { color: colors.muted }]}>
              Tap to dismiss
            </Text>
          )}
        </View>

        {/* Dismiss X button */}
        {onDismiss && (
          <TouchableOpacity
            onPress={handleDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.closeBtn}
          >
            <Text style={[styles.closeIcon, { color: colors.muted }]}>✕</Text>
          </TouchableOpacity>
        )}

      </View>

      {/* ── Optional inline action button ── */}
      {action && (
        <TouchableOpacity
          onPress={action.onPress}
          style={[styles.actionBtn, { borderColor: colors.border }]}
          activeOpacity={0.75}
        >
          <Text style={[styles.actionLabel, { color: colors.text }]}>
            {action.label}
          </Text>
        </TouchableOpacity>
      )}

    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  box: {
    borderRadius: 10,
    borderWidth:  1,
    padding:      12,
    gap:          10,
  },

  // Main content row
  row: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           10,
  },

  icon:      { fontSize: 16, marginTop: 1 },

  textGroup: { flex: 1, gap: 2 },
  message:   { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  hint:      { fontSize: 11 },

  closeBtn:  { paddingLeft: 4 },
  closeIcon: { fontSize: 14, fontWeight: '700' },

  // Inline action
  actionBtn: {
    alignSelf:      'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius:   8,
    borderWidth:    1,
    marginLeft:     26,   // align with message text (past icon)
  },
  actionLabel: { fontSize: 12, fontWeight: '700' },
});