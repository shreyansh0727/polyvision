// src/components/shared/EmptyState.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Button from './Button';

type Size = 'sm' | 'md' | 'lg';

interface Props {
  icon:          string;    // emoji icon
  title:         string;
  subtitle?:     string;
  actionLabel?:  string;   // primary CTA button label
  onAction?:     () => void;
  secondaryLabel?:  string;   // optional second button
  onSecondary?:     () => void;
  size?:         Size;
  style?:        ViewStyle;
}

export default function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  size  = 'md',
  style,
}: Props) {
  return (
    <View style={[styles.container, styles[`size_${size}`], style]}>

      {/* ── Icon ── */}
      <View style={[styles.iconCircle, styles[`iconCircle_${size}`]]}>
        <Text style={styles[`iconText_${size}`]}>{icon}</Text>
      </View>

      {/* ── Text ── */}
      <View style={styles.textGroup}>
        <Text style={[styles.title, styles[`title_${size}`]]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.subtitle, styles[`subtitle_${size}`]]}>
            {subtitle}
          </Text>
        )}
      </View>

      {/* ── Actions ── */}
      {(actionLabel && onAction) && (
        <View style={styles.actions}>
          <Button
            label={actionLabel}
            onPress={onAction}
            variant="primary"
            size={size === 'sm' ? 'sm' : 'md'}
            style={styles.actionBtn}
          />
          {secondaryLabel && onSecondary && (
            <Button
              label={secondaryLabel}
              onPress={onSecondary}
              variant="ghost"
              size={size === 'sm' ? 'sm' : 'md'}
              style={styles.actionBtn}
            />
          )}
        </View>
      )}

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },

  // Container padding by size
  size_sm: { paddingVertical: 24, paddingHorizontal: 16 },
  size_md: { paddingVertical: 40, paddingHorizontal: 24 },
  size_lg: { paddingVertical: 64, paddingHorizontal: 32 },

  // Icon circle
  iconCircle: {
    backgroundColor: '#f3f0ec',
    borderRadius:    999,
    alignItems:      'center',
    justifyContent:  'center',
  },
  iconCircle_sm: { width: 56, height: 56 },
  iconCircle_md: { width: 72, height: 72 },
  iconCircle_lg: { width: 96, height: 96 },

  // Icon text size
  iconText_sm: { fontSize: 24 },
  iconText_md: { fontSize: 32 },
  iconText_lg: { fontSize: 44 },

  // Text group
  textGroup: { alignItems: 'center', gap: 6 },

  title: { fontWeight: '700', color: '#28251d', textAlign: 'center' },
  title_sm: { fontSize: 14 },
  title_md: { fontSize: 16 },
  title_lg: { fontSize: 20 },

  subtitle: { color: '#7a7974', textAlign: 'center' },
  subtitle_sm: { fontSize: 12, maxWidth: 220 },
  subtitle_md: { fontSize: 13, maxWidth: 260 },
  subtitle_lg: { fontSize: 15, maxWidth: 300 },

  // Buttons
  actions:   { gap: 10, alignItems: 'center', width: '100%' },
  actionBtn: { paddingHorizontal: 32 },
});