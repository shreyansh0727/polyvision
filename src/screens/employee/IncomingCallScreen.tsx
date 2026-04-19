// src/screens/employee/IncomingCallScreen.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, Animated, StatusBar, PermissionsAndroid,
  ActivityIndicator, Vibration,
} from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop, Path } from 'react-native-svg';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList }     from '../../navigation/index';
import {
  createAgoraRtcEngine, IRtcEngine,
  ChannelProfileType, ClientRoleType,
} from 'react-native-agora';
import { MC, MF, avatarColor } from '../../navigation/AppTheme';
import {
  Phone, PhoneOff, PhoneCall, Mic,
  AlertCircle, Radio,
} from 'lucide-react-native';

// ─────────────────────────────────────────────────────────────────
// Haptic config
// ─────────────────────────────────────────────────────────────────
const HAPTIC_OPTS = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// Android double-ring pattern: buzz–pause–buzz–long silence, 1800 ms total
// Index 0 = initial wait, odd = vibrate, even = pause
const ANDROID_RING_PATTERN = [0, 180, 120, 180, 1320];

function hapticAccept() {
  if (Platform.OS === 'ios') {
    ReactNativeHapticFeedback.trigger('notificationSuccess', HAPTIC_OPTS);
  } else {
    Vibration.vibrate(60);
  }
}

function hapticDecline() {
  if (Platform.OS === 'ios') {
    ReactNativeHapticFeedback.trigger('notificationWarning', HAPTIC_OPTS);
  } else {
    Vibration.vibrate([0, 80, 60, 80]);
  }
}

function hapticError() {
  if (Platform.OS === 'ios') {
    ReactNativeHapticFeedback.trigger('notificationError', HAPTIC_OPTS);
  } else {
    Vibration.vibrate([0, 100, 50, 100, 50, 100]);
  }
}

// ─────────────────────────────────────────────────────────────────
// Mic permission
// ─────────────────────────────────────────────────────────────────
async function requestMic(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const res = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title:          'Microphone Permission',
      message:        'Allow microphone access to answer the call.',
      buttonPositive: 'Allow',
    },
  );
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

// ─────────────────────────────────────────────────────────────────
// PulseRing
// ─────────────────────────────────────────────────────────────────
function PulseRing({ size, delay, color }: { size: number; delay: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 0,    useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const scale   = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 0.15, 0] });

  return (
    <Animated.View style={{
      position: 'absolute',
      width: size, height: size, borderRadius: size / 2,
      borderWidth: 1.5, borderColor: color,
      transform: [{ scale }], opacity,
    }} />
  );
}

// ─────────────────────────────────────────────────────────────────
// AvatarGlow
// ─────────────────────────────────────────────────────────────────
function AvatarGlow({ color }: { color: string }) {
  return (
    <Svg width={160} height={160} viewBox="0 0 160 160" style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
          <Stop offset="40%"  stopColor={color} stopOpacity={0}    />
          <Stop offset="100%" stopColor={color} stopOpacity={0.22} />
        </RadialGradient>
      </Defs>
      <Circle cx={80} cy={80} r={78} fill="url(#glow)" />
      <Circle
        cx={80} cy={80} r={72}
        stroke={color} strokeOpacity={0.18}
        strokeWidth={1} strokeDasharray="6 8"
        fill="none"
      />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────
// WaveformSVG
// ─────────────────────────────────────────────────────────────────
function WaveformSVG({ color }: { color: string }) {
  return (
    <Svg width={48} height={18} viewBox="0 0 48 18">
      {[4, 10, 16, 22, 28, 34, 40, 46].map((x, i) => {
        const heights = [6, 12, 16, 10, 14, 8, 12, 6];
        const h = heights[i];
        return (
          <Path
            key={x}
            d={`M${x} ${9 - h / 2} L${x} ${9 + h / 2}`}
            stroke={color} strokeWidth={2.5} strokeLinecap="round"
            opacity={0.7}
          />
        );
      })}
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────
type Props       = NativeStackScreenProps<RootStackParamList, 'IncomingCall'>;
type AcceptState = 'idle' | 'connecting' | 'error';

// ─────────────────────────────────────────────────────────────────
// IncomingCallScreen
// ─────────────────────────────────────────────────────────────────
export default function IncomingCallScreen({ route, navigation }: Props) {
  const { channel, token, appId, callerName } = route.params;

  const engineRef   = useRef<IRtcEngine | null>(null);
  const acceptedRef = useRef(false);
  const accentColor = avatarColor(callerName);
  const initial     = callerName.charAt(0).toUpperCase();

  const [acceptState, setAcceptState] = useState<AcceptState>('idle');
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);

  const acceptScale  = useRef(new Animated.Value(1)).current;
  const declineScale = useRef(new Animated.Value(1)).current;

  const pressFeedback = (anim: Animated.Value) =>
    Animated.sequence([
      Animated.spring(anim, { toValue: 0.88, friction: 4, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1,    friction: 4, useNativeDriver: true }),
    ]).start();

  // ── Ring haptic — single effect, runs only while idle ─────────
  // FIX 1: Split into two separate effects so mount (idle) and
  //         stop (non-idle) don't race inside one cleanup/re-run.
  // FIX 2: iOS interval is declared unconditionally so it is
  //         always clearable regardless of platform guard order.
  useEffect(() => {
    // Only vibrate while waiting for the user to respond
    if (acceptState !== 'idle') return;

    let iosInterval: ReturnType<typeof setInterval> | undefined;

    if (Platform.OS === 'android') {
      // FIX 3: Small delay so the component is fully painted before
      //        vibrating — prevents the pattern from being swallowed
      //        on some Android OEMs (Samsung, OnePlus) at mount time.
      const t = setTimeout(() => {
        Vibration.vibrate(ANDROID_RING_PATTERN, true);
      }, 300);
      return () => {
        clearTimeout(t);
        Vibration.cancel();
      };
    }

    // iOS — Taptic Engine double-tap every 1800 ms
    const fireTap = () => {
      ReactNativeHapticFeedback.trigger('impactMedium', HAPTIC_OPTS);
      setTimeout(
        () => ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTS),
        160,
      );
    };
    fireTap();
    iosInterval = setInterval(fireTap, 1800);

    return () => {
      if (iosInterval !== undefined) clearInterval(iosInterval);
    };
  }, [acceptState]);

  // ── Stop Android vibration whenever acceptState leaves idle ───
  useEffect(() => {
    if (Platform.OS === 'android' && acceptState !== 'idle') {
      Vibration.cancel();
    }
  }, [acceptState]);

  // ── Always cancel on unmount ──────────────────────────────────
  useEffect(() => {
    return () => {
      if (Platform.OS === 'android') Vibration.cancel();
      if (!acceptedRef.current) {
        engineRef.current?.leaveChannel();
        engineRef.current?.release();
        engineRef.current = null;
      }
    };
  }, []);

  // ── Accept ────────────────────────────────────────────────────
  const accept = useCallback(async () => {
    if (acceptState !== 'idle' && acceptState !== 'error') return;
    pressFeedback(acceptScale);
    hapticAccept();
    setAcceptState('connecting');
    setErrorMsg(null);

    try {
      const granted = await requestMic();
      if (!granted) throw new Error('Microphone permission denied');

      const rtcEngine = createAgoraRtcEngine();
      engineRef.current = rtcEngine;

      rtcEngine.initialize({ appId });
      rtcEngine.setChannelProfile(ChannelProfileType.ChannelProfileCommunication);
      rtcEngine.enableAudio();
      rtcEngine.setDefaultAudioRouteToSpeakerphone(false);

      rtcEngine.registerEventHandler({
        onJoinChannelSuccess: () => {
          console.log('[Agora Employee] ✅ Joined channel');
        },
        onError: (errCode) => {
          console.error('[Agora Employee] ❌ Error:', errCode);
          if (!acceptedRef.current) {
            hapticError();
            setErrorMsg(`Connection error (${errCode})`);
            setAcceptState('error');
            engineRef.current?.release();
            engineRef.current = null;
          }
        },
      });

      rtcEngine.joinChannel(token, channel, 2, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
      });

      acceptedRef.current = true;
      navigation.replace('EmployeeActiveCall', { channel, callerName, engine: rtcEngine });

    } catch (e: any) {
      hapticError();
      setErrorMsg(e?.message ?? 'Failed to join call');
      setAcceptState('error');
      acceptedRef.current = false;
      engineRef.current?.release();
      engineRef.current = null;
    }
  }, [acceptState, appId, token, channel, callerName, navigation]);

  // ── Decline ───────────────────────────────────────────────────
  const decline = useCallback(() => {
    pressFeedback(declineScale);
    hapticDecline();
    setTimeout(() => navigation.goBack(), 150);
  }, [navigation]);

  const isConnecting = acceptState === 'connecting';
  const isError      = acceptState === 'error';

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={MC.bg} />

      {/* ── Top badge ── */}
      <View style={s.topBadge}>
        <Radio size={11} color={MC.green} />
        <Text style={s.topLabel}>Incoming Voice Call</Text>
      </View>

      {/* ── Avatar section ── */}
      <View style={s.avatarSection}>
        <AvatarGlow color={accentColor} />
        <PulseRing size={128} delay={0}    color={accentColor} />
        <PulseRing size={128} delay={500}  color={accentColor} />
        <PulseRing size={128} delay={1000} color={accentColor} />
        <View style={[s.avatarRing, { borderColor: accentColor }]}>
          <View style={[s.avatar, { backgroundColor: `${accentColor}14` }]}>
            <Text style={[s.initial, { color: accentColor }]}>{initial}</Text>
          </View>
        </View>
      </View>

      {/* ── Caller info ── */}
      <View style={s.info}>
        <Text style={s.callerName}>{callerName}</Text>
        <View style={s.callerRoleRow}>
          <Mic size={10} color={MC.textFaint} />
          <Text style={s.callerRole}>Admin · Employee Tracker</Text>
        </View>

        {isConnecting && (
          <View style={s.connectingRow}>
            <WaveformSVG color={MC.gold} />
            <Text style={[s.statusText, { color: MC.gold }]}>Connecting…</Text>
          </View>
        )}

        {isError && errorMsg && (
          <View style={s.errorChip}>
            <AlertCircle size={12} color={MC.rose} />
            <Text style={[s.statusText, { color: MC.rose }]}>{errorMsg}</Text>
          </View>
        )}
      </View>

      {/* ── Action buttons ── */}
      <View style={s.actions}>
        <View style={s.actionWrap}>
          <Animated.View style={{ transform: [{ scale: declineScale }] }}>
            <TouchableOpacity
              style={[s.actionBtn, s.declineBtn]}
              onPress={decline}
              activeOpacity={0.8}
              disabled={isConnecting}
            >
              <PhoneOff size={28} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
          <Text style={s.actionLabel}>Decline</Text>
        </View>

        <View style={s.actionWrap}>
          <Animated.View style={{ transform: [{ scale: acceptScale }] }}>
            <TouchableOpacity
              style={[s.actionBtn, s.acceptBtn, isConnecting && s.actionBtnDisabled]}
              onPress={accept}
              activeOpacity={0.8}
              disabled={isConnecting}
            >
              {isConnecting
                ? <ActivityIndicator size="small" color="#fff" />
                : isError
                ? <PhoneCall size={28} color="#fff" />
                : <Phone     size={28} color="#fff" />}
            </TouchableOpacity>
          </Animated.View>
          <Text style={s.actionLabel}>
            {isConnecting ? 'Joining…' : isError ? 'Retry' : 'Accept'}
          </Text>
        </View>
      </View>

      {/* ── Hint ── */}
      <View style={s.hintRow}>
        <Mic size={11} color={MC.textFaint} />
        <Text style={s.hint}>
          {isError
            ? 'Tap Accept to retry the connection'
            : 'Your microphone will be activated on accept'}
        </Text>
      </View>
    </View>
  );
}

// Styles unchanged
const BTN = 76;
const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: MC.bg,
    alignItems: 'center', justifyContent: 'space-evenly',
    paddingVertical: 64, paddingHorizontal: 24,
  },
  topBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: MC.surface, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1, borderColor: MC.border,
  },
  topLabel: { fontSize: 11, color: MC.textSub, fontFamily: MF.mono, letterSpacing: 1, textTransform: 'uppercase' },
  avatarSection: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
  avatarRing: { width: 128, height: 128, borderRadius: 64, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatar:  { width: 114, height: 114, borderRadius: 57, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 46, fontWeight: '800', fontFamily: MF.display },
  info:       { alignItems: 'center', gap: 8 },
  callerName: { fontSize: 28, fontWeight: '800', color: MC.textPrimary, fontFamily: MF.display },
  callerRoleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  callerRole: { fontSize: 12, color: MC.textSub, fontFamily: MF.mono, letterSpacing: 0.5 },
  connectingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: `${MC.gold}12`, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: `${MC.gold}30`, marginTop: 4,
  },
  errorChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: MC.roseDim, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: `${MC.rose}40`, marginTop: 4,
  },
  statusText: { fontSize: 12, fontFamily: MF.mono, letterSpacing: 0.4 },
  actions:    { flexDirection: 'row', alignItems: 'center', gap: 64 },
  actionWrap: { alignItems: 'center', gap: 12 },
  actionBtn: {
    width: BTN, height: BTN, borderRadius: BTN / 2,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45,
    shadowRadius: 16, elevation: 10,
  },
  declineBtn:        { backgroundColor: MC.rose,  shadowColor: MC.rose  },
  acceptBtn:         { backgroundColor: MC.green, shadowColor: MC.green },
  actionBtnDisabled: { opacity: 0.55 },
  actionLabel: { fontSize: 11, color: MC.textSub, fontFamily: MF.mono, letterSpacing: 0.5, textTransform: 'uppercase' },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hint: { fontSize: 11, color: MC.textFaint, fontFamily: MF.mono, textAlign: 'center', maxWidth: 260, lineHeight: 18 },
});