// src/components/auth/AuthButton.tsx
import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

interface Props {
  label:    string;
  loading:  boolean;
  onPress:  () => void;
  disabled?: boolean;
}

export default function AuthButton({ label, loading, onPress, disabled }: Props) {
  return (
    <TouchableOpacity
      style={[styles.button, (loading || disabled) && styles.buttonDisabled]}
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading, disabled: loading || disabled }}
    >
      {loading
        ? <ActivityIndicator color="#fff" size="small" />
        : <Text style={styles.buttonText}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#01696f',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.65 },
  buttonText:     { color: '#fff', fontWeight: '700', fontSize: 16 },
});