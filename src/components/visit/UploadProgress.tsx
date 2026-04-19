// src/components/visit/UploadProgress.tsx
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { MC, MF } from '../../navigation/AppTheme';

interface Props {
  step: string;
}

export default function UploadProgress({ step }: Props) {
  return (
    <View style={styles.box}>
      <ActivityIndicator size="small" color={MC.green} />
      <View style={styles.textWrap}>
        <Text style={styles.label}>UPLOAD STATUS</Text>
        <Text style={styles.text}>{step}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: MC.surfaceAlt,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MC.border,
    borderTopColor: MC.borderBright,
  },
  textWrap: {
    flex: 1,
  },
  label: {
    fontSize: 9,
    color: MC.textFaint,
    fontWeight: '800',
    fontFamily: MF.mono,
    letterSpacing: 1.4,
    marginBottom: 2,
  },
  text: {
    fontSize: 12,
    color: MC.green,
    fontWeight: '700',
    fontFamily: MF.mono,
  },
});