// src/components/shared/LoadingOverlay.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Modal,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';

type Size    = 'sm' | 'md' | 'lg';
type Variant = 'spinner' | 'pulse' | 'dots';

// ── Animated dots indicator ───────────────────────────────────────
function DotsIndicator({ color }: { color: string }) {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, {
            toValue:         1,
            duration:        400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue:         0,
            duration:        400,
            useNativeDriver: true,
          }),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, []);

  return (
    <View style={dotStyles.row}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            dotStyles.dot,
            { backgroundColor: color },
            {
              transform: [{
                translateY: dot.interpolate({
                  inputRange:  [0, 1],
                  outputRange: [0, -6],
                }),
              }],
              opacity: dot.interpolate({
                inputRange:  [0, 1],
                outputRange: [0.4, 1],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

// ── Pulse indicator ───────────────────────────────────────────────
function PulseIndicator({ color }: { color: string }) {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale,   { toValue: 1.4, duration: 700, useNativeDriver: true }),
          Animated.timing(scale,   { toValue: 1,   duration: 700, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.2, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.8, duration: 700, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[
      pulseStyles.circle,
      { backgroundColor: color, transform: [{ scale }], opacity },
    ]} />
  );
}

const pulseStyles = StyleSheet.create({
  circle: { width: 48, height: 48, borderRadius: 24 },
});

// ── Main Component ────────────────────────────────────────────────
interface Props {
  visible:   boolean;
  message?:  string;
  submessage?: string;           // secondary smaller text below message
  variant?:  Variant;
  size?:     Size;
  backdrop?: boolean;            // dim background (default true)
  color?:    string;             // indicator colour
  style?:    ViewStyle;
}

export default function LoadingOverlay({
  visible,
  message,
  submessage,
  variant  = 'spinner',
  size     = 'md',
  backdrop = true,
  color    = '#01696f',
  style,
}: Props) {
  // ── Fade in/out animation ─────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
    >
      <Animated.View
        style={[
          styles.overlay,
          backdrop && styles.backdrop,
          { opacity: fadeAnim },
          style,
        ]}
      >
        <View style={[styles.box, styles[`box_${size}`]]}>

          {/* ── Indicator ── */}
          {variant === 'spinner' && (
            <ActivityIndicator
              size={size === 'sm' ? 'small' : 'large'}
              color={color}
            />
          )}
          {variant === 'pulse' && <PulseIndicator color={color} />}
          {variant === 'dots'  && <DotsIndicator  color={color} />}

          {/* ── Message ── */}
          {message && (
            <Text style={[styles.message, styles[`message_${size}`]]}>
              {message}
            </Text>
          )}

          {/* ── Submessage ── */}
          {submessage && (
            <Text style={styles.submessage}>{submessage}</Text>
          )}

        </View>
      </Animated.View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
  },
  backdrop: {
    backgroundColor: 'rgba(28, 25, 20, 0.5)',  // warm dark tint
  },

  // Box
  box: {
    backgroundColor: '#fff',
    borderRadius:    18,
    alignItems:      'center',
    gap:             14,
    shadowColor:     '#000',
    shadowOpacity:   0.2,
    shadowRadius:    24,
    elevation:       12,
  },

  // Box sizes
  box_sm: { padding: 20, minWidth: 120 },
  box_md: { padding: 28, minWidth: 160 },
  box_lg: { padding: 36, minWidth: 200 },

  // Message
  message:    { fontWeight: '600', color: '#28251d', textAlign: 'center' },
  message_sm: { fontSize: 13 },
  message_md: { fontSize: 14 },
  message_lg: { fontSize: 16 },

  // Submessage
  submessage: {
    fontSize:   12,
    color:      '#7a7974',
    textAlign:  'center',
    maxWidth:   200,
    marginTop:  -6,
  },
});