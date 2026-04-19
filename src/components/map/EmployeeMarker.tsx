// src/components/map/EmployeeMarker.tsx
import React, { useRef, useEffect, useState, memo, useCallback } from 'react';
import { View, Text, StyleSheet, Animated }                      from 'react-native';
import { Marker }                                                 from 'react-native-maps';
import Svg, { Circle, Defs, RadialGradient, Stop }               from 'react-native-svg';
import { LiveEmployee }                                           from '../../types';

// ── Constants ─────────────────────────────────────────────────────
const DOT_SIZE  = 32;
const RING_SIZE = DOT_SIZE + 6;

const COLOR_ONLINE  = '#437a22';
const COLOR_OFFLINE = '#a12c7b';
const COLOR_ONLINE_GLOW = '#6daa45';

// ─────────────────────────────────────────────────────────────────
// MarkerPinSVG
//
// Draws the map-pin chrome entirely in SVG so react-native-maps
// can snapshot it without needing JS-driven layout passes.
// Structure:
//   • Soft radial glow (online only) — outermost layer
//   • White border ring
//   • Coloured fill circle
//   • White initial letter (Text overlay — SVG <Text> is avoided
//     to prevent font-rendering issues on Android inside Marker)
// ─────────────────────────────────────────────────────────────────
function MarkerPinSVG({
  isOnline,
  initial,
}: {
  isOnline: boolean;
  initial:  string;
}) {
  const totalSize = RING_SIZE + 20;       // canvas size including glow padding
  const cx        = totalSize / 2;
  const cy        = totalSize / 2;
  const ringR     = RING_SIZE / 2;
  const dotR      = DOT_SIZE / 2;
  const fillColor = isOnline ? COLOR_ONLINE : COLOR_OFFLINE;
  const glowColor = isOnline ? COLOR_ONLINE_GLOW : COLOR_OFFLINE;

  return (
    <View style={[svg.wrapper, { width: totalSize, height: totalSize }]}>
      <Svg width={totalSize} height={totalSize} viewBox={`0 0 ${totalSize} ${totalSize}`}>
        <Defs>
          <RadialGradient id="mg" cx="50%" cy="50%" r="50%">
            <Stop offset="30%"  stopColor={glowColor} stopOpacity={isOnline ? 0.25 : 0.15} />
            <Stop offset="100%" stopColor={glowColor} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* Outer glow disc */}
        <Circle cx={cx} cy={cy} r={cx} fill="url(#mg)" />

        {/* Drop shadow approximation — darker ring */}
        <Circle cx={cx} cy={cy + 1} r={ringR} fill="rgba(0,0,0,0.10)" />

        {/* White border ring */}
        <Circle cx={cx} cy={cy} r={ringR} fill="#ffffff" />

        {/* Coloured fill */}
        <Circle cx={cx} cy={cy} r={dotR} fill={fillColor} />
      </Svg>

      {/* Initial letter — React Native Text for crisp font rendering */}
      <Text style={svg.initial}>{initial}</Text>
    </View>
  );
}

const svg = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  initial: {
    position: 'absolute',
    color: '#ffffff', fontSize: 13, fontWeight: '800',
    lineHeight: 16, textAlign: 'center',
  },
});

// ─────────────────────────────────────────────────────────────────
// PulseRing — Animated ring that expands + fades (online only)
// Kept as a separate Animated.View so it never triggers
// tracksViewChanges on the static SVG marker.
// ─────────────────────────────────────────────────────────────────
const PulseRing = memo(function PulseRing({ active }: { active: boolean }) {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.65)).current;

  useEffect(() => {
    if (!active) { scale.setValue(1); opacity.setValue(0); return; }
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale,   { toValue: 2.6, duration: 1500, useNativeDriver: true }),
          Animated.timing(scale,   { toValue: 1,   duration: 0,    useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0,    duration: 1500, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.65, duration: 0,    useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  return (
    <Animated.View
      style={[
        pulse.ring,
        { transform: [{ scale }], opacity },
      ]}
      pointerEvents="none"
    />
  );
});

const pulse = StyleSheet.create({
  ring: {
    position: 'absolute',
    width:  RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2,
    backgroundColor: `${COLOR_ONLINE_GLOW}55`,
  },
});

// ─────────────────────────────────────────────────────────────────
// DotMarker — composes PulseRing + MarkerPinSVG
// ─────────────────────────────────────────────────────────────────
const DotMarker = memo(function DotMarker({
  isOnline, initial, onReady,
}: {
  isOnline: boolean;
  initial:  string;
  onReady:  () => void;
}) {
  const totalSize = RING_SIZE + 20;
  return (
    <View
      style={[dot.container, { width: totalSize, height: totalSize }]}
      onLayout={onReady}
    >
      {isOnline && <PulseRing active />}
      <MarkerPinSVG isOnline={isOnline} initial={initial} />
    </View>
  );
});

const dot = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
});

// ─────────────────────────────────────────────────────────────────
// EmployeeMarker — exported map marker
// ─────────────────────────────────────────────────────────────────
interface Props {
  employee: LiveEmployee;
  isNew?:   boolean;
  onPress:  (emp: LiveEmployee) => void;
}

export default memo(function EmployeeMarker({
  employee, isNew = false, onPress,
}: Props) {
  const isOnline = employee.is_online ?? false;
  const initial  = (employee.name ?? 'U').charAt(0).toUpperCase();

  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  const handleReady = useCallback(() => {
    const t = setTimeout(() => setTracksViewChanges(false), 200);
    return () => clearTimeout(t);
  }, []);

  // Re-enable snapshot when online status flips
  useEffect(() => {
    setTracksViewChanges(true);
  }, [isOnline]);

  if (employee.lat == null || employee.lng == null) return null;

  return (
    <Marker
      coordinate={{ latitude: employee.lat, longitude: employee.lng }}
      onPress={() => onPress(employee)}
      tracksViewChanges={tracksViewChanges}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <DotMarker
        isOnline={isOnline}
        initial={initial}
        onReady={handleReady}
      />
    </Marker>
  );
});