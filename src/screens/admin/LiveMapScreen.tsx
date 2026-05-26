/**
 * src/screens/admin/LiveMapScreen.tsx
 *
 * Production-hardened: error boundaries, null-safety, stable callbacks,
 * memory-leak prevention, accessibility, defensive type narrowing,
 * graceful degradation, and clean-up on every effect.
 */

import React, {
  useRef, useState, useMemo, useEffect, useCallback, memo, Component,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, StatusBar, Platform, AccessibilityInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useFocusEffect } from '@react-navigation/native';
import {
  MapPin, Users, Clock,
  BatteryLow, BatteryMedium, BatteryFull,
  X, Wifi, WifiOff, LocateFixed, CloudOff,
} from 'lucide-react-native';

import { useAdminRealtimeMap } from '../../hooks/useAdminRealtimeMap';
import { useLocationStore }    from '../../store/locationStore';
import { useOfflineStore }     from '../../store/offlineStore';
import { LiveEmployee }        from '../../types';
import EmployeeMarker          from '../../components/map/EmployeeMarker';
import EmployeeListPanel       from '../../components/map/EmployeeListPanel';
import { MC }                  from '../../navigation/AppTheme';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Lucknow, Uttar Pradesh — sensible India-wide default */
const DEFAULT_REGION: Region = {
  latitude: 26.8467,
  longitude: 80.9462,
  latitudeDelta: 5,
  longitudeDelta: 5,
};

/** How long "new employee" pulse lasts (ms) */
const NEW_ID_TTL_MS = 600;

/** Animate-to zoom when focusing an employee */
const FOCUS_DELTA = 0.008;

/** Slide animation durations (ms) */
const CARD_SPRING_FRICTION  = 10;
const CARD_SPRING_TENSION   = 130;
const CARD_DISMISS_DURATION = 200;

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  tealDark:   '#085041',
  teal:       '#0F6E56',
  tealLight:  '#E1F5EE',
  pink:       '#993356',
  pinkLight:  '#FBEAF0',
  amber:      '#BA7517',
  amberLight: '#FAEEDA',
  green:      '#3B6D11',
  greenLight: '#EAF3DE',
  blue:       '#185FA5',
  blueLight:  '#E6F1FB',
  ink:        '#1c1c1a',
  inkMid:     '#44433f',
  muted:      '#7a7974',
  surface:    '#ffffff',
  surfaceAlt: '#f7f6f2',
  border:     '#e8e6e0',
} as const;

// ─── Type guards ──────────────────────────────────────────────────────────────

function isValidCoord(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    isFinite(lat) && isFinite(lng) &&
    lat >= -90  && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

function safeEmployeeId(emp: LiveEmployee): string {
  return emp.employee_id ?? '';
}

// ─── Error Boundary ───────────────────────────────────────────────────────────

interface ErrorBoundaryState { hasError: boolean; message: string }

class MapErrorBoundary extends Component<
  React.PropsWithChildren<{ fallback?: React.ReactNode }>,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Replace with your production logger (Sentry, Datadog, etc.)
    if (__DEV__) {
      console.error('[LiveMapScreen] Uncaught render error:', error, info.componentStack);
    }
  }

  handleRetry = () => this.setState({ hasError: false, message: '' });

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <View style={eb.container}>
          <Text style={eb.title}>Something went wrong</Text>
          <Text style={eb.sub}>{this.state.message}</Text>
          <TouchableOpacity style={eb.btn} onPress={this.handleRetry}>
            <Text style={eb.btnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const eb = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title:     { fontSize: 16, fontWeight: '700', color: C.ink, marginBottom: 8 },
  sub:       { fontSize: 13, color: C.muted, textAlign: 'center', marginBottom: 20 },
  btn:       { backgroundColor: C.tealDark, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  btnText:   { color: C.tealLight, fontWeight: '700', fontSize: 14 },
});

// ─── BatteryIcon ──────────────────────────────────────────────────────────────

const BATTERY_HIGH  = 50;
const BATTERY_LOW   = 20;

function batteryColor(level: number): string {
  if (level > BATTERY_HIGH) return C.green;
  if (level > BATTERY_LOW)  return C.amber;
  return C.pink;
}

function BatteryIcon({ level, size = 14 }: { level: number; size?: number }) {
  const color = batteryColor(level);
  if (level <= BATTERY_LOW)  return <BatteryLow    size={size} color={color} />;
  if (level <= BATTERY_HIGH) return <BatteryMedium size={size} color={color} />;
  return                            <BatteryFull   size={size} color={color} />;
}

// ─── StatusPinSVG ─────────────────────────────────────────────────────────────

function StatusPinSVG({ color = C.teal }: { color?: string }) {
  return (
    <Svg width={36} height={44} viewBox="0 0 36 44" accessibilityElementsHidden>
      <Defs>
        <RadialGradient id="pg" cx="50%" cy="40%" r="55%">
          <Stop offset="0%"   stopColor={color} stopOpacity={0.25} />
          <Stop offset="100%" stopColor={color} stopOpacity={0.05} />
        </RadialGradient>
      </Defs>
      <Path
        d="M18 40 C10 40 6 38 6 36 C6 34 11 33 18 33 C25 33 30 34 30 36 C30 38 26 40 18 40Z"
        fill={color} opacity={0.15}
      />
      <Path
        d="M18 2C10.268 2 4 8.268 4 16C4 24 18 38 18 38C18 38 32 24 32 16C32 8.268 25.732 2 18 2Z"
        fill={color} opacity={0.18}
      />
      <Path
        d="M18 4C11.373 4 6 9.373 6 16C6 23.2 18 36 18 36C18 36 30 23.2 30 16C30 9.373 24.627 4 18 4Z"
        fill={color} opacity={0.7}
      />
      <Circle cx={18} cy={16} r={6} fill={C.surface} opacity={0.9} />
    </Svg>
  );
}

// ─── SeedingDots ──────────────────────────────────────────────────────────────

function SeedingDots() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" accessibilityElementsHidden>
      <Circle
        cx={9} cy={9} r={7}
        stroke={C.teal} strokeWidth={1.5}
        strokeDasharray="4 3" fill="none" strokeLinecap="round"
      />
    </Svg>
  );
}

// ─── InfoRow ──────────────────────────────────────────────────────────────────

interface InfoRowProps {
  icon:   React.ReactNode;
  iconBg: string;
  label:  string;
  value:  string;
  mono?:  boolean;
}

function InfoRow({ icon, iconBg, label, value, mono }: InfoRowProps) {
  return (
    <View style={cs.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={[cs.iconPill, { backgroundColor: iconBg }]}>{icon}</View>
      <View style={cs.rowTexts}>
        <Text style={cs.rowLabel}>{label}</Text>
        <Text
          style={[cs.rowValue, mono && cs.monoValue]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

// ─── BatteryRow ───────────────────────────────────────────────────────────────

function BatteryRow({ battery, color, bg }: { battery: number; color: string; bg: string }) {
  // Clamp to 0–100 for the width style — avoids layout glitches on bad data
  const pct = Math.min(100, Math.max(0, Math.round(battery)));
  return (
    <View style={cs.row} accessible accessibilityLabel={`Battery: ${pct}%`}>
      <View style={[cs.iconPill, { backgroundColor: bg }]}>
        <BatteryIcon level={battery} size={14} />
      </View>
      <View style={cs.rowTexts}>
        <Text style={cs.rowLabel}>Battery</Text>
        <View style={cs.batteryBar}>
          <View style={cs.batteryTrack}>
            {/* Use a concrete pixel-percent via flex instead of template literal */}
            <View style={[cs.batteryFill, { flex: pct / 100, backgroundColor: color }]} />
          </View>
          <Text style={[cs.batteryPct, { color }]}>{pct}%</Text>
        </View>
      </View>
    </View>
  );
}

// ─── EmployeeInfoCard ─────────────────────────────────────────────────────────

interface EmployeeInfoCardProps {
  employee:     LiveEmployee;
  onClose:      () => void;
  onFocus:      (emp: LiveEmployee) => void;
  bottomOffset: number;
}

const EmployeeInfoCard = memo(function EmployeeInfoCard({
  employee,
  onClose,
  onFocus,
  bottomOffset,
}: EmployeeInfoCardProps) {
  const slideAnim = useRef(new Animated.Value(140)).current;
  const dismissedRef = useRef(false); // prevent double-fire

  useEffect(() => {
    const anim = Animated.spring(slideAnim, {
      toValue: 0, friction: CARD_SPRING_FRICTION, tension: CARD_SPRING_TENSION,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [slideAnim]);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    const anim = Animated.timing(slideAnim, {
      toValue: 180, duration: CARD_DISMISS_DURATION, useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished) onClose();
    });
  }, [onClose, slideAnim]);

  const handleFocusPress = useCallback(() => {
    onFocus(employee);
    dismiss();
  }, [onFocus, employee, dismiss]);

  const isOnline    = employee.is_online === true;
  const displayName = (employee.name ?? '').trim() || 'Unknown';
  const initial     = displayName.charAt(0).toUpperCase();

  // Memoised so the card body doesn't re-render on unrelated store ticks
  const timeAgo = useMemo(() => {
    if (!employee.recorded_at) return '—';
    try {
      const ts   = new Date(employee.recorded_at).getTime();
      if (isNaN(ts)) return '—';
      const diff = Math.floor((Date.now() - ts) / 1000);
      if (diff < 60)    return 'Just now';
      if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return new Date(employee.recorded_at).toLocaleDateString('en-IN');
    } catch {
      return '—';
    }
  }, [employee.recorded_at]);

  const battery = employee.battery ?? null;
  const bColor  = battery == null ? C.muted  : batteryColor(battery);
  const bBg     = battery == null ? '#f3f0ec'
                : battery > BATTERY_HIGH ? C.greenLight
                : battery > BATTERY_LOW  ? C.amberLight
                : C.pinkLight;

  const hasCoords = isValidCoord(employee.lat, employee.lng);
  const coordText = hasCoords
    ? `${(employee.lat as number).toFixed(5)}, ${(employee.lng as number).toFixed(5)}`
    : '—';

  const cardBottom = 100 + bottomOffset;

  return (
    <Animated.View
      style={[cs.card, { bottom: cardBottom, transform: [{ translateY: slideAnim }] }]}
      accessible
      accessibilityViewIsModal
      accessibilityLabel={`Employee details for ${displayName}`}
    >
      {/* Header */}
      <View style={cs.header}>
        <View style={[cs.avatar, { backgroundColor: isOnline ? C.tealLight : '#f3f0ec' }]}>
          <Text
            style={[cs.avatarText, { color: isOnline ? C.tealDark : C.muted }]}
            accessibilityElementsHidden
          >
            {initial}
          </Text>
        </View>

        <View style={cs.headerMid}>
          <Text style={cs.name} numberOfLines={1} ellipsizeMode="tail">{displayName}</Text>
          {!!employee.role && (
            <Text style={cs.role} numberOfLines={1}>{employee.role}</Text>
          )}
        </View>

        <View
          style={[cs.pill, { backgroundColor: isOnline ? C.tealLight : C.pinkLight }]}
          accessible
          accessibilityLabel={isOnline ? 'Status: Online' : 'Status: Offline'}
        >
          {isOnline
            ? <Wifi    size={10} color={C.teal} />
            : <WifiOff size={10} color={C.pink} />}
          <Text style={[cs.pillText, { color: isOnline ? C.tealDark : C.pink }]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>

        <TouchableOpacity
          style={cs.closeBtn}
          onPress={dismiss}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Close employee details"
        >
          <X size={13} color={C.muted} />
        </TouchableOpacity>
      </View>

      <View style={cs.divider} />

      {/* Info rows */}
      <View style={cs.rows}>
        <InfoRow
          icon={<MapPin size={14} color={C.blue} />}
          iconBg={C.blueLight}
          label="Location"
          value={coordText}
          mono
        />
        <InfoRow
          icon={<Clock size={14} color={C.amber} />}
          iconBg={C.amberLight}
          label="Last seen"
          value={timeAgo}
        />
        {battery != null && (
          <BatteryRow battery={battery} color={bColor} bg={bBg} />
        )}
      </View>

      {/* Focus CTA — only when valid coords exist */}
      {hasCoords && (
        <TouchableOpacity
          style={cs.focusBtn}
          onPress={handleFocusPress}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Focus map on ${displayName}`}
        >
          <LocateFixed size={14} color={C.tealLight} />
          <Text style={cs.focusBtnText}>Focus on map</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
});

// ─── Card Styles ──────────────────────────────────────────────────────────────

const cs = StyleSheet.create({
  card: {
    position: 'absolute', left: 14, right: 14,
    backgroundColor: C.surface, borderRadius: 22, padding: 18,
    elevation: 14,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    borderWidth: 0.5, borderColor: C.border,
  },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar:       { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:   { fontSize: 18, fontWeight: '700' },
  headerMid:    { flex: 1, minWidth: 0 },
  name:         { fontSize: 15, fontWeight: '700', color: C.ink },
  role:         { fontSize: 11, color: C.muted, marginTop: 2 },
  pill:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  pillText:     { fontSize: 11, fontWeight: '700' },
  closeBtn:     { width: 28, height: 28, borderRadius: 8, backgroundColor: '#f3f0ec', alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  divider:      { height: 0.5, backgroundColor: C.border, marginVertical: 14 },
  rows:         { gap: 10 },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconPill:     { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowTexts:     { flex: 1, minWidth: 0 },
  rowLabel:     { fontSize: 10, color: C.muted, marginBottom: 1 },
  rowValue:     { fontSize: 12, fontWeight: '600', color: C.ink },
  monoValue:    { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 10 },
  batteryBar:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  batteryTrack: { flex: 1, flexDirection: 'row', height: 4, backgroundColor: '#f0ede8', borderRadius: 2, overflow: 'hidden' },
  batteryFill:  { height: 4, borderRadius: 2 },
  batteryPct:   { fontSize: 11, fontWeight: '700', minWidth: 28, textAlign: 'right' },
  focusBtn:     { marginTop: 16, backgroundColor: C.tealDark, borderRadius: 12, paddingVertical: 11, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  focusBtnText: { color: C.tealLight, fontWeight: '700', fontSize: 13 },
});

// ─── LiveMapScreen ────────────────────────────────────────────────────────────

function LiveMapScreenInner() {
  const insets   = useSafeAreaInsets();
  const isOnline = useOfflineStore(s => s.isOnline);

  // ── Realtime subscription ────────────────────────────────────
  const { attach, detach } = useAdminRealtimeMap();

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'android') {
        StatusBar.setTranslucent(true);
        StatusBar.setBackgroundColor('transparent');
      }
      StatusBar.setBarStyle('dark-content');

      attach();

      return () => {
        if (Platform.OS === 'android') {
          StatusBar.setTranslucent(false);
          StatusBar.setBackgroundColor(MC.bg ?? '#ffffff');
        }
        StatusBar.setBarStyle('light-content');
        detach();
      };
    }, [attach, detach]),
  );

  // ── Refs ─────────────────────────────────────────────────────
  const mapRef      = useRef<MapView>(null);
  const prevIdsRef  = useRef<Set<string>>(new Set());
  const newIdTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ── Local state ───────────────────────────────────────────────
  const [showList,         setShowList]         = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<LiveEmployee | null>(null);
  const [newIds,           setNewIds]           = useState<Set<string>>(new Set());
  const [mapReady,         setMapReady]         = useState(false);

  // ── Store selectors (stable references) ──────────────────────
  const liveEmployees = useLocationStore(s => s.liveEmployees);
  const seeding       = useLocationStore(s => s.seeding);
  const getActive     = useLocationStore(s => s.getActiveEmployees);
  const getStale      = useLocationStore(s => s.getStaleEmployees);

  const allMarkers      = useMemo(() => Object.values(liveEmployees), [liveEmployees]);
  const activeEmployees = useMemo(() => getActive(), [liveEmployees, getActive]);
  const staleEmployees  = useMemo(() => getStale(),  [liveEmployees, getStale]);

  // ── New-employee pulse ────────────────────────────────────────
  useEffect(() => {
    const currentIds = new Set(allMarkers.map(e => safeEmployeeId(e)).filter(Boolean));
    const incoming   = new Set<string>();
    currentIds.forEach(id => { if (!prevIdsRef.current.has(id)) incoming.add(id); });
    prevIdsRef.current = currentIds;
    if (incoming.size === 0) return;

    setNewIds(prev => new Set([...prev, ...incoming]));
    const t = setTimeout(() => {
      setNewIds(prev => {
        const next = new Set(prev);
        incoming.forEach(id => next.delete(id));
        return next;
      });
    }, NEW_ID_TTL_MS);
    newIdTimers.current.push(t);
  }, [allMarkers]);

  // Clear all pending timers on unmount
  useEffect(() => () => {
    newIdTimers.current.forEach(clearTimeout);
  }, []);

  // ── Keep selected employee data fresh ────────────────────────
  useEffect(() => {
    if (!selectedEmployee) return;
    const id      = safeEmployeeId(selectedEmployee);
    const updated = id ? liveEmployees[id] : undefined;
    if (updated) setSelectedEmployee(updated);
    // If the employee is removed from the store, clear the selection
    else if (id && !liveEmployees[id] && !seeding) setSelectedEmployee(null);
  }, [liveEmployees, seeding]); // intentionally omit selectedEmployee to avoid loop

  // ── Map actions ───────────────────────────────────────────────

  const focusEmployee = useCallback((emp: LiveEmployee) => {
    if (!mapReady) return;
    if (!isValidCoord(emp.lat, emp.lng)) return;
    mapRef.current?.animateToRegion(
      {
        latitude:       emp.lat as number,
        longitude:      emp.lng as number,
        latitudeDelta:  FOCUS_DELTA,
        longitudeDelta: FOCUS_DELTA,
      },
      800,
    );
  }, [mapReady]);

  const handleMarkerPress = useCallback((emp: LiveEmployee) => {
    setSelectedEmployee(emp);
    focusEmployee(emp);
  }, [focusEmployee]);

  const handleSelectFromList = useCallback((emp: LiveEmployee) => {
    setShowList(false);
    // Let the list panel finish its exit animation before showing card
    const t = setTimeout(() => {
      setSelectedEmployee(emp);
      focusEmployee(emp);
    }, 150);
    return () => clearTimeout(t); // safe but timeout fires before cleanup in practice
  }, [focusEmployee]);

  const handleMapPress = useCallback(() => setSelectedEmployee(null), []);
  const handleMapReady = useCallback(() => setMapReady(true), []);

  // ── Layout offsets ────────────────────────────────────────────
  const topOffset       = insets.top + 12;
  const bottomBarBottom = 28 + insets.bottom;

  // ── Reduce-motion awareness ───────────────────────────────────
  // Passed down as prop if needed; currently affects EmployeeMarker.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub?.remove?.();
  }, []);

  return (
    <View style={s.container}>
      {/* Full-bleed map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={DEFAULT_REGION}
        showsCompass={false}
        moveOnMarkerPress={false}
        onPress={handleMapPress}
        onMapReady={handleMapReady}
        accessibilityLabel="Employee live location map"
      >
        {mapReady && allMarkers.map(emp => {
          const id = safeEmployeeId(emp);
          if (!id) return null; // skip employees with missing IDs
          return (
            <EmployeeMarker
              key={id}
              employee={emp}
              isNew={newIds.has(id)}
              onPress={handleMarkerPress}
            />
          );
        })}
      </MapView>

      {/* Offline pill */}
      {!isOnline && (
        <View
          style={[s.offlinePill, { top: topOffset }]}
          pointerEvents="none"
          accessibilityLiveRegion="assertive"
          accessibilityLabel="Offline — map data may be outdated"
        >
          <CloudOff size={12} color={C.pink} />
          <Text style={s.offlinePillText}>Offline — map data may be outdated</Text>
        </View>
      )}

      {/* Seeding banner — offset below offline pill when both are visible */}
      {seeding && (
        <View
          style={[s.seedingBanner, { top: !isOnline ? topOffset + 40 : topOffset }]}
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          accessibilityLabel="Loading employees"
        >
          <SeedingDots />
          <Text style={s.seedingText}>Loading employees…</Text>
        </View>
      )}

      {/* Empty state — only once seeding is done */}
      {!seeding && allMarkers.length === 0 && (
        <View style={s.emptyState} pointerEvents="none">
          <View style={s.emptyIconWrap}>
            <StatusPinSVG color={C.teal} />
          </View>
          <Text style={s.emptyTitle}>No employees tracked yet</Text>
          <Text style={s.emptySubtitle}>
            Locations will appear once employees start sharing
          </Text>
        </View>
      )}

      {/* Bottom bar */}
      <View style={[s.bottomBar, { bottom: bottomBarBottom }]} pointerEvents="box-none">
        <View
          style={s.legendPill}
          accessible
          accessibilityLabel={`${activeEmployees.length} online, ${staleEmployees.length} offline`}
        >
          <Wifi    size={12} color={C.teal} />
          <Text style={s.legendText}>{activeEmployees.length} online</Text>
          <View style={s.legendSep} />
          <WifiOff size={12} color={C.pink} />
          <Text style={s.legendText}>{staleEmployees.length} offline</Text>
        </View>

        <TouchableOpacity
          style={s.listBtn}
          onPress={() => setShowList(true)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`View employee list. ${activeEmployees.length} active`}
        >
          <Users size={14} color={C.tealLight} />
          <Text style={s.listBtnText}>Employees</Text>
          {activeEmployees.length > 0 && (
            <View style={s.badge} accessibilityElementsHidden>
              <Text style={s.badgeText}>{activeEmployees.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Employee info card */}
      {selectedEmployee && (
        <EmployeeInfoCard
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          onFocus={focusEmployee}
          bottomOffset={insets.bottom}
        />
      )}

      {/* Employee list panel */}
      {showList && (
        <EmployeeListPanel
          employees={allMarkers}
          onSelect={handleSelectFromList}
          onClose={() => setShowList(false)}
        />
      )}
    </View>
  );
}

// ─── Public export (wrapped in error boundary) ────────────────────────────────

export default function LiveMapScreen() {
  return (
    <MapErrorBoundary>
      <LiveMapScreenInner />
    </MapErrorBoundary>
  );
}

// ─── Screen Styles ────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },

  offlinePill: {
    position: 'absolute', alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: C.pinkLight,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8,
    borderWidth: 0.5, borderColor: `${C.pink}44`,
  },
  offlinePillText: { fontSize: 12, color: C.pink, fontWeight: '600' },

  seedingBanner: {
    position: 'absolute', alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.surface,
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 999, elevation: 4,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8,
    borderWidth: 0.5, borderColor: C.border,
  },
  seedingText: { fontSize: 13, color: C.muted, fontWeight: '500' },

  emptyState:    { position: 'absolute', top: '35%', alignSelf: 'center', alignItems: 'center', gap: 10 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:    { fontSize: 16, fontWeight: '700', color: C.ink },
  emptySubtitle: { fontSize: 13, color: C.muted, textAlign: 'center', maxWidth: 240, lineHeight: 19 },

  bottomBar: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.surface,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, borderWidth: 0.5, borderColor: C.border,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6,
  },
  legendText:  { fontSize: 13, fontWeight: '500', color: C.inkMid },
  legendSep:   { width: 0.5, height: 14, backgroundColor: C.border, marginHorizontal: 2 },
  listBtn: {
    backgroundColor: C.tealDark,
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8,
    elevation: 5, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8,
  },
  listBtnText: { color: C.tealLight, fontWeight: '700', fontSize: 13 },
  badge:       { backgroundColor: C.tealLight, borderRadius: 999, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText:   { fontSize: 11, fontWeight: '800', color: C.tealDark },
});