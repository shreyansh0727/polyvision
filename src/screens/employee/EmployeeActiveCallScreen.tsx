// src/screens/employee/EmployeeActiveCallScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, StatusBar, Platform, Vibration,
} from 'react-native';
import Svg, {
  Circle, Defs, RadialGradient, Stop,
} from 'react-native-svg';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList }     from '../../navigation';
import { IRtcEngine }             from 'react-native-agora';
import { MC, MF, avatarColor }    from '../../navigation/AppTheme';
import {
  MicOff, Mic, PhoneOff, Volume2, VolumeX,
  Signal, Clock, ShieldCheck,
} from 'lucide-react-native';

// ─────────────────────────────────────────────────────────────────
// Haptic helpers
// ─────────────────────────────────────────────────────────────────
const HAPTIC_OPTS = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

/** Mute toggle — medium impact */
function hapticMute() {
  if (Platform.OS === 'ios') {
    ReactNativeHapticFeedback.trigger('impactMedium', HAPTIC_OPTS);
  } else {
    Vibration.vibrate(40);
  }
}

/** Speaker toggle — light impact */
function hapticSpeaker() {
  if (Platform.OS === 'ios') {
    ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTS);
  } else {
    Vibration.vibrate(30);
  }
}

/** End call — warning notification feel */
function hapticEnd() {
  if (Platform.OS === 'ios') {
    ReactNativeHapticFeedback.trigger('notificationWarning', HAPTIC_OPTS);
  } else {
    Vibration.vibrate([0, 80, 60, 80]);
  }
}

/** Remote hang-up — error notification feel */
function hapticRemoteEnd() {
  if (Platform.OS === 'ios') {
    ReactNativeHapticFeedback.trigger('notificationError', HAPTIC_OPTS);
  } else {
    Vibration.vibrate([0, 100, 50, 100, 50, 100]);
  }
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
function formatDuration(s: number): string {
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
}

// ─────────────────────────────────────────────────────────────────
// ActiveRingsSVG
// ─────────────────────────────────────────────────────────────────
function ActiveRingsSVG({ color, ended }: { color: string; ended: boolean }) {
  const c = ended ? MC.textFaint : color;
  return (
    <Svg width={180} height={180} viewBox="0 0 180 180" style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="aglow" cx="50%" cy="50%" r="50%">
          <Stop offset="35%"  stopColor={c} stopOpacity={0} />
          <Stop offset="100%" stopColor={c} stopOpacity={ended ? 0.06 : 0.2} />
        </RadialGradient>
      </Defs>
      <Circle cx={90} cy={90} r={88} fill="url(#aglow)" />
      <Circle cx={90} cy={90} r={82} stroke={c} strokeOpacity={0.12} strokeWidth={1} fill="none" />
      <Circle cx={90} cy={90} r={70} stroke={c} strokeOpacity={0.18} strokeWidth={1} strokeDasharray="4 6" fill="none" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────
// LivePulse
// ─────────────────────────────────────────────────────────────────
function LivePulse({ active }: { active: boolean }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) { anim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.6, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  return (
    <Animated.View style={[
      lp.dot,
      { backgroundColor: active ? MC.green : MC.textFaint },
      active && { transform: [{ scale: anim }] },
    ]} />
  );
}
const lp = StyleSheet.create({
  dot: { width: 7, height: 7, borderRadius: 4 },
});

// ─────────────────────────────────────────────────────────────────
// WaveformSVG
// ─────────────────────────────────────────────────────────────────
function WaveformSVG({ active, color }: { active: boolean; color: string }) {
  const heights = [8, 16, 22, 14, 20, 10, 18, 8];
  const anims   = useRef(heights.map((h) => new Animated.Value(h))).current;

  useEffect(() => {
    if (!active) {
      anims.forEach((a) =>
        Animated.timing(a, { toValue: 4, duration: 300, useNativeDriver: false }).start()
      );
      return;
    }
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(a, { toValue: heights[i], duration: 350 + i * 60, useNativeDriver: false }),
          Animated.timing(a, { toValue: 4,          duration: 350 + i * 60, useNativeDriver: false }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active]);

  return (
    <View style={wf.wrap}>
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={[
            wf.bar,
            {
              height: a,
              backgroundColor: active ? color : MC.textFaint,
              opacity: active ? 0.9 : 0.3,
            },
          ]}
        />
      ))}
    </View>
  );
}
const wf = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 28 },
  bar:  { width: 3, borderRadius: 2 },
});

// ─────────────────────────────────────────────────────────────────
// ControlBtn — with scale spring feedback
// ─────────────────────────────────────────────────────────────────
function ControlBtn({
  icon, label, active = false, disabled = false, onPress, color = MC.green,
}: {
  icon:      React.ReactNode;
  label:     string;
  active?:   boolean;
  disabled?: boolean;
  onPress:   () => void;
  color?:    string;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.87, friction: 4, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1,    friction: 4, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[
          cb.wrap,
          active   && { backgroundColor: `${color}18`, borderColor: `${color}55` },
          disabled && cb.disabled,
        ]}
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.72}
      >
        {icon}
        <Text style={[cb.label, active && { color }]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
const cb = StyleSheet.create({
  wrap: {
    width: 68, height: 76, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: MC.surface, borderWidth: 1, borderColor: MC.border,
  },
  label:    { fontSize: 9, color: MC.textSub, fontFamily: MF.mono, letterSpacing: 0.5 },
  disabled: { opacity: 0.3 },
});

// ─────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────
type Props = NativeStackScreenProps<RootStackParamList, 'EmployeeActiveCall'>;

// ─────────────────────────────────────────────────────────────────
// EmployeeActiveCallScreen
// ─────────────────────────────────────────────────────────────────
export default function EmployeeActiveCallScreen({ route, navigation }: Props) {
  const { callerName, engine: rtcEngine } = route.params as {
    callerName: string;
    engine:     IRtcEngine;
    channel:    string;
  };

  const accentColor  = avatarColor(callerName);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const endBtnScale  = useRef(new Animated.Value(1)).current;

  const [duration,  setDuration]  = useState(0);
  const [isMuted,   setIsMuted]   = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [ended,     setEnded]     = useState(false);

  useEffect(() => {
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);

    rtcEngine.registerEventHandler({
      onUserOffline: () => {
        hapticRemoteEnd();           // buzz when admin hangs up
        setEnded(true);
        cleanup();
        setTimeout(() => navigation.goBack(), 1200);
      },
    });

    return () => cleanup();
  }, []);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    rtcEngine.leaveChannel();
    rtcEngine.release();
  };

  // End button — spring + haptic
  const handleHangUp = () => {
    Animated.sequence([
      Animated.spring(endBtnScale, { toValue: 0.87, friction: 4, useNativeDriver: true }),
      Animated.spring(endBtnScale, { toValue: 1,    friction: 4, useNativeDriver: true }),
    ]).start();
    hapticEnd();
    cleanup();
    navigation.goBack();
  };

  const toggleMute = () => {
    hapticMute();
    setIsMuted((m) => { rtcEngine.muteLocalAudioStream(!m); return !m; });
  };

  const toggleSpeaker = () => {
    hapticSpeaker();
    setIsSpeaker((sp) => { rtcEngine.setEnableSpeakerphone(!sp); return !sp; });
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={MC.bg} />

      {/* ── Top signal bar ── */}
      <View style={s.topBar}>
        <Signal size={12} color={ended ? MC.textFaint : MC.green} />
        <Text style={[s.topLabel, { color: ended ? MC.textFaint : MC.green }]}>
          {ended ? 'CALL ENDED' : 'SECURE VOICE CALL'}
        </Text>
        <ShieldCheck size={12} color={ended ? MC.textFaint : MC.green} />
      </View>

      {/* ── Avatar section ── */}
      <View style={s.avatarSection}>
        <View style={s.avatarOuter}>
          <ActiveRingsSVG color={accentColor} ended={ended} />
          <View style={[s.avatarRing, { borderColor: ended ? MC.textFaint : accentColor }]}>
            <View style={[s.avatar, { backgroundColor: `${accentColor}14` }]}>
              <Text style={[s.initial, { color: accentColor }]}>
                {callerName.charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <Text style={s.name}>{callerName}</Text>

        <View style={s.roleRow}>
          <ShieldCheck size={10} color={MC.textFaint} />
          <Text style={s.role}>Admin</Text>
        </View>

        <View style={[
          s.statusChip,
          { backgroundColor: ended ? `${MC.textFaint}10` : `${MC.green}12` },
        ]}>
          <LivePulse active={!ended} />
          <Text style={[s.statusText, { color: ended ? MC.textSub : MC.green }]}>
            {ended ? 'Call Ended' : 'Connected'}
          </Text>
        </View>

        {!ended && (
          <View style={s.durationRow}>
            <Clock size={12} color={MC.textSub} />
            <Text style={s.duration}>{formatDuration(duration)}</Text>
          </View>
        )}

        <WaveformSVG active={!ended && !isMuted} color={accentColor} />
      </View>

      {/* ── Controls ── */}
      <View style={s.controls}>
        <ControlBtn
          icon={isMuted
            ? <MicOff size={22} color={MC.rose}   />
            : <Mic    size={22} color={MC.textSub} />}
          label={isMuted ? 'Unmute' : 'Mute'}
          active={isMuted}
          color={MC.rose}
          disabled={ended}
          onPress={toggleMute}
        />

        {/* End call button */}
        <Animated.View style={{ transform: [{ scale: endBtnScale }] }}>
          <TouchableOpacity
            style={[s.endBtn, ended && s.endBtnDimmed]}
            onPress={handleHangUp}
            activeOpacity={0.8}
          >
            <PhoneOff size={28} color="#fff" />
            <Text style={s.endLabel}>End</Text>
          </TouchableOpacity>
        </Animated.View>

        <ControlBtn
          icon={isSpeaker
            ? <Volume2 size={22} color={MC.blue}   />
            : <VolumeX size={22} color={MC.textSub} />}
          label={isSpeaker ? 'Speaker' : 'Earpiece'}
          active={isSpeaker}
          color={MC.blue}
          disabled={ended}
          onPress={toggleSpeaker}
        />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// Styles (unchanged)
// ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: MC.bg,
    alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 64,
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: MC.surface, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1, borderColor: MC.border,
  },
  topLabel: { fontSize: 10, fontFamily: MF.mono, letterSpacing: 1.2, textTransform: 'uppercase' },
  avatarSection: { alignItems: 'center', gap: 10 },
  avatarOuter:   { width: 180, height: 180, alignItems: 'center', justifyContent: 'center' },
  avatarRing: {
    width: 128, height: 128, borderRadius: 64,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  avatar: { width: 114, height: 114, borderRadius: 57, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 44, fontWeight: '800', fontFamily: MF.display },
  name:    { fontSize: 26, fontWeight: '800', color: MC.textPrimary, fontFamily: MF.display },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  role:    { fontSize: 11, color: MC.textFaint, fontFamily: MF.mono, letterSpacing: 1, textTransform: 'uppercase' },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, marginTop: 2,
  },
  statusText: { fontSize: 11, fontFamily: MF.mono, letterSpacing: 1, textTransform: 'uppercase' },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  duration:    { fontSize: 32, color: MC.green, fontFamily: MF.mono, fontWeight: '700', letterSpacing: 3 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  endBtn: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: MC.rose,
    alignItems: 'center', justifyContent: 'center', gap: 4,
    shadowColor: MC.rose, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 18, elevation: 12,
  },
  endBtnDimmed: { opacity: 0.5 },
  endLabel: { fontSize: 9, color: '#fff', fontFamily: MF.mono, letterSpacing: 0.5 },
});