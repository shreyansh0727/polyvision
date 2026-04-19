// src/components/visit/CaptionInput.tsx
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { MC, MF } from '../../navigation/AppTheme';

interface Props {
  value:        string;
  onChangeText: (v: string) => void;
  editable:     boolean;
  maxLength?:   number;
}

export default function CaptionInput({
  value,
  onChangeText,
  editable,
  maxLength = 200,
}: Props) {
  const remaining = maxLength - value.length;

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>Caption (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Meeting with client at office"
        placeholderTextColor={MC.textFaint}
        value={value}
        onChangeText={onChangeText}
        multiline
        numberOfLines={3}
        maxLength={maxLength}
        editable={editable}
        textAlignVertical="top"
      />
      <Text style={styles.charCount}>
        {remaining} chars left
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldGroup: { gap: 6 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: MC.textSub,
    fontFamily: MF.mono,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: MC.border,
    borderTopColor: MC.borderBright,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: MC.surface,
    fontSize: 14,
    color: MC.textPrimary,
    fontFamily: MF.mono,
    minHeight: 84,
  },
  charCount: {
    fontSize: 10,
    color: MC.textFaint,
    textAlign: 'right',
    fontFamily: MF.mono,
  },
});