// src/components/photos/PhotoPreview.tsx
import React, { useRef, useEffect, useState } from 'react';
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
  Share,
  ViewStyle,
} from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ── Full-screen lightbox ──────────────────────────────────────────
function Lightbox({
  uri,
  visible,
  caption,
  onClose,
}: {
  uri:      string;
  visible:  boolean;
  caption?: string;
  onClose:  () => void;
}) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1,    duration: 220, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 0,    duration: 160, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.92, duration: 160, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleShare = async () => {
    try {
      await Share.share({ url: uri, message: caption ?? 'Visit photo' });
    } catch (_) {}
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[lbStyles.overlay, { opacity: fadeAnim }]}>

        {/* Tap backdrop to close */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        {/* Image */}
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Image
            source={{ uri }}
            style={lbStyles.image}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Caption */}
        {caption && (
          <View style={lbStyles.captionBox}>
            <Text style={lbStyles.captionText}>{caption}</Text>
          </View>
        )}

        {/* Action bar */}
        <View style={lbStyles.actionBar}>
          <TouchableOpacity
            style={lbStyles.actionBtn}
            onPress={handleShare}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={lbStyles.actionIcon}>↑</Text>
            <Text style={lbStyles.actionLabel}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={lbStyles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={lbStyles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>

      </Animated.View>
    </Modal>
  );
}

const lbStyles = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.93)', justifyContent: 'center', alignItems: 'center' },
  image:      { width: SCREEN_W, height: SCREEN_H * 0.72 },
  captionBox: { position: 'absolute', bottom: 90, left: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, padding: 12 },
  captionText:{ color: '#fff', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  actionBar:  { position: 'absolute', bottom: 36, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  actionIcon: { fontSize: 16, color: '#fff', fontWeight: '700' },
  actionLabel:{ fontSize: 13, color: '#fff', fontWeight: '600' },
  closeBtn:   { backgroundColor: 'rgba(255,255,255,0.15)', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  closeIcon:  { fontSize: 16, color: '#fff', fontWeight: '700' },
});

// ── Main PhotoPreview ─────────────────────────────────────────────
type Status = 'uploaded' | 'uploading' | 'failed';

interface Props {
  uri:       string;
  caption?:  string;
  status?:   Status;
  height?:   number;
  tappable?: boolean;    // open lightbox on tap (default true)
  style?:    ViewStyle;
}

export default function PhotoPreview({
  uri,
  caption,
  status   = 'uploaded',
  height   = 220,
  tappable = true,
  style,
}: Props) {
  const [lightbox,  setLightbox]  = useState(false);
  const [imgError,  setImgError]  = useState(false);
  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // ── Pop-in animation on mount ────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue:         1,
        friction:        7,
        tension:         100,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue:         1,
        duration:        300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // ── Status badge config ───────────────────────────────────────
  const STATUS_CONFIG: Record<Status, { label: string; bg: string; color: string }> = {
    uploaded:  { label: '✅ Uploaded',  bg: '#437a22', color: '#fff' },
    uploading: { label: '⬆️ Uploading…', bg: '#01696f', color: '#fff' },
    failed:    { label: '❌ Failed',    bg: '#a12c7b', color: '#fff' },
  };

  const badge = STATUS_CONFIG[status];

  return (
    <>
      <Animated.View
        style={[
          styles.container,
          { height },
          { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          style,
        ]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={() => tappable && !imgError && setLightbox(true)}
          activeOpacity={tappable ? 0.88 : 1}
          disabled={!tappable || imgError}
        >
          {/* ── Image ── */}
          {!imgError ? (
            <Image
              source={{ uri }}
              style={styles.image}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <View style={styles.errorState}>
              <Text style={styles.errorIcon}>🖼️</Text>
              <Text style={styles.errorText}>Could not load image</Text>
            </View>
          )}

          {/* ── Gradient overlay at bottom ── */}
          {!imgError && (
            <View style={styles.gradient} />
          )}

          {/* ── Status badge ── */}
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.statusText, { color: badge.color }]}>
              {badge.label}
            </Text>
          </View>

          {/* ── Tap hint ── */}
          {tappable && !imgError && status === 'uploaded' && (
            <View style={styles.tapHint}>
              <Text style={styles.tapHintText}>⤢ Tap to expand</Text>
            </View>
          )}

        </TouchableOpacity>
      </Animated.View>

      {/* Full-screen lightbox */}
      <Lightbox
        uri={uri}
        visible={lightbox}
        caption={caption}
        onClose={() => setLightbox(false)}
      />
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    borderRadius:    14,
    overflow:        'hidden',
    backgroundColor: '#f3f0ec',
    shadowColor:     '#000',
    shadowOpacity:   0.08,
    shadowRadius:    10,
    shadowOffset:    { width: 0, height: 3 },
    elevation:       3,
  },
  image:          { width: '100%', height: '100%' },

  // Error state
  errorState:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  errorIcon:      { fontSize: 36 },
  errorText:      { fontSize: 13, color: '#7a7974' },

  // Gradient overlay
  gradient: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    height:          80,
    backgroundColor: 'transparent',
    // Simulated gradient via opacity layers
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    // backgroundGradient is not supported in React Native styles
  },

  // Status badge
  statusBadge: {
    position:         'absolute',
    top:              12,
    right:            12,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:     999,
  },
  statusText:  { fontSize: 12, fontWeight: '700' },

  // Tap hint
  tapHint: {
    position:        'absolute',
    bottom:          10,
    left:            12,
  },
  tapHintText: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
});