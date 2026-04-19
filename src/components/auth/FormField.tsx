// src/components/auth/FormField.tsx
import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
} from 'react-native';

interface Props extends TextInputProps {
  label: string;
  error?: string;
}

export default function FormField({ label, error, style, ...rest }: Props) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor="#bab9b4"
        {...rest}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

export const inputBase = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#d4d1ca',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#fff',
    fontSize: 15,
    color: '#28251d',
  },
  inputError: { borderColor: '#a12c7b' },
});

const styles = StyleSheet.create({
  fieldGroup: { marginBottom: 16 },
  label:      { fontSize: 13, fontWeight: '600', color: '#28251d', marginBottom: 6 },
  ...inputBase,
  errorText:  { fontSize: 12, color: '#a12c7b', marginTop: 4, marginLeft: 2 },
});