// src/screens/admin/CallScreen.tsx
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, Animated, Vibration,
} from 'react-native';
import Svg, { Circle, Rect, Defs, RadialGradient, Stop } from 'react-native-svg';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {
  MicOff, Mic, Volume2, VolumeX, PhoneOff,
  PhoneCall, AlertCircle,
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AdminStackParamList }    from '../../navigation/AdminTabs';
import { useVoiceCall }           from '../../hooks/useVoiceCall';

// ── Palette ───────────────────────────────────────────────────────
const C = {
  bg:          '#0A0F1A',
  surface:     '#111827',
  surfaceLift: '#172033',
  green:       '#97C459',
  greenMid:    '#639922',
  greenDim:    'rgba(151,196,89,0.10)',
  greenBorder: 'rgba(151,196,89,0.25)',
  rose:        '#E24B4A',
  roseDim:     'rgba(226,75,74,0.08)',
  roseBorder:  'rgba(226,75,74,0.25)',
  roseDark:    '#A32D2D',
  blue:        '#378ADD',
  blueDim:     'rgba(55,138,221,0.08)',
  blueBorder:  'rgba(55,138,221,0.25)',
  textPrimary: '#E8EDF5',
  textSub:     '#8A95A8',
  textFaint:   '#4A5568',
  textDark:    '#2C3A4E',
  border:      'rgba(255,255,255,0.07)',
  borderBright:'rgba(255,255,255,0.12)',
};

const F = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif',     default: 'Georgia' }),
  mono:  Platform.select({ ios: 'Menlo',   android: 'monospace', default: 'monospace' }),
};

// ── Helpers ───────────────────────────────────────────────────────
function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

function accentColor(name: string): string {
  const palette = [C.green, '#FAC775', '#85B7EB', '#AFA9EC', '#F0997B'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

// ── Haptic config ─────────────────────────────────────────────────
const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const ANDROID_RING_PATTERN = [0, 200, 100, 200, 1300];

function startRingHaptic() {
  if (Platform.OS === 'android') Vibration.vibrate(ANDROID_RING_PATTERN, true);
}
function stopRingHaptic() {
  if (Platform.OS === 'android') Vibration.cancel();
}

/** Mute toggle */
function hapticMute() {
  if (Platform.OS === 'ios') ReactNativeHapticFeedback.trigger('impactMedium', HAPTIC_OPTIONS);
  else Vibration.vibrate(40);
}
/** Speaker toggle */
function hapticSpeaker() {
  if (Platform.OS === 'ios') ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS);
  else Vibration.vibrate(30);
}
/** End call */
function hapticEnd() {
  if (Platform.OS === 'ios') ReactNativeHapticFeedback.trigger('notificationWarning', HAPTIC_OPTIONS);
  else Vibration.vibrate([0, 80, 60, 80]);
}

// ── AnimatedCircle ────────────────────────────────────────────────
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── PulseRings ────────────────────────────────────────────────────
function PulseRings({
  color, opacity1, opacity2,
}: {
  color: string; opacity1: Animated.Value; opacity2: Animated.Value;
}) {
  return (
    <Svg width={200} height={200} viewBox="0 0 200 200">
      <AnimatedCircle cx={100} cy={100} r={82}
        fill="none" stroke={color} strokeWidth={1}
        opacity={opacity1 as any} />
      <AnimatedCircle cx={100} cy={100} r={96}
        fill="none" stroke={color} strokeWidth={0.75}
        opacity={opacity2 as any} />
    </Svg>
  );
}

// ── AvatarSVG ─────────────────────────────────────────────────────
function AvatarSVG({ color, size = 108 }: { color: string; size?: number }) {
  const cx = size / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient id="avFill" cx="40%" cy="35%" r="65%">
          <Stop offset="0%"   stopColor={color} stopOpacity={0.20} />
          <Stop offset="100%" stopColor={color} stopOpacity={0.06} />
        </RadialGradient>
      </Defs>
      <Circle cx={cx} cy={cx} r={cx - 1}
        fill="url(#avFill)"
        stroke={color} strokeWidth={1.5} strokeOpacity={0.35} />
    </Svg>
  );
}

// ── WaveformSVG ───────────────────────────────────────────────────
function WaveformSVG({ color }: { color: string }) {
  const bars = [4, 12, 8, 16, 6, 14, 9, 13, 5, 11, 15, 7, 10];
  const bw = 3, gap = 2.5, h = 22;
  const totalW = bars.length * (bw + gap) - gap;
  return (
    <Svg width={totalW} height={h} viewBox={`0 0 ${totalW} ${h}`}>
      {bars.map((bh, i) => (
        <Rect key={i}
          x={i * (bw + gap)} y={(h - bh) / 2}
          width={bw} height={bh} rx={1.5}
          fill={color} opacity={0.4 + (i % 4) * 0.15} />
      ))}
    </Svg>
  );
}

// ── ControlBtn — with scale spring + haptic ───────────────────────
function ControlBtn({
  icon, label, active = false, disabled = false,
  onPress, activeBg, activeBorder, activeColor, haptic,
}: {
  icon:          React.ReactNode;
  label:         string;
  active?:       boolean;
  disabled?:     boolean;
  onPress:       () => void;
  activeBg?:     string;
  activeBorder?: string;
  activeColor?:  string;
  haptic:        () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.87, friction: 4, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1,    friction: 4, useNativeDriver: true }),
    ]).start();
    haptic();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[
          cb.wrap,
          active && {
            backgroundColor: activeBg    ?? C.greenDim,
            borderColor:     activeBorder ?? C.greenBorder,
          },
          disabled && cb.disabled,
        ]}
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.7}
      >
        {icon}
        <Text style={[cb.label, active && { color: activeColor ?? C.green }]}>
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const cb = StyleSheet.create({
  wrap: {
    width: 68, height: 74, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.border,
  },
  disabled: { opacity: 0.25 },
  label: {
    fontSize: 9, color: C.textFaint,
    fontFamily: F.mono, letterSpacing: 1, textTransform: 'uppercase',
  },
});

// ── CallScreen ────────────────────────────────────────────────────
type Props = NativeStackScreenProps<AdminStackParamList, 'Call'>;

export default function CallScreen({ route, navigation }: Props) {
  const { employeeId, employeeName } = route.params;

  const {
    status, isMuted, isSpeaker, duration,
    startCall, endCall, toggleMute, toggleSpeaker, error,
  } = useVoiceCall();

  const color   = accentColor(employeeName);
  const initial = employeeName.charAt(0).toUpperCase();

  // ── Animated values ───────────────────────────────────────────
  const opacity1    = useRef(new Animated.Value(0)).current;
  const opacity2    = useRef(new Animated.Value(0)).current;
  const pulseScale  = useRef(new Animated.Value(1)).current;
  const fadeIn      = useRef(new Animated.Value(0)).current;
  const endBtnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  // ── Pulse rings animation ─────────────────────────────────────
  useEffect(() => {
    if (status === 'calling') {
      const loop1 = Animated.loop(Animated.sequence([
        Animated.timing(opacity1, { toValue: 0.6,  duration: 900, useNativeDriver: true }),
        Animated.timing(opacity1, { toValue: 0.04, duration: 900, useNativeDriver: true }),
      ]));
      const loop2 = Animated.loop(Animated.sequence([
        Animated.delay(450),
        Animated.timing(opacity2, { toValue: 0.4,  duration: 900, useNativeDriver: true }),
        Animated.timing(opacity2, { toValue: 0.04, duration: 900, useNativeDriver: true }),
      ]));
      const loopS = Animated.loop(Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.05, duration: 950, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1,    duration: 950, useNativeDriver: true }),
      ]));
      loop1.start(); loop2.start(); loopS.start();
      return () => { loop1.stop(); loop2.stop(); loopS.stop(); };
    } else {
      opacity1.stopAnimation(); opacity1.setValue(0);
      opacity2.stopAnimation(); opacity2.setValue(0);
      Animated.spring(pulseScale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
    }
  }, [status]);

  // ── Ring haptic while calling ─────────────────────────────────
  useEffect(() => {
    if (status !== 'calling') { stopRingHaptic(); return; }

    startRingHaptic();
    let iosInterval: ReturnType<typeof setInterval> | undefined;

    if (Platform.OS === 'ios') {
      const fireTap = () => {
        ReactNativeHapticFeedback.trigger('impactMedium', HAPTIC_OPTIONS);
        setTimeout(() => ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS), 160);
      };
      fireTap();
      iosInterval = setInterval(fireTap, 1800);
    }

    return () => {
      stopRingHaptic();
      if (iosInterval !== undefined) clearInterval(iosInterval);
    };
  }, [status]);

  // ── Ring colour per status ────────────────────────────────────
  const ringColor = {
    idle:      C.textFaint,
    calling:   '#FAC775',
    connected: C.green,
    ended:     C.textSub,
    error:     C.rose,
  }[status];

  useEffect(() => {
    startCall(employeeId, employeeName);
    return () => { endCall(); };
  }, []);

  useEffect(() => {
    if (status === 'ended' || status === 'error') {
      const t = setTimeout(() => {
        if (navigation.canGoBack()) navigation.goBack();
      }, status === 'error' ? 2500 : 1200);
      return () => clearTimeout(t);
    }
  }, [status]);

  const handleEndCall = async () => {
    // Scale spring + haptic before async endCall
    Animated.sequence([
      Animated.spring(endBtnScale, { toValue: 0.87, friction: 4, useNativeDriver: true }),
      Animated.spring(endBtnScale, { toValue: 1,    friction: 4, useNativeDriver: true }),
    ]).start();
    hapticEnd();
    await endCall();
    if (navigation.canGoBack()) navigation.goBack();
  };

  const statusLabel = {
    idle:      'Initializing…',
    calling:   'Ringing…',
    connected: 'Connected',
    ended:     'Call Ended',
    error:     error ?? 'Failed',
  }[status];

  return (
    <Animated.View style={[s.container, { opacity: fadeIn }]}>
  

      {/* ── Top bar ──────────────────────────────────────────── */}
      <View style={s.topBar}>
        <Text style={s.topLabel}>Voice Call</Text>
        <View style={s.signalRow}>
          {[5, 9, 13, 17].map((h, i) => (
            <View key={i} style={[s.signalBar, { height: h }]} />
          ))}
        </View>
      </View>

      {/* ── Avatar zone ──────────────────────────────────────── */}
      <View style={s.avatarZone}>


        {/* Avatar */}
        <Animated.View style={{ transform: [{ scale: pulseScale }] }}>
          <View style={s.avatarWrap}>
            <AvatarSVG color={color} size={108} />
            <View style={s.initialOverlay}>
              <Text style={[s.initial, { color }]}>{initial}</Text>
            </View>
          </View>
        </Animated.View>

        <Text style={s.name}>{employeeName}</Text>
        <Text style={s.roleTag}>Employee</Text>

        {/* Status pill */}
        <View style={[s.statusPill, {
          backgroundColor: `${ringColor}14`,
          borderColor:     `${ringColor}30`,
        }]}>
          <View style={[s.statusDot, { backgroundColor: ringColor }]} />
          <Text style={[s.statusText, { color: ringColor }]}>{statusLabel}</Text>
        </View>

        {/* Timer + waveform */}
        {status === 'connected' && (
          <View style={s.timerBlock}>
            <Text style={s.timer}>{formatDuration(duration)}</Text>
            <WaveformSVG color={C.greenMid} />
          </View>
        )}

        {/* Calling hint */}
        {status === 'calling' && (
          <View style={s.hintRow}>
            <PhoneCall size={11} color={C.textDark} />
            <Text style={s.hint}>Sending invite to {employeeName}…</Text>
          </View>
        )}

        {/* Error */}
        {status === 'error' && error && (
          <View style={s.errorRow}>
            <AlertCircle size={12} color={C.rose} />
            <Text style={s.errorText} numberOfLines={2}>{error}</Text>
          </View>
        )}
      </View>

      {/* ── Divider ──────────────────────────────────────────── */}
      <View style={s.divider} />

      {/* ── Controls ─────────────────────────────────────────── */}
      <View style={s.controls}>

        <ControlBtn
          icon={isMuted
            ? <MicOff size={20} color={C.rose}     />
            : <Mic    size={20} color={C.textFaint} />}
          label={isMuted ? 'Muted' : 'Mute'}
          active={isMuted}
          activeBg={C.roseDim}
          activeBorder={C.roseBorder}
          activeColor={C.rose}
          disabled={status !== 'connected'}
          haptic={hapticMute}
          onPress={toggleMute}
        />

        {/* End button */}
        <Animated.View style={{ transform: [{ scale: endBtnScale }] }}>
          <TouchableOpacity style={s.endBtn} onPress={handleEndCall} activeOpacity={0.8}>
            <View style={s.endRing} />
            <PhoneOff size={26} color="#fff" />
            <Text style={s.endLabel}>End</Text>
          </TouchableOpacity>
        </Animated.View>

        <ControlBtn
          icon={isSpeaker
            ? <Volume2 size={20} color={C.blue}     />
            : <VolumeX size={20} color={C.textFaint} />}
          label={isSpeaker ? 'Speaker' : 'Earpiece'}
          active={isSpeaker}
          activeBg={C.blueDim}
          activeBorder={C.blueBorder}
          activeColor={C.blue}
          disabled={status !== 'connected'}
          haptic={hapticSpeaker}
          onPress={toggleSpeaker}
        />

      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: C.bg,
    alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 56, paddingHorizontal: 28,
  },
  topBar:    { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topLabel:  { fontSize: 11, color: C.textFaint, letterSpacing: 2, textTransform: 'uppercase', fontFamily: F.mono, fontWeight: '500' },
  signalRow: { flexDirection: 'row', gap: 3, alignItems: 'flex-end' },
  signalBar: { width: 3, backgroundColor: C.green, borderRadius: 1 },

  avatarZone: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },

  avatarWrap:    { width: 108, height: 108, alignItems: 'center', justifyContent: 'center' },
  initialOverlay:{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  initial:       { fontSize: 40, fontWeight: '700', fontFamily: F.serif },

  name:    { fontSize: 24, fontWeight: '700', color: C.textPrimary, fontFamily: F.serif, marginTop: 16, letterSpacing: -0.3 },
  roleTag: { fontSize: 10, color: C.textFaint, letterSpacing: 2, textTransform: 'uppercase', fontFamily: F.mono, fontWeight: '500' },

  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 0.5, marginTop: 4 },
  statusDot:  { width: 5, height: 5, borderRadius: 999 },
  statusText: { fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: F.mono, fontWeight: '500' },

  timerBlock: { alignItems: 'center', gap: 8, marginTop: 4 },
  timer:      { fontSize: 36, fontWeight: '700', color: C.green, fontFamily: F.mono, letterSpacing: 4 },

  hintRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  hint:      { fontSize: 10, color: C.textDark, fontFamily: F.mono },
  errorRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  errorText: { fontSize: 11, color: C.rose, fontFamily: F.mono, flex: 1, lineHeight: 18 },

  divider: { width: '100%', height: 0.5, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 20 },

  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, width: '100%' },

  endBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.roseDark,
    alignItems: 'center', justifyContent: 'center', gap: 3,
  },
  endRing: {
    position: 'absolute', top: -5, left: -5, right: -5, bottom: -5,
    borderRadius: 41, borderWidth: 1, borderColor: 'rgba(163,45,45,0.30)',
  },
  endLabel: { fontSize: 8, color: '#fff', fontFamily: F.mono, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
});