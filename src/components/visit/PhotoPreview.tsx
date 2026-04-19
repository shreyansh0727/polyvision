// src/components/visit/PhotoPreview.tsx
import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { MC, MF } from '../../navigation/AppTheme';

interface Props {
  uri: string;
}

export default function PhotoPreview({ uri }: Props) {
  return (
    <View style={styles.container}>
      <Image
        source={{ uri }}
        style={styles.image}
        resizeMode="cover"
      />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>✅ Uploaded</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: MC.border,
    backgroundColor: MC.surfaceAlt,
  },
  image: {
    width: '100%',
    height: 200,
  },
  badge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: MC.green,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: MC.greenGlow,
  },
  badgeText: {
    color: MC.bg,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: MF.mono,
    letterSpacing: 0.4,
  },
});