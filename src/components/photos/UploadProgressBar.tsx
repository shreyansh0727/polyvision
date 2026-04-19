// src/components/photos/UploadProgressBar.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ViewStyle,
} from 'react-native';

// ── All possible upload steps in order ───────────────────────────
const STEPS = [
  '🔐 Checking permissions...',
  '📷 Opening camera...',
  '📍 Getting your location...',
  '🔗 Preparing secure upload...',
  '⬆️ Uploading photo...',
  '✅ Saving visit record...',
];

interface Props {
  step:    string | null;    // current step label from photoService
  style?:  ViewStyle;
}

// ── Animated shimmer bar ──────────────────────────────────────────
function ShimmerBar({ progress }: { progress: number }) {
  const shimmerX = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerX, {
        toValue:         1,
        duration:        1200,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  return (
    <View style={barStyles.track}>
      {/* Filled portion */}
      <View style={[barStyles.fill, { width: `${progress * 100}%` }]}>
        {/* Shimmer overlay */}
        <Animated.View
          style={[
            barStyles.shimmer,
            {
              transform: [{
                translateX: shimmerX.interpolate({
                  inputRange:  [-1, 1],
                  outputRange: [-120, 120],
                }),
              }],
            },
          ]}
        />
      </View>
    </View>
  );
}

const barStyles = StyleSheet.create({
  track:   { height: 4, backgroundColor: '#dcd9d5', borderRadius: 999, overflow: 'hidden' },
  fill:    { height: '100%', backgroundColor: '#01696f', borderRadius: 999, overflow: 'hidden' },
  shimmer: { position: 'absolute', top: 0, bottom: 0, width: 80, backgroundColor: 'rgba(255,255,255,0.45)', borderRadius: 999 },
});

// ── Step dot indicator ────────────────────────────────────────────
function StepDots({
  total,
  current,
}: {
  total:   number;
  current: number;
}) {
  return (
    <View style={dotStyles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            dotStyles.dot,
            i <  current && dotStyles.done,
            i === current && dotStyles.active,
          ]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row:    { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: '#dcd9d5' },
  done:   { backgroundColor: '#437a22' },
  active: { backgroundColor: '#01696f', width: 14 },   // active dot stretches
});

// ── Spinning loader dots ──────────────────────────────────────────
function SpinnerDots({ color }: { color: string }) {
  const anims = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(a, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(a, { toValue: 0, duration: 350, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

  return (
    <View style={spinnerStyles.row}>
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={[
            spinnerStyles.dot,
            { backgroundColor: color },
            {
              transform: [{
                translateY: a.interpolate({
                  inputRange:  [0, 1],
                  outputRange: [0, -5],
                }),
              }],
              opacity: a.interpolate({
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

const spinnerStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
});

// ── Main Component ────────────────────────────────────────────────
export default function UploadProgressBar({ step, style }: Props) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;

  // Current step index (0-based), -1 if no step
  const stepIndex = step ? STEPS.indexOf(step) : -1;
  const progress  = stepIndex >= 0
    ? (stepIndex + 1) / STEPS.length
    : 0;

  // Animate in when step becomes non-null
  useEffect(() => {
    if (step) {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 8, duration: 160, useNativeDriver: true }),
      ]).start();
    }
  }, [!!step]);

  if (!step) return null;

  const isLastStep = stepIndex === STEPS.length - 1;
  const dotColor   = isLastStep ? '#437a22' : '#01696f';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity:   fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
        style,
      ]}
    >
      {/* ── Top row: spinner + step label ── */}
      <View style={styles.topRow}>
        <SpinnerDots color={dotColor} />
        <Text style={[styles.stepLabel, { color: dotColor }]} numberOfLines={1}>
          {step}
        </Text>
      </View>

      {/* ── Progress bar ── */}
      <ShimmerBar progress={progress} />

      {/* ── Bottom row: step dots + percentage ── */}
      <View style={styles.bottomRow}>
        <StepDots total={STEPS.length} current={stepIndex} />
        <Text style={styles.percent}>
          {Math.round(progress * 100)}%
        </Text>
      </View>

    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f9f8f5',
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     '#dcd9d5',
    padding:         14,
    gap:             10,
  },

  // Top row
  topRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepLabel: { fontSize: 13, fontWeight: '600', flex: 1 },

  // Bottom row
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  percent:   { fontSize: 12, fontWeight: '700', color: '#7a7974' },
});