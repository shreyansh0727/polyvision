// src/components/photos/VisitCard.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { VisitPhoto } from '../../types';
import Badge from '../shared/Badge';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ── Time helper ───────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ── Full-screen image lightbox ────────────────────────────────────
function Lightbox({
  uri,
  visible,
  onClose,
}: {
  uri:     string;
  visible: boolean;
  onClose: () => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue:         visible ? 1 : 0,
      duration:        200,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[lightboxStyles.overlay, { opacity: fadeAnim }]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        {/* Full-size image */}
        <Image
          source={{ uri }}
          style={lightboxStyles.image}
          resizeMode="contain"
        />

        {/* Close button */}
        <TouchableOpacity
          style={lightboxStyles.closeBtn}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={lightboxStyles.closeIcon}>✕</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const lightboxStyles = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  image:    { width: SCREEN_W, height: SCREEN_H * 0.75 },
  closeBtn: { position: 'absolute', top: 52, right: 20, backgroundColor: 'rgba(255,255,255,0.15)', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  closeIcon:{ fontSize: 16, color: '#fff', fontWeight: '700' },
});

// ── Main VisitCard ────────────────────────────────────────────────
interface Props {
  item:       VisitPhoto;
  showEmployee?: boolean;   // admin view — show employee name
}

export default function VisitCard({ item, showEmployee = false }: Props) {
  const [imgError,   setImgError]   = useState(false);
  const [lightbox,   setLightbox]   = useState(false);
  const pressScale = useRef(new Animated.Value(1)).current;

  // Tap animation
  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.97, friction: 8, useNativeDriver: true,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1, friction: 8, useNativeDriver: true,
    }).start();
  };

  return (
    <>
      <Animated.View style={{ transform: [{ scale: pressScale }] }}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => !imgError && setLightbox(true)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
        >
          {/* ── Thumbnail ── */}
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
              <Text style={styles.thumbFallbackText}>Image unavailable</Text>
            </View>
          )}

          {/* ── Content ── */}
          <View style={styles.content}>

            {/* Caption */}
            <Text
              style={styles.caption}
              numberOfLines={2}
            >
              {item.caption || 'No caption'}
            </Text>

            {/* Employee name — admin view only */}
            {showEmployee && item.employee_name && (
              <View style={styles.employeeRow}>
                <Text style={styles.employeeIcon}>👤</Text>
                <Text style={styles.employeeName}>{item.employee_name}</Text>
              </View>
            )}

            {/* GPS + time row */}
            <View style={styles.metaRow}>
              <Text style={styles.coords}>
                📍 {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
              </Text>
            </View>

            {/* Footer: time + tap hint */}
            <View style={styles.footer}>
              <Text style={styles.time}>{timeAgo(item.uploaded_at)}</Text>
              {!imgError && (
                <Badge label="Tap to view" color="teal" size="sm" />
              )}
            </View>

          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Full-screen lightbox */}
      <Lightbox
        uri={item.photo_url}
        visible={lightbox}
        onClose={() => setLightbox(false)}
      />
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius:    14,
    flexDirection:   'row',
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOpacity:   0.06,
    shadowRadius:    8,
    shadowOffset:    { width: 0, height: 2 },
    elevation:       2,
  },

  // Thumbnail
  thumb: { width: 100, height: 110 },
  thumbFallback: {
    width:           100,
    height:          110,
    backgroundColor: '#f3f0ec',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             4,
  },
  thumbFallbackIcon: { fontSize: 28 },
  thumbFallbackText: { fontSize: 10, color: '#bab9b4', textAlign: 'center', paddingHorizontal: 4 },

  // Content
  content:     { flex: 1, padding: 12, gap: 5, justifyContent: 'center' },
  caption:     { fontSize: 13, fontWeight: '600', color: '#28251d', lineHeight: 18 },

  // Employee row (admin)
  employeeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  employeeIcon:{ fontSize: 11 },
  employeeName:{ fontSize: 12, color: '#7a7974', fontWeight: '500' },

  // Meta
  metaRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coords:    { fontSize: 11, color: '#7a7974', fontFamily: 'monospace', flex: 1 },

  // Footer
  footer:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  time:      { fontSize: 11, color: '#bab9b4' },
});