// src/screens/admin/NotifyScreen.tsx
import React, {
  useState, useEffect, useCallback, useRef, memo,
} from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Animated, PermissionsAndroid,
} from 'react-native';
import {
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
  requestPermission,
  registerDeviceForRemoteMessages,
  AuthorizationStatus,
}                          from '@react-native-firebase/messaging';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Svg, { Circle, Path, Rect, Line, Polyline } from 'react-native-svg';
import {
  Users, Send, Bell, Eye, Mail,
  Search, X, CheckCircle, AlertCircle,
  Wifi, WifiOff, User, MessageSquare,
  Type, Info, Loader,
} from 'lucide-react-native';
import { apiGet, apiPost }  from '../../services/api';

// ─────────────────────────────────────────────────────────────────
// Design Tokens
// ─────────────────────────────────────────────────────────────────
const C = {
  bg:           '#080C14',
  surface:      '#0E1520',
  surfaceAlt:   '#131B28',
  surfaceLift:  '#1A2438',
  green:        '#10D876',
  greenGlow:    'rgba(16,216,118,0.18)',
  greenDim:     'rgba(16,216,118,0.08)',
  gold:         '#F4B942',
  goldDim:      'rgba(244,185,66,0.12)',
  rose:         '#F05A7E',
  roseDim:      'rgba(240,90,126,0.12)',
  blue:         '#4B8EF1',
  blueDim:      'rgba(75,142,241,0.12)',
  textPrimary:  '#E8EDF5',
  textSub:      '#8A95A8',
  textFaint:    '#3D4A5C',
  border:       '#1C2840',
  borderBright: '#2A3B55',
};

const F = {
  display: Platform.select({ ios: 'Georgia',  android: 'serif',     default: 'Georgia' }),
  mono:    Platform.select({ ios: 'Menlo',     android: 'monospace', default: 'monospace' }),
};

// ─────────────────────────────────────────────────────────────────
// Haptic helpers
// ─────────────────────────────────────────────────────────────────
const HAPTIC_OPTS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

const haptic = {
  tap:     () => ReactNativeHapticFeedback.trigger('impactLight',        HAPTIC_OPTS),
  select:  () => ReactNativeHapticFeedback.trigger('impactMedium',       HAPTIC_OPTS),
  success: () => ReactNativeHapticFeedback.trigger('notificationSuccess', HAPTIC_OPTS),
  error:   () => ReactNativeHapticFeedback.trigger('notificationError',   HAPTIC_OPTS),
  warning: () => ReactNativeHapticFeedback.trigger('notificationWarning', HAPTIC_OPTS),
};

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────
interface Employee {
  id:         string;
  name:       string;
  email:      string;
  role:       string;
  fcm_token?: string;
}

interface NotifyResult {
  success?:       boolean;
  message?:       string;
  status?:        string;
  detail?:        string;
  error?:         string;
  token_invalid?: boolean;
}

// ─────────────────────────────────────────────────────────────────
// FCM bootstrap
// ─────────────────────────────────────────────────────────────────
export async function bootstrapFCM(
  onToken: (token: string) => Promise<void>,
): Promise<void> {
  const messaging = getMessaging();

  if (Platform.OS === 'ios') {
    await registerDeviceForRemoteMessages(messaging);
  }

  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      console.warn('[FCM] POST_NOTIFICATIONS permission denied');
      return;
    }
  }

  const authStatus = await requestPermission(messaging);
  const isAuthorized =
    authStatus === AuthorizationStatus.AUTHORIZED ||
    authStatus === AuthorizationStatus.PROVISIONAL;

  if (!isAuthorized) {
    console.warn('[FCM] Notification permission not granted:', authStatus);
    return;
  }

  const token = await getToken(messaging);
  if (token) {
    console.log('[FCM] Token:', token);
    await onToken(token);
  }

  onTokenRefresh(messaging, async (newToken) => {
    console.log('[FCM] Token refreshed:', newToken);
    await onToken(newToken);
  });

  onMessage(messaging, async (remoteMessage) => {
    console.log('[FCM] Foreground message:', remoteMessage);
  });
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
function avatarColor(name: string): string {
  const palette = [C.green, C.gold, C.blue, '#A78BFA', '#FB923C'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function isResultSuccess(result: NotifyResult): boolean {
  if (result.success === false) return false;
  if (result.error)             return false;
  if (result.token_invalid)     return false;
  if (result.success === true)  return true;
  const ok  = ['ok', 'success', 'sent', 'delivered', 'queued'];
  const msg = (result.message ?? result.status ?? result.detail ?? '').toLowerCase();
  if (ok.some((w) => msg.includes(w))) return true;
  return true;
}

// ─────────────────────────────────────────────────────────────────
// SVG: Notification bell icon (used in preview card)
// ─────────────────────────────────────────────────────────────────
function BellSVG({ color = C.gold, size = 16 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      />
      <Path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────
// SVG: Waveform bars (decorative in preview)
// ─────────────────────────────────────────────────────────────────
function WaveformSVG({ color = C.gold }: { color?: string }) {
  const bars = [5, 9, 13, 8, 11, 6, 10, 5];
  return (
    <Svg width={36} height={14} viewBox="0 0 36 14">
      {bars.map((h, i) => (
        <Rect
          key={i}
          x={i * 4.5}
          y={(14 - h) / 2}
          width={2.5}
          height={h}
          rx={1.2}
          fill={color}
          opacity={0.65}
        />
      ))}
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────
// SVG: Rocket (send button)
// ─────────────────────────────────────────────────────────────────
function RocketSVG({ color = C.bg, size = 16 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      />
      <Path
        d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      />
      <Path
        d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      />
      <Path
        d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────
// PulseDot
// ─────────────────────────────────────────────────────────────────
const PulseDot = memo(function PulseDot({
  color = C.green, size = 7,
}: { color?: string; size?: number }) {
  const ring        = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(ring,        { toValue: 2.2, duration: 1200, useNativeDriver: true }),
          Animated.timing(ring,        { toValue: 1,   duration: 0,    useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(ringOpacity, { toValue: 0,   duration: 1200, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.8, duration: 0,    useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{
        position: 'absolute', width: size, height: size, borderRadius: size / 2,
        borderWidth: 1.5, borderColor: color,
        transform: [{ scale: ring }], opacity: ringOpacity,
      }} />
      <View style={{ width: size * 0.6, height: size * 0.6, borderRadius: size, backgroundColor: color }} />
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────
// SectionLabel  — now uses Lucide icons
// ─────────────────────────────────────────────────────────────────
type SectionIcon = 'users' | 'mail' | 'eye' | 'info';

const SECTION_ICONS: Record<SectionIcon, React.ReactNode> = {
  users: <Users  size={13} color={C.textFaint} />,
  mail:  <Mail   size={13} color={C.textFaint} />,
  eye:   <Eye    size={13} color={C.textFaint} />,
  info:  <Info   size={13} color={C.textFaint} />,
};

function SectionLabel({ label, icon }: { label: string; icon: SectionIcon }) {
  return (
    <View style={secStyles.row}>
      {SECTION_ICONS[icon]}
      <Text style={secStyles.label}>{label}</Text>
      <View style={secStyles.line} />
    </View>
  );
}

const secStyles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  label: {
    fontSize: 10, fontWeight: '800', color: C.textFaint,
    fontFamily: F.mono, letterSpacing: 1.5, textTransform: 'uppercase',
  },
  line:  { flex: 1, height: 1, backgroundColor: C.border },
});

// ─────────────────────────────────────────────────────────────────
// EmployeeRow
// ─────────────────────────────────────────────────────────────────
const EmployeeRow = memo(function EmployeeRow({
  item, isSelected, onPress,
}: { item: Employee; isSelected: boolean; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const hasToken  = !!item.fcm_token;
  const accent    = avatarColor(item.name);
  const initial   = item.name.charAt(0).toUpperCase();

  const pressIn  = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true }).start();

  const handlePress = useCallback(() => {
    haptic.select();
    onPress();
  }, [onPress]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[
          empStyles.row,
          isSelected && { borderColor: accent, borderTopColor: accent, backgroundColor: `${accent}0D` },
        ]}
        onPress={handlePress} onPressIn={pressIn} onPressOut={pressOut} activeOpacity={1}
      >
        {isSelected && <View style={[empStyles.selectedBar, { backgroundColor: accent }]} />}

        {/* Avatar */}
        <View style={[empStyles.avatarRing, { borderColor: isSelected ? accent : C.border }]}>
          <View style={[empStyles.avatar, { backgroundColor: isSelected ? `${accent}18` : C.surfaceAlt }]}>
            <Text style={[empStyles.initial, { color: isSelected ? accent : C.textSub }]}>{initial}</Text>
          </View>
        </View>

        {/* Info */}
        <View style={empStyles.info}>
          <Text style={[empStyles.name, isSelected && { color: accent }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={empStyles.emailRow}>
            <Mail size={10} color={C.textFaint} />
            <Text style={empStyles.email} numberOfLines={1}>{item.email}</Text>
          </View>
          <View style={empStyles.tokenRow}>
            {hasToken
              ? <CheckCircle size={9} color={C.green} />
              : <WifiOff     size={9} color={C.textFaint} />
            }
            <Text style={[empStyles.tokenStatus, { color: hasToken ? C.green : C.textFaint }]}>
              {hasToken ? 'Device registered' : 'No device token'}
            </Text>
          </View>
        </View>

        {/* Status dot */}
        <View style={empStyles.tokenWrap}>
          {hasToken
            ? <PulseDot color={C.green} size={8} />
            : <View style={empStyles.tokenOff} />
          }
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const empStyles = StyleSheet.create({
  row:         {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: C.border, borderTopColor: C.borderBright,
    overflow: 'hidden', gap: 10,
  },
  selectedBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  avatarRing:  { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  avatar:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  initial:     { fontSize: 15, fontWeight: '800', fontFamily: F.display },
  info:        { flex: 1, gap: 3 },
  name:        { fontSize: 13, fontWeight: '700', color: C.textPrimary, fontFamily: F.display },
  emailRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  email:       { fontSize: 11, color: C.textSub, fontFamily: F.mono },
  tokenRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tokenStatus: { fontSize: 9, fontFamily: F.mono, fontWeight: '700', letterSpacing: 0.5 },
  tokenWrap:   { width: 20, alignItems: 'center' },
  tokenOff:    { width: 8, height: 8, borderRadius: 4, backgroundColor: C.textFaint },
});

// ─────────────────────────────────────────────────────────────────
// SkeletonRow
// ─────────────────────────────────────────────────────────────────
function SkeletonRow() {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] });
  return (
    <Animated.View style={[skelStyles.row, { opacity }]}>
      <View style={skelStyles.avatar} />
      <View style={skelStyles.lines}>
        <View style={skelStyles.lineWide} />
        <View style={skelStyles.lineNarrow} />
        <View style={skelStyles.lineThin} />
      </View>
      <View style={skelStyles.dot} />
    </Animated.View>
  );
}

const SKEL = C.surfaceLift;
const skelStyles = StyleSheet.create({
  row:        {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: C.border, gap: 10,
  },
  avatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: SKEL },
  lines:      { flex: 1, gap: 7 },
  lineWide:   { height: 11, borderRadius: 6, backgroundColor: SKEL, width: '55%' },
  lineNarrow: { height: 9,  borderRadius: 5, backgroundColor: SKEL, width: '45%' },
  lineThin:   { height: 8,  borderRadius: 4, backgroundColor: SKEL, width: '30%' },
  dot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: SKEL },
});

// ─────────────────────────────────────────────────────────────────
// NotificationPreview  — uses SVG + Lucide
// ─────────────────────────────────────────────────────────────────
function NotificationPreview({ title, body, recipientName }: {
  title: string; body: string; recipientName?: string;
}) {
  const slideAnim   = useRef(new Animated.Value(12)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim,   { toValue: 0, friction: 9, tension: 120, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 250,             useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[previewStyles.card, { transform: [{ translateY: slideAnim }], opacity: opacityAnim }]}>
      {/* Gold accent top bar */}
      <View style={previewStyles.accentBar} />

      <View style={previewStyles.inner}>
        {/* Header row */}
        <View style={previewStyles.header}>
          {/* App icon using SVG Bell */}
          <View style={previewStyles.appIconWrap}>
            <BellSVG color={C.gold} size={14} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={previewStyles.appName}>NOTIFICATION PREVIEW</Text>
            {recipientName && (
              <View style={previewStyles.recipientRow}>
                <User size={9} color={C.gold} />
                <Text style={previewStyles.recipient}>{recipientName}</Text>
              </View>
            )}
          </View>

          {/* Waveform + timestamp */}
          <View style={previewStyles.rightCol}>
            <WaveformSVG color={C.gold} />
            <Text style={previewStyles.nowLabel}>now</Text>
          </View>
        </View>

        <View style={previewStyles.divider} />

        {/* Content */}
        <Text style={previewStyles.title} numberOfLines={2}>{title || '—'}</Text>
        {body ? <Text style={previewStyles.body} numberOfLines={3}>{body}</Text> : null}
      </View>
    </Animated.View>
  );
}

const previewStyles = StyleSheet.create({
  card:         {
    borderRadius: 18, overflow: 'hidden', backgroundColor: C.surfaceLift,
    borderWidth: 1, borderColor: C.borderBright,
    shadowColor: C.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 6, marginTop: 16,
  },
  accentBar:    { height: 3, backgroundColor: C.gold },
  inner:        { padding: 14 },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  appIconWrap:  {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: C.goldDim,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.gold + '33',
  },
  appName:      { fontSize: 8, fontWeight: '800', color: C.textFaint, fontFamily: F.mono, letterSpacing: 1.5 },
  recipientRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  recipient:    { fontSize: 10, fontWeight: '600', color: C.gold, fontFamily: F.mono },
  rightCol:     { alignItems: 'flex-end', gap: 3 },
  nowLabel:     { fontSize: 9, color: C.textFaint, fontFamily: F.mono },
  divider:      { height: 1, backgroundColor: C.border, marginVertical: 10 },
  title:        { fontSize: 14, fontWeight: '800', color: C.textPrimary, fontFamily: F.display, marginBottom: 4 },
  body:         { fontSize: 12, color: C.textSub, fontFamily: F.mono, lineHeight: 18 },
});

// ─────────────────────────────────────────────────────────────────
// FieldLabel  — uses Lucide
// ─────────────────────────────────────────────────────────────────
type FieldIcon = 'type' | 'message';

function FieldLabel({ label, icon }: { label: string; icon?: FieldIcon }) {
  return (
    <View style={fieldStyles.row}>
      {icon === 'type'    && <Type          size={10} color={C.textFaint} />}
      {icon === 'message' && <MessageSquare size={10} color={C.textFaint} />}
      <Text style={fieldStyles.label}>{label}</Text>
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8, marginTop: 16 },
  label: {
    fontSize: 10, fontWeight: '700', color: C.textFaint,
    fontFamily: F.mono, letterSpacing: 1.2, textTransform: 'uppercase',
  },
});

// ─────────────────────────────────────────────────────────────────
// NotifyScreen
// ─────────────────────────────────────────────────────────────────
export default function NotifyScreen() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected,  setSelected]  = useState<Employee | null>(null);
  const [title,     setTitle]     = useState('');
  const [body,      setBody]      = useState('');
  const [loading,   setLoading]   = useState(false);
  const [fetching,  setFetching]  = useState(true);
  const [search,    setSearch]    = useState('');

  useEffect(() => {
    (async () => {
      try {
        const messaging = getMessaging();
        if (Platform.OS === 'ios') await registerDeviceForRemoteMessages(messaging);
        const token = await getToken(messaging);
        console.log('[NotifyScreen] This device FCM token:', token);
      } catch (e) {
        console.warn('[NotifyScreen] Could not get FCM token:', e);
      }
    })();
  }, []);

  useEffect(() => {
    apiGet<Employee[]>('/employees/')
      .then(setEmployees)
      .catch(() => {
        haptic.error();
        Alert.alert('Error', 'Failed to load employees');
      })
      .finally(() => setFetching(false));
  }, []);

  const handleSend = async () => {
    if (!selected) {
      haptic.warning();
      return Alert.alert('Select an employee first');
    }
    if (!title.trim()) {
      haptic.warning();
      return Alert.alert('Enter a notification title');
    }
    if (!body.trim()) {
      haptic.warning();
      return Alert.alert('Enter a message body');
    }

    if (!selected.fcm_token) {
      haptic.warning();
      return Alert.alert(
        'Device not registered',
        `${selected.name} has no FCM token on file.\n\nAsk them to:\n1. Open the app\n2. Allow notification permission\n3. Wait a moment for the token to register`,
      );
    }

    haptic.tap();
    setLoading(true);

    try {
      const result = await apiPost<NotifyResult>(
        '/admin/notify',
        { employee_id: selected.id, title: title.trim(), body: body.trim() },
      );

      console.log('[NotifyScreen] /admin/notify response:', JSON.stringify(result));

      if (result.token_invalid) {
        haptic.error();
        Alert.alert(
          'Token Invalid',
          `The device token for ${selected.name} is expired or from a different app install.\n\nAsk them to reopen the app so a fresh token is registered.`,
        );
        return;
      }

      if (!isResultSuccess(result)) {
        haptic.error();
        Alert.alert('Send Failed', result.error ?? 'Unknown FCM error');
        return;
      }

      haptic.success();
      Alert.alert('✅ Sent', `Notification delivered to ${selected.name}`);
      setTitle('');
      setBody('');
      setSelected(null);

    } catch (e: any) {
      haptic.error();
      Alert.alert('Failed', e?.message ?? 'Could not send notification');
    } finally {
      setLoading(false);
    }
  };

  const filtered = employees.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase()),
  );

  const showPreview = title.trim().length > 0 || body.trim().length > 0;
  const sendAccent  = selected ? avatarColor(selected.name) : C.green;

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Page header ── */}
        <View style={s.pageHeader}>
          <View style={s.pageTitleRow}>
            <View style={s.pageTitleIcon}>
              <Bell size={16} color={C.gold} />
            </View>
            <View>
              <Text style={s.pageTitle}>Send Notification</Text>
              <Text style={s.pageSub}>Push a message to any team member's device</Text>
            </View>
          </View>
        </View>

        {/* ── Employee list ── */}
        <SectionLabel label="Select Employee" icon="users" />

        {/* Search bar */}
        <View style={s.searchWrap}>
          <Search size={14} color={C.textFaint} />
          <TextInput
            style={s.search}
            placeholder="Search by name or email…"
            placeholderTextColor={C.textFaint}
            value={search}
            onChangeText={(t) => { haptic.tap(); setSearch(t); }}
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => { haptic.tap(); setSearch(''); }}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <X size={14} color={C.textFaint} />
            </TouchableOpacity>
          )}
        </View>

        {/* Legend */}
        <View style={s.legendRow}>
          <View style={s.legendItem}>
            <PulseDot color={C.green} size={8} />
            <Text style={s.legendText}>Device registered</Text>
          </View>
          <View style={s.legendItem}>
            <WifiOff size={10} color={C.textFaint} />
            <Text style={s.legendText}>No token yet</Text>
          </View>
        </View>

        {/* Employee list / skeleton */}
        {fetching ? (
          <View style={s.skeletonList}>
            {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(e) => e.id}
            scrollEnabled={false}
            contentContainerStyle={s.empList}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item }) => (
              <EmployeeRow
                item={item}
                isSelected={selected?.id === item.id}
                onPress={() => setSelected(selected?.id === item.id ? null : item)}
              />
            )}
            ListEmptyComponent={
              <View style={s.emptyWrap}>
                <Users size={28} color={C.textFaint} style={{ marginBottom: 8 }} />
                <Text style={s.emptyText}>No employees found</Text>
              </View>
            }
          />
        )}

        {/* ── Compose ── */}
        <View style={s.sectionGap} />
        <SectionLabel label="Compose Message" icon="mail" />

        <FieldLabel label="Title" icon="type" />
        <TextInput
          style={s.input}
          placeholder="e.g. New task assigned"
          placeholderTextColor={C.textFaint}
          value={title}
          onChangeText={setTitle}
          editable={!loading}
        />

        <FieldLabel label="Message" icon="message" />
        <TextInput
          style={[s.input, s.inputMulti]}
          placeholder="Write your message…"
          placeholderTextColor={C.textFaint}
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          editable={!loading}
        />

        {/* ── Preview ── */}
        {showPreview && (
          <>
            <View style={s.sectionGap} />
            <SectionLabel label="Preview" icon="eye" />
            <NotificationPreview title={title} body={body} recipientName={selected?.name} />
          </>
        )}

        {/* ── Send button ── */}
        <TouchableOpacity
          style={[
            s.sendBtn,
            selected && {
              borderColor:  `${sendAccent}44`,
              shadowColor:  sendAccent,
              backgroundColor: selected ? C.green : C.surfaceLift,
            },
            (!selected || loading) && s.sendBtnDisabled,
          ]}
          onPress={handleSend}
          activeOpacity={0.82}
          disabled={!selected || loading}
        >
          {loading ? (
            <ActivityIndicator color={C.bg} />
          ) : (
            <View style={s.sendBtnInner}>
              {selected
                ? <RocketSVG color={C.bg} size={16} />
                : <Send size={15} color={C.textFaint} />
              }
              <Text style={[s.sendBtnText, !selected && { color: C.textFaint }]}>
                {selected ? `Send to ${selected.name}` : 'Select an employee first'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Info box ── */}
        <View style={s.infoBox}>
          <Info size={14} color={C.blue} style={{ marginTop: 1 }} />
          <Text style={s.infoText}>
            Notifications only appear in the system tray when the app is in the
            background or closed. If the recipient has the app open, the message
            is handled in-app and won't show as a banner.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: C.bg },
  scroll:          { padding: 16, paddingBottom: 60 },

  pageHeader:      { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 24 },
  pageTitleRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pageTitleIcon:   {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.goldDim,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.gold + '33',
  },
  pageTitle:       { fontSize: 18, fontWeight: '800', color: C.textPrimary, fontFamily: F.display },
  pageSub:         { fontSize: 11, color: C.textFaint, fontFamily: F.mono, marginTop: 2 },

  searchWrap:      {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderWidth: 1,
    borderColor: C.border, borderTopColor: C.borderBright,
    borderRadius: 12, paddingHorizontal: 12, gap: 8, marginBottom: 10,
  },
  search:          { flex: 1, paddingVertical: 11, fontSize: 13, color: C.textPrimary, fontFamily: F.mono },
  searchClear:     { fontSize: 11, color: C.textFaint, fontWeight: '700', padding: 2 },

  legendRow:       { flexDirection: 'row', gap: 16, marginBottom: 10 },
  legendItem:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText:      { fontSize: 10, color: C.textFaint, fontFamily: F.mono },

  skeletonList:    { gap: 8 },
  empList:         {},
  emptyWrap:       { paddingVertical: 32, alignItems: 'center' },
  emptyText:       { fontSize: 12, color: C.textFaint, fontFamily: F.mono },

  sectionGap:      { height: 24 },

  input:           {
    backgroundColor: C.surface, borderWidth: 1,
    borderColor: C.border, borderTopColor: C.borderBright,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 14, color: C.textPrimary, fontFamily: F.mono,
  },
  inputMulti:      { minHeight: 110, paddingTop: 13 },

  sendBtn:         {
    backgroundColor: C.green, borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 28,
    borderWidth: 1, borderColor: C.greenGlow,
    shadowColor: C.green, shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 8,
  },
  sendBtnDisabled: { backgroundColor: C.surfaceLift, borderColor: C.border, shadowOpacity: 0, elevation: 0 },
  sendBtnInner:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sendBtnText:     { color: C.bg, fontWeight: '800', fontSize: 14, fontFamily: F.mono, letterSpacing: 0.5 },

  infoBox:         {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: C.surfaceAlt, borderRadius: 12, padding: 12,
    marginTop: 16, borderWidth: 1, borderColor: C.border,
  },
  infoText:        { flex: 1, fontSize: 11, color: C.textFaint, fontFamily: F.mono, lineHeight: 17 },
});