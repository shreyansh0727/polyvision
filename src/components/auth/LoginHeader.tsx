// src/components/auth/LoginHeader.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  icon:     string;
  title:    string;
  subtitle: string;
}

export default function LoginHeader({ icon, title, subtitle }: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.logoCircle}>
        <Text style={styles.logoIcon}>{icon}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header:     { alignItems: 'center', marginBottom: 40 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#cedcd8',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  logoIcon:   { fontSize: 32 },
  title:      { fontSize: 26, fontWeight: '700', color: '#28251d', marginBottom: 6 },
  subtitle:   { fontSize: 14, color: '#7a7974' },
});