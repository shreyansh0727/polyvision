// src/screens/employee/TrackingScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ScrollView, View, Text, StyleSheet,
  Alert, RefreshControl, AppState,
  AppStateStatus, Animated, TouchableOpacity,
  Switch, StatusBar,
} from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import DeviceInfo        from 'react-native-device-info';
import { useTracking }   from '../../hooks/useTracking';
import { useAuthStore }  from '../../store/authStore';
import { getIsTracking } from '../../services/locationService';
import { MC, MF, avatarColor } from '../../navigation/AppTheme';

// ── Lucide icons (react-native compatible) ────────────────────────
import {
  MapPin, Radio, BatteryMedium, BatteryLow, BatteryFull,
  BatteryCharging, Navigation, Clock, AlertCircle,
  LogOut, RefreshCw, WifiOff, User, Zap,
} from 'lucide-react-native';

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatCoord(n: number, dir: [string, string]): string {
  const abs = Math.abs(n);
  const d   = Math.floor(abs);
  const min = ((abs - d) * 60).toFixed(3);
  return `${d}° ${min}' ${n >= 0 ? dir[0] : dir[1]}`;
}

// ─────────────────────────────────────────────────────────────────
// TrackingGlow
// ─────────────────────────────────────────────────────────────────
function TrackingGlow({ active }: { active: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: active ? 1 : 0, duration: 600, useNativeDriver: true }).start();
  }, [active]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[s.glow, { opacity: anim }]}
    />
  );
}

// ─────────────────────────────────────────────────────────────────
// PulseRing — animated ring for the radar-style toggle button
// ─────────────────────────────────────────────────────────────────
function PulseRing({ active }: { active: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) { anim.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 0,    useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  const scale   = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 0.1, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[s.pulseRing, { transform: [{ scale }], opacity }]}
    />
  );
}

// ─────────────────────────────────────────────────────────────────
// BatteryIcon
// ─────────────────────────────────────────────────────────────────
function BatteryIcon({ level, size = 16 }: { level: number | null; size?: number }) {
  const color = level === null ? MC.textFaint
    : level <= 20 ? MC.rose
    : level <= 50 ? MC.gold
    : MC.green;

  if (level === null) return <BatteryMedium size={size} color={MC.textFaint} />;
  if (level <= 20)    return <BatteryLow    size={size} color={color} />;
  if (level <= 80)    return <BatteryMedium size={size} color={color} />;
  return                     <BatteryFull   size={size} color={color} />;
}

// ─────────────────────────────────────────────────────────────────
// SectionCard
// ─────────────────────────────────────────────────────────────────
function SectionCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[s.card, style]}>{children}</View>;
}

// ─────────────────────────────────────────────────────────────────
// TrackingScreen
// ─────────────────────────────────────────────────────────────────
export default function TrackingScreen() {
  const {
    isTracking, isStarting, isStopping,
    error, lastLocation, start, stop, clearError,
  } = useTracking();

  const employee = useAuthStore((s) => s.employee);
  const logout   = useAuthStore((s) => s.logout);

  const [shiftStart,   setShiftStart]   = useState<number | null>(null);
  const [shiftSeconds, setShiftSeconds] = useState(0);
  const [battery,      setBattery]      = useState<number | null>(null);
  const [refreshing,   setRefreshing]   = useState(false);
  const [bgWarning,    setBgWarning]    = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const accentColor = employee?.name ? avatarColor(employee.name) : MC.green;
  const initial     = employee?.name?.charAt(0).toUpperCase() ?? '?';

  // ── App state ──────────────────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev.match(/inactive|background/) && next === 'active') {
        setBgWarning(true);
        if (isTracking && !getIsTracking()) {
          console.warn('[TrackingScreen] Background service killed by OS');
          stop().catch(() => {});
        }
      }
      if (next.match(/inactive|background/)) setBgWarning(false);
    });
    return () => sub.remove();
  }, [isTracking, stop]);

  // ── Shift timer ────────────────────────────────────────────────
  useEffect(() => {
    if (!isTracking) { setShiftStart(null); setShiftSeconds(0); return; }
    if (!shiftStart) setShiftStart(Date.now());
  }, [isTracking]);

  useEffect(() => {
    if (!isTracking || !shiftStart) return;
    const id = setInterval(() => setShiftSeconds(Math.floor((Date.now() - shiftStart) / 1000)), 1000);
    return () => clearInterval(id);
  }, [isTracking, shiftStart]);

  // ── Battery ────────────────────────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      try { setBattery(Math.round((await DeviceInfo.getBatteryLevel()) * 100)); } catch (_) {}
    };
    fetch();
    const id = setInterval(fetch, 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Error auto-dismiss ─────────────────────────────────────────
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(clearError, 6000);
    return () => clearTimeout(id);
  }, [error, clearError]);

  // ── Toggle ─────────────────────────────────────────────────────
  const handleToggle = async (value: boolean) => {
    if (value) {
      try {
        await start();
      } catch (e: any) {
        Alert.alert('Tracking Failed', e?.message ?? 'Could not start tracking. Check permissions.', [
          { text: 'OK', onPress: clearError },
        ]);
      }
    } else {
      Alert.alert('Stop Tracking', 'Are you sure you want to stop location tracking?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Stop', style: 'destructive', onPress: () => stop().catch(() => {}) },
      ]);
    }
  };

  // ── Logout ─────────────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      isTracking ? 'Tracking is active. Signing out will stop it. Continue?' : 'Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out', style: 'destructive',
          onPress: async () => {
            try { if (isTracking) await stop(); } catch (_) {}
            await logout();
          },
        },
      ],
    );
  };

  // ── Pull-to-refresh ────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { setBattery(Math.round((await DeviceInfo.getBatteryLevel()) * 100)); } catch (_) {}
    setRefreshing(false);
  }, []);

  const isBusy = isStarting || isStopping;

  // ─────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={MC.bg} />
      <TrackingGlow active={isTracking} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={MC.green}
            colors={[MC.green]}
          />
        }
      >

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={[s.avatar, { backgroundColor: `${accentColor}18`, borderColor: accentColor }]}>
              <Text style={[s.avatarText, { color: accentColor }]}>{initial}</Text>
            </View>
            <View>
              <Text style={s.headerName}>{employee?.name ?? 'Employee'}</Text>
              <View style={s.headerRolePill}>
                <User size={9} color={MC.textFaint} />
                <Text style={s.headerRole}>{employee?.role ?? 'employee'}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
            <LogOut size={15} color={MC.rose} />
            <Text style={s.logoutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {/* ── Background warning ── */}
        {isTracking && bgWarning && (
          <SectionCard style={s.warnCard}>
            <WifiOff size={14} color={MC.gold} style={{ marginRight: 8 }} />
            <Text style={s.warnText}>
              App returned from background — location service verified active
            </Text>
          </SectionCard>
        )}

        {/* ── Error banner ── */}
        {!!error && (
          <TouchableOpacity style={s.errorCard} onPress={clearError} activeOpacity={0.8}>
            <AlertCircle size={14} color={MC.rose} />
            <Text style={s.errorText}>{error}</Text>
            <Text style={s.errorDismiss}>✕</Text>
          </TouchableOpacity>
        )}

        {/* ── Main tracking toggle card ── */}
        <SectionCard>
          {/* Status row */}
          <View style={s.statusRow}>
            <View style={[s.statusDot, { backgroundColor: isTracking ? MC.rose : MC.textFaint }]} />
            <Text style={[s.statusLabel, { color: isTracking ? MC.green : MC.textSub }]}>
              {isBusy
                ? isStarting ? 'Starting…' : 'Stopping…'
                : isTracking ? 'Tracking Active' : 'Tracking Inactive'}
            </Text>
          </View>

          {/* Radar toggle button */}
          <View style={s.radarWrap}>
            <PulseRing active={isTracking} />
            <TouchableOpacity
              style={[
                s.radarBtn,
                {
                  backgroundColor: isTracking ? `${MC.green}18` : MC.surfaceAlt,
                  borderColor:     isTracking ? MC.green : MC.border,
                },
              ]}
              onPress={() => handleToggle(!isTracking)}
              disabled={isBusy}
              activeOpacity={0.75}
            >
              {isTracking
                ? <Radio    size={32} color={MC.green} />
                : <MapPin   size={32} color={MC.textSub} />}
            </TouchableOpacity>
          </View>

          <Text style={s.radarHint}>
            {isBusy
              ? isStarting ? 'Requesting permissions…' : 'Stopping service…'
              : isTracking
              ? 'Tap to stop tracking'
              : 'Tap to start tracking'}
          </Text>

          {/* iOS / Android switch alternative */}
          <View style={s.switchRow}>
            <Text style={s.switchLabel}>Location Tracking</Text>
            <Switch
              value={isTracking}
              onValueChange={handleToggle}
              disabled={isBusy}
              trackColor={{ false: MC.border, true: `${MC.green}55` }}
              thumbColor={isTracking ? MC.green : MC.textFaint}
            />
          </View>
        </SectionCard>

        {/* ── Shift timer ── */}
        {isTracking && (
          <SectionCard>
            <View style={s.shiftHeader}>
              <Clock size={14} color={MC.textSub} />
              <Text style={s.shiftTitle}>Shift Duration</Text>
            </View>
            <Text style={s.shiftTime}>{formatDuration(shiftSeconds)}</Text>
            <Text style={s.shiftSub}>
              Started at{' '}
              {shiftStart
                ? new Date(shiftStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '—'}
            </Text>
          </SectionCard>
        )}

        {/* ── Last location ── */}
        {isTracking && lastLocation && (
          <SectionCard>
            <View style={s.locHeader}>
              <Navigation size={14} color={MC.blue} />
              <Text style={s.locTitle}>Last Known Position</Text>
            </View>
            <View style={s.coordRow}>
              <View style={s.coordBox}>
                <Text style={s.coordLabel}>LAT</Text>
                <Text style={s.coordValue}>
                  {formatCoord(lastLocation.lat,  ['N', 'S'])}
                </Text>
              </View>
              <View style={[s.coordBox, s.coordBoxRight]}>
                <Text style={s.coordLabel}>LON</Text>
                <Text style={s.coordValue}>
                  {formatCoord(lastLocation.lng, ['E', 'W'])}
                </Text>
              </View>
            </View>
            {lastLocation.accuracy !== undefined && (
              <Text style={s.accuracy}>
                ± {lastLocation.accuracy?.toFixed(0)} m accuracy
              </Text>
            )}
          </SectionCard>
        )}

        {/* ── Stats row ── */}
        <View style={s.statsRow}>
          {/* Battery */}
          <View style={s.statCard}>
            <BatteryIcon level={battery} size={18} />
            <Text style={s.statValue}>
              {battery !== null ? `${battery}%` : '—'}
            </Text>
            <Text style={s.statLabel}>Battery</Text>
          </View>

          {/* Role */}
          <View style={s.statCard}>
            <Zap size={18} color={MC.gold} />
            <Text style={s.statValue} numberOfLines={1}>
              {employee?.role ?? '—'}
            </Text>
            <Text style={s.statLabel}>Role</Text>
          </View>

          {/* Status */}
          <View style={s.statCard}>
            <View style={[s.statusDot, { backgroundColor: isTracking ? MC.green : MC.textFaint, alignSelf: 'center' }]} />
            <Text style={[s.statValue, { color: isTracking ? MC.green : MC.textFaint }]}>
              {isTracking ? 'Live' : 'Off'}
            </Text>
            <Text style={s.statLabel}>Status</Text>
          </View>
        </View>

        <View style={{ height: 8 }} />
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: MC.bg },
  scroll: { flex: 1 },
  container: { padding: 20, paddingBottom: 52 },

  glow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
    backgroundColor: MC.green,
    shadowColor: MC.green, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 12, elevation: 10, zIndex: 10,
  },

  // ── Header ──────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 20,
  },
  headerLeft:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  avatarText:    { fontSize: 18, fontWeight: '800', fontFamily: MF.display },
  headerName:    { fontSize: 15, fontWeight: '700', color: MC.textPrimary, fontFamily: MF.display },
  headerRolePill: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  headerRole:    { fontSize: 10, color: MC.textFaint, fontFamily: MF.mono, textTransform: 'capitalize' },
  logoutBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 8, borderRadius: 8, backgroundColor: MC.surfaceAlt },
  logoutText:    { fontSize: 11, color: MC.rose, fontFamily: MF.mono },

  // ── Cards ────────────────────────────────────────────────────────
  card: {
    backgroundColor: MC.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: MC.border,
    padding: 18,
    marginBottom: 14,
  },
  warnCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: MC.goldDim, borderColor: `${MC.gold}44`,
    paddingVertical: 12,
  },
  warnText:  { flex: 1, fontSize: 11, color: MC.gold, fontFamily: MF.mono, lineHeight: 16 },
  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: MC.roseDim, borderRadius: 12,
    borderWidth: 1, borderColor: `${MC.rose}44`,
    padding: 12, marginBottom: 14,
  },
  errorText:    { flex: 1, fontSize: 12, color: MC.rose, fontFamily: MF.mono },
  errorDismiss: { fontSize: 13, color: MC.rose },

  // ── Toggle card ──────────────────────────────────────────────────
  statusRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  statusDot:   { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12, fontFamily: MF.mono, fontWeight: '600', letterSpacing: 0.4 },

  radarWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 20, height: 90 },
  pulseRing: {
    position: 'absolute',
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 1.5, borderColor: MC.green,
  },
  radarBtn: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  radarHint:  { textAlign: 'center', fontSize: 11, color: MC.textFaint, fontFamily: MF.mono, marginBottom: 18 },
  switchRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 },
  switchLabel: { fontSize: 13, color: MC.textSub, fontFamily: MF.mono },

  // ── Shift timer ──────────────────────────────────────────────────
  shiftHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  shiftTitle:  { fontSize: 11, color: MC.textSub, fontFamily: MF.mono, textTransform: 'uppercase', letterSpacing: 0.6 },
  shiftTime:   { fontSize: 40, fontWeight: '800', color: MC.green, fontFamily: MF.display, letterSpacing: -1 },
  shiftSub:    { fontSize: 11, color: MC.textFaint, fontFamily: MF.mono, marginTop: 4 },

  // ── Location ─────────────────────────────────────────────────────
  locHeader:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  locTitle:   { fontSize: 11, color: MC.textSub, fontFamily: MF.mono, textTransform: 'uppercase', letterSpacing: 0.6 },
  coordRow:   { flexDirection: 'row', gap: 10 },
  coordBox:   { flex: 1, backgroundColor: MC.surfaceAlt, borderRadius: 10, padding: 12 },
  coordBoxRight: {},
  coordLabel: { fontSize: 9, color: MC.textFaint, fontFamily: MF.mono, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  coordValue: { fontSize: 12, color: MC.textPrimary, fontFamily: MF.mono },
  accuracy:   { fontSize: 10, color: MC.textFaint, fontFamily: MF.mono, marginTop: 8, textAlign: 'center' },

  // ── Stats ─────────────────────────────────────────────────────────
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  statCard: {
    flex: 1, backgroundColor: MC.surface,
    borderRadius: 14, borderWidth: 1, borderColor: MC.border,
    padding: 14, alignItems: 'center', gap: 6,
  },
  statValue: { fontSize: 14, fontWeight: '700', color: MC.textPrimary, fontFamily: MF.display, textTransform: 'capitalize' },
  statLabel: { fontSize: 9, color: MC.textFaint, fontFamily: MF.mono, textTransform: 'uppercase', letterSpacing: 0.8 },
});