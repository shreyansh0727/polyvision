// src/components/shared/Button.tsx
import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size    = 'sm' | 'md' | 'lg';

interface Props {
  label:      string;
  onPress:    () => void;
  variant?:   Variant;
  size?:      Size;
  loading?:   boolean;
  disabled?:  boolean;
  fullWidth?: boolean;
  leftIcon?:  string;   // emoji icon before label
  rightIcon?: string;   // emoji icon after label
  style?:     ViewStyle;
  textStyle?: TextStyle;
}

export default function Button({
  label,
  onPress,
  variant   = 'primary',
  size      = 'md',
  loading   = false,
  disabled  = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
}: Props) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.82}
    >
      {loading ? (
        // Spinner — colour matches variant
        <ActivityIndicator
          size="small"
          color={variant === 'secondary' || variant === 'ghost'
            ? '#01696f'
            : '#fff'
          }
        />
      ) : (
        <>
          {leftIcon  && <Text style={styles.icon}>{leftIcon}</Text>}
          <Text style={[
            styles.label,
            styles[`${variant}_label`],
            styles[`size_${size}_label`],
            textStyle,
          ]}>
            {label}
          </Text>
          {rightIcon && <Text style={styles.icon}>{rightIcon}</Text>}
        </>
      )}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Base — shared across all variants
  base: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   12,
    gap:            6,
  },
  fullWidth: { width: '100%' },
  disabled:  { opacity: 0.55 },

  // ── Variants ──────────────────────────────
  primary: {
    backgroundColor: '#01696f',
  },
  secondary: {
    backgroundColor: '#f3f0ec',
    borderWidth:     1,
    borderColor:     '#d4d1ca',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth:     1,
    borderColor:     '#01696f',
  },
  danger: {
    backgroundColor: '#a12c7b',
  },

  // ── Variant label colours ─────────────────
  primary_label:   { color: '#fff' },
  secondary_label: { color: '#28251d' },
  ghost_label:     { color: '#01696f' },
  danger_label:    { color: '#fff' },

  // ── Sizes — padding ───────────────────────
  size_sm: { paddingVertical: 8,  paddingHorizontal: 14 },
  size_md: { paddingVertical: 13, paddingHorizontal: 20 },
  size_lg: { paddingVertical: 17, paddingHorizontal: 28 },

  // ── Sizes — label font ────────────────────
  size_sm_label: { fontSize: 13, fontWeight: '600' },
  size_md_label: { fontSize: 15, fontWeight: '700' },
  size_lg_label: { fontSize: 17, fontWeight: '700' },

  // ── Icon ──────────────────────────────────
  icon:  { fontSize: 16 },

  // Base label (fallback)
  label: { fontWeight: '700' },
});