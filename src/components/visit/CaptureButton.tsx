// src/components/visit/CaptureButton.tsx
import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { MC, MF } from '../../navigation/AppTheme';

interface Props {
  loading: boolean;
  onPress: () => void;
}

export default function CaptureButton({ loading, onPress }: Props) {
  return (
    <TouchableOpacity
      style={[styles.button, loading && styles.buttonDisabled]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel="Capture and upload visit photo"
      accessibilityState={{ busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={MC.bg} size="small" />
      ) : (
        <Text style={styles.buttonText}>📷 Capture & Upload</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: MC.green,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: MC.greenGlow,
    shadowColor: MC.green,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 9,
  },
  buttonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: MC.bg,
    fontWeight: '800',
    fontSize: 15,
    fontFamily: MF.mono,
    letterSpacing: 0.6,
  },
});