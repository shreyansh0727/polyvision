// src/components/visit/VisitCard.tsx
import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { VisitPhoto } from '../../types';
import { MC, MF } from '../../navigation/AppTheme';

// ── Relative time helper ──────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString('en-IN');
}

interface Props {
  item: VisitPhoto;
}

export default function VisitCard({ item }: Props) {
  const [imgError, setImgError] = useState(false);

  return (
    <View style={styles.card}>
      {!imgError ? (
        <Image
          source={{ uri: item.photo_url }}
          style={styles.thumb}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={styles.thumbFallback}>
          <Text style={styles.thumbFallbackIcon}>🖼️</Text>
        </View>
      )}

      <View style={styles.info}>
        <Text style={styles.caption} numberOfLines={2}>
          {item.caption || 'No caption'}
        </Text>

        <Text style={styles.meta} numberOfLines={1}>
          📍 {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
        </Text>

        <Text style={styles.time}>{timeAgo(item.uploaded_at)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: MC.surface,
    borderRadius: 14,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: MC.border,
    borderTopColor: MC.borderBright,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  thumb: {
    width: 92,
    height: 92,
    backgroundColor: MC.surfaceAlt,
  },

  thumbFallback: {
    width: 92,
    height: 92,
    backgroundColor: MC.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: MC.border,
  },

  thumbFallbackIcon: {
    fontSize: 26,
  },

  info: {
    flex: 1,
    padding: 12,
    gap: 5,
    justifyContent: 'center',
  },

  caption: {
    fontSize: 13,
    fontWeight: '700',
    color: MC.textPrimary,
    fontFamily: MF.display,
  },

  meta: {
    fontSize: 11,
    color: MC.textSub,
    fontFamily: MF.mono,
  },

  time: {
    fontSize: 10,
    color: MC.textFaint,
    fontFamily: MF.mono,
    letterSpacing: 0.3,
  },
});