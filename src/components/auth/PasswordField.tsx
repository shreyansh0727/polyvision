// src/components/auth/PasswordField.tsx
import React, { forwardRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  TextInput as TextInputType,
} from 'react-native';

interface Props extends TextInputProps {
  label: string;
  error?: string;
}

// forwardRef lets LoginScreen focus this field from the email "next" key
const PasswordField = forwardRef<TextInputType, Props>(
  ({ label, error, ...rest }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{label}</Text>

        <View style={styles.passwordRow}>
          <TextInput
            ref={ref}
            style={[styles.input, styles.passwordInput, error ? styles.inputError : null]}
            placeholderTextColor="#bab9b4"
            secureTextEntry={!visible}
            returnKeyType="done"
            {...rest}
          />

          {/* Show / Hide toggle */}
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setVisible((v) => !v)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
          >
            <Text style={styles.eyeIcon}>{visible ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    );
  }
);

PasswordField.displayName = 'PasswordField';
export default PasswordField;

const styles = StyleSheet.create({
  fieldGroup:    { marginBottom: 16 },
  label:         { fontSize: 13, fontWeight: '600', color: '#28251d', marginBottom: 6 },
  passwordRow:   { position: 'relative' },
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
  passwordInput: { paddingRight: 48 },  // room for eye button
  inputError:    { borderColor: '#a12c7b' },
  eyeButton: {
    position: 'absolute', right: 14,
    top: 0, bottom: 0, justifyContent: 'center',
  },
  eyeIcon:       { fontSize: 18 },
  errorText:     { fontSize: 12, color: '#a12c7b', marginTop: 4, marginLeft: 2 },
});