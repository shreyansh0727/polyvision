// src/navigation/SplashScreen.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { tokens, MC, MF } from './AppTheme';

const { width, height } = Dimensions.get('window');

// ── Total animation timeline ends at ~2300ms
// onFinish fires after loading dots fully appear + 400ms settle buffer
const FINISH_DELAY = 2300;

interface Props {
  onFinish?: () => void;
}

export default function SplashScreen({ onFinish }: Props) {
  const scheme  = useColorScheme();
  const isDark  = scheme === 'dark';
  const t       = isDark ? MC : tokens.light;
  const accentColor = isDark ? MC.green : tokens.light.teal;

  const scanLine     = useRef(new Animated.Value(0)).current;
  const irisScale    = useRef(new Animated.Value(0)).current;
  const irisOpacity  = useRef(new Animated.Value(0)).current;
  const pupilScale   = useRef(new Animated.Value(0)).current;
  const glowOpacity  = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY       = useRef(new Animated.Value(18)).current;
  const subOpacity   = useRef(new Animated.Value(0)).current;
  const ring1Scale   = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0.6)).current;
  const ring2Scale   = useRef(new Animated.Value(1)).current;
  const ring2Opacity = useRef(new Animated.Value(0.4)).current;
  const scanOpacity  = useRef(new Animated.Value(0)).current;
  const dotOpacity1  = useRef(new Animated.Value(0)).current;
  const dotOpacity2  = useRef(new Animated.Value(0)).current;
  const dotOpacity3  = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  // Track whether component is still mounted before calling onFinish
  const isMounted = useRef(true);
  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    // 1. Iris
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(irisScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(irisOpacity, { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start();

    // 2. Pupil
    Animated.sequence([
      Animated.delay(500),
      Animated.spring(pupilScale, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
    ]).start();

    // 3. Scan line
    Animated.sequence([
      Animated.delay(700),
      Animated.timing(scanOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(scanLine, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(scanOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();

    // 4. Pulse rings
    const pulseRing = (scale: Animated.Value, opacity: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scale,   { toValue: 1.9, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0,   duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(scale,   { toValue: 1,   duration: 0, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.5, duration: 0, useNativeDriver: true }),
          ]),
        ])
      ).start();
    };

    setTimeout(() => {
      pulseRing(ring1Scale, ring1Opacity, 0);
      pulseRing(ring2Scale, ring2Opacity, 900);
    }, 900);

    // 5. Title
    Animated.sequence([
      Animated.delay(1100),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(titleY,       { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    // 6. Subtitle + loading dots — last animation
    // ↓ onFinish is called only after this whole chain completes
    Animated.sequence([
      Animated.delay(1500),
      Animated.timing(subOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      // Brief pause so the user sees the completed screen
      Animated.delay(400),
      // Fade the splash out smoothly before handing off
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 350,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished && isMounted.current) {
        onFinish?.();
      }
    });

    // 7. Loading dots stagger (purely visual, not tied to navigation)
    const dotAnim = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1,   duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.2, duration: 400, useNativeDriver: true }),
          Animated.delay(400),
        ])
      ).start();
    };

    setTimeout(() => {
      dotAnim(dotOpacity1, 0);
      dotAnim(dotOpacity2, 200);
      dotAnim(dotOpacity3, 400);
    }, 1700);
  }, []);

  const scanTranslateY = scanLine.interpolate({
    inputRange:  [0, 1],
    outputRange: [-56, 56],
  });

  return (
    <Animated.View style={[styles.container, { backgroundColor: t.bg, opacity: screenOpacity }]}>

      {/* Background grid */}
      <View style={styles.gridContainer} pointerEvents="none">
        {Array.from({ length: 8 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.gridLine,
              {
                top: (height / 8) * i,
                borderColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)',
              },
            ]}
          />
        ))}
      </View>

      {/* Eye */}
      <View style={styles.eyeWrapper}>
        <Animated.View style={[styles.pulseRing, { borderColor: accentColor, transform: [{ scale: ring1Scale }], opacity: ring1Opacity }]} />
        <Animated.View style={[styles.pulseRing, { borderColor: accentColor, transform: [{ scale: ring2Scale }], opacity: ring2Opacity }]} />

        <Animated.View style={[styles.glow, { backgroundColor: accentColor, opacity: glowOpacity }]} />

        <Animated.View
          style={[
            styles.iris,
            {
              backgroundColor: isDark ? '#0d1117' : '#f0f9ff',
              borderColor: accentColor,
              transform: [{ scale: irisScale }],
              opacity: irisOpacity,
              overflow: 'hidden',
            },
          ]}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <View
              key={i}
              style={[styles.irisLine, { borderColor: accentColor, opacity: 0.15, transform: [{ rotate: `${i * 30}deg` }] }]}
            />
          ))}
          <Animated.View
            style={[
              styles.scanLine,
              { backgroundColor: accentColor, opacity: scanOpacity, transform: [{ translateY: scanTranslateY }] },
            ]}
          />
        </Animated.View>

        <Animated.View style={[styles.pupil, { backgroundColor: accentColor, transform: [{ scale: pupilScale }] }]}>
          <View style={[styles.pupilInner, { backgroundColor: isDark ? '#0d1117' : '#fff' }]} />
        </Animated.View>
      </View>

      {/* Title */}
      <Animated.Text
        style={[
          styles.title,
          { color: t.text, opacity: titleOpacity, transform: [{ translateY: titleY }], fontFamily: MF.display },
        ]}
      >
        PolyVision
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { color: accentColor, opacity: subOpacity }]}>
        See everything. Miss nothing.
      </Animated.Text>

      {/* Loading dots */}
      <Animated.View style={[styles.dotsRow, { opacity: subOpacity }]}>
        <Animated.View style={[styles.dot, { backgroundColor: accentColor, opacity: dotOpacity1 }]} />
        <Animated.View style={[styles.dot, { backgroundColor: accentColor, opacity: dotOpacity2 }]} />
        <Animated.View style={[styles.dot, { backgroundColor: accentColor, opacity: dotOpacity3 }]} />
      </Animated.View>

    </Animated.View>
  );
}

const IRIS_SIZE  = 120;
const PUPIL_SIZE = 36;
const GLOW_SIZE  = 160;

const styles = StyleSheet.create({
  container:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gridContainer: { ...StyleSheet.absoluteFillObject },
  gridLine:     { position: 'absolute', left: 0, right: 0, height: 1, borderTopWidth: 1 },
  eyeWrapper:   { width: IRIS_SIZE, height: IRIS_SIZE, alignItems: 'center', justifyContent: 'center', marginBottom: 36 },
  pulseRing:    { position: 'absolute', width: IRIS_SIZE, height: IRIS_SIZE, borderRadius: IRIS_SIZE / 2, borderWidth: 1.5 },
  glow:         { position: 'absolute', width: GLOW_SIZE, height: GLOW_SIZE, borderRadius: GLOW_SIZE / 2, opacity: 0.12 },
  iris:         { position: 'absolute', width: IRIS_SIZE, height: IRIS_SIZE, borderRadius: IRIS_SIZE / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  irisLine:     { position: 'absolute', width: '100%', height: 1, borderTopWidth: 1 },
  scanLine:     { position: 'absolute', left: 0, right: 0, height: 2, opacity: 0.7 },
  pupil:        { position: 'absolute', width: PUPIL_SIZE, height: PUPIL_SIZE, borderRadius: PUPIL_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  pupilInner:   { width: 10, height: 10, borderRadius: 5, opacity: 0.6 },
  title:        { fontSize: 30, fontWeight: '800', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 },
  tagline:      { fontSize: 12, letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: '500', marginBottom: 40, opacity: 0.85 },
  dotsRow:      { flexDirection: 'row', gap: 8 },
  dot:          { width: 6, height: 6, borderRadius: 3 },
});