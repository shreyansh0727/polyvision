// src/screens/admin/LiveMapScreen.tsx
import React, {
  useRef, useState, useMemo, useEffect, useCallback, memo,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, StatusBar, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle, Path, Defs, RadialGradient, Stop,
} from 'react-native-svg';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
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

// ── Palette ───────────────────────────────────────────────────────
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
};

// ─────────────────────────────────────────────────────────────────
// BatteryIcon
// ─────────────────────────────────────────────────────────────────
function BatteryIcon({ level, size = 14 }: { level: number; size?: number }) {
  const color = level > 50 ? C.green : level > 20 ? C.amber : C.pink;
  if (level <= 20) return <BatteryLow    size={size} color={color} />;
  if (level <= 50) return <BatteryMedium size={size} color={color} />;
  return               <BatteryFull   size={size} color={color} />;
}

// ─────────────────────────────────────────────────────────────────
// StatusPinSVG
// ─────────────────────────────────────────────────────────────────
function StatusPinSVG({ color = C.teal }: { color?: string }) {
  return (
    <Svg width={36} height={44} viewBox="0 0 36 44">
      <Defs>
        <RadialGradient id="pg" cx="50%" cy="40%" r="55%">
          <Stop offset="0%"   stopColor={color} stopOpacity={0.25} />
          <Stop offset="100%" stopColor={color} stopOpacity={0.05} />
        </RadialGradient>
      </Defs>
      <Path d="M18 40 C10 40 6 38 6 36 C6 34 11 33 18 33 C25 33 30 34 30 36 C30 38 26 40 18 40Z" fill={color} opacity={0.15} />
      <Path d="M18 2C10.268 2 4 8.268 4 16C4 24 18 38 18 38C18 38 32 24 32 16C32 8.268 25.732 2 18 2Z" fill={color} opacity={0.18} />
      <Path d="M18 4C11.373 4 6 9.373 6 16C6 23.2 18 36 18 36C18 36 30 23.2 30 16C30 9.373 24.627 4 18 4Z" fill={color} opacity={0.7} />
      <Circle cx={18} cy={16} r={6} fill={C.surface} opacity={0.9} />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────
// SeedingDots
// ─────────────────────────────────────────────────────────────────
function SeedingDots() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Circle
        cx={9} cy={9} r={7}
        stroke={C.teal} strokeWidth={1.5}
        strokeDasharray="4 3" fill="none" strokeLinecap="round"
      />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────
// InfoRow / BatteryRow
// ─────────────────────────────────────────────────────────────────
function InfoRow({ icon, iconBg, label, value, mono }: {
  icon: React.ReactNode; iconBg: string;
  label: string; value: string; mono?: boolean;
}) {
  return (
    <View style={cs.row}>
      <View style={[cs.iconPill, { backgroundColor: iconBg }]}>{icon}</View>
      <View style={cs.rowTexts}>
        <Text style={cs.rowLabel}>{label}</Text>
        <Text
          style={[cs.rowValue, mono && { fontFamily: 'monospace', fontSize: 10 }]}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function BatteryRow({ battery, color, bg }: { battery: number; color: string; bg: string }) {
  return (
    <View style={cs.row}>
      <View style={[cs.iconPill, { backgroundColor: bg }]}>
        <BatteryIcon level={battery} size={14} />
      </View>
      <View style={cs.rowTexts}>
        <Text style={cs.rowLabel}>Battery</Text>
        <View style={cs.batteryBar}>
          <View style={cs.batteryTrack}>
            <View style={[cs.batteryFill, { width: `${battery}%` as any, backgroundColor: color }]} />
          </View>
          <Text style={[cs.batteryPct, { color }]}>{battery}%</Text>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// EmployeeInfoCard
// ─────────────────────────────────────────────────────────────────
const EmployeeInfoCard = memo(function EmployeeInfoCard({
  employee, onClose, onFocus, bottomOffset,
}: {
  employee:     LiveEmployee;
  onClose:      () => void;
  onFocus:      (emp: LiveEmployee) => void;
  bottomOffset: number;
}) {
  const slideAnim = useRef(new Animated.Value(140)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0, friction: 10, tension: 130, useNativeDriver: true,
    }).start();
  }, []);

  const dismiss = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 180, duration: 200, useNativeDriver: true,
    }).start(onClose);
  }, [onClose, slideAnim]);

  const isOnline    = employee.is_online ?? false;
  const displayName = employee.name ?? 'Unknown';
  const initial     = displayName.charAt(0).toUpperCase();

  const timeAgo = (() => {
    if (!employee.recorded_at) return '—';
    const diff = Math.floor((Date.now() - new Date(employee.recorded_at).getTime()) / 1000);
    if (diff < 60)    return 'Just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(employee.recorded_at).toLocaleDateString('en-IN');
  })();

  const battery      = employee.battery;
  const batteryColor = battery == null ? C.muted : battery > 50 ? C.green : battery > 20 ? C.amber : C.pink;
  const batteryBg    = battery == null ? '#f3f0ec' : battery > 50 ? C.greenLight : battery > 20 ? C.amberLight : C.pinkLight;
  const cardBottom   = 100 + bottomOffset;

  return (
    <Animated.View style={[cs.card, { bottom: cardBottom, transform: [{ translateY: slideAnim }] }]}>
      <View style={cs.header}>
        <View style={[cs.avatar, { backgroundColor: isOnline ? C.tealLight : '#f3f0ec' }]}>
          <Text style={[cs.avatarText, { color: isOnline ? C.tealDark : C.muted }]}>{initial}</Text>
        </View>
        <View style={cs.headerMid}>
          <Text style={cs.name} numberOfLines={1}>{displayName}</Text>
          {employee.role ? <Text style={cs.role}>{employee.role}</Text> : null}
        </View>
        <View style={[cs.pill, { backgroundColor: isOnline ? C.tealLight : C.pinkLight }]}>
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
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <X size={13} color={C.muted} />
        </TouchableOpacity>
      </View>

      <View style={cs.divider} />

      <View style={cs.rows}>
        <InfoRow
          icon={<MapPin size={14} color={C.blue} />}
          iconBg={C.blueLight}
          label="Location"
          value={
            employee.lat != null && employee.lng != null
              ? `${employee.lat.toFixed(5)}, ${employee.lng.toFixed(5)}`
              : '—'
          }
          mono
        />
        <InfoRow
          icon={<Clock size={14} color={C.amber} />}
          iconBg={C.amberLight}
          label="Last seen"
          value={timeAgo}
        />
        {battery != null && (
          <BatteryRow battery={battery} color={batteryColor} bg={batteryBg} />
        )}
      </View>

      <TouchableOpacity
        style={cs.focusBtn}
        onPress={() => { onFocus(employee); dismiss(); }}
        activeOpacity={0.8}
      >
        <LocateFixed size={14} color={C.tealLight} />
        <Text style={cs.focusBtnText}>Focus on map</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

const cs = StyleSheet.create({
  card:         { position: 'absolute', left: 14, right: 14, backgroundColor: C.surface, borderRadius: 22, padding: 18, elevation: 14, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, borderWidth: 0.5, borderColor: C.border },
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
  batteryBar:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  batteryTrack: { flex: 1, height: 4, backgroundColor: '#f0ede8', borderRadius: 2, overflow: 'hidden' },
  batteryFill:  { height: 4, borderRadius: 2 },
  batteryPct:   { fontSize: 11, fontWeight: '700', minWidth: 28, textAlign: 'right' },
  focusBtn:     { marginTop: 16, backgroundColor: C.tealDark, borderRadius: 12, paddingVertical: 11, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  focusBtnText: { color: C.tealLight, fontWeight: '700', fontSize: 13 },
});

// ─────────────────────────────────────────────────────────────────
// LiveMapScreen
// ─────────────────────────────────────────────────────────────────
export default function LiveMapScreen() {
  const insets   = useSafeAreaInsets();
  const isOnline = useOfflineStore(s => s.isOnline);

  // ── Realtime map data ─────────────────────────────────────────
  const { attach, detach } = useAdminRealtimeMap();
  useFocusEffect(
    useCallback(() => {
      // Make status bar transparent so map fills edge-to-edge on focus
      if (Platform.OS === 'android') {
        StatusBar.setTranslucent(true);
        StatusBar.setBackgroundColor('transparent');
      }
      StatusBar.setBarStyle('dark-content');

      attach();

      return () => {
        // Restore opaque status bar for every other screen
        if (Platform.OS === 'android') {
          StatusBar.setTranslucent(false);
          StatusBar.setBackgroundColor(MC.bg);
        }
        StatusBar.setBarStyle('light-content');
        detach();
      };
    }, [attach, detach]),
  );

  const mapRef = useRef<MapView>(null);
  const [showList,         setShowList]         = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<LiveEmployee | null>(null);
  const [newIds,           setNewIds]           = useState<Set<string>>(new Set());
  const prevIdsRef = useRef<Set<string>>(new Set());

  const liveEmployees = useLocationStore(s => s.liveEmployees);
  const seeding       = useLocationStore(s => s.seeding);
  const getActive     = useLocationStore(s => s.getActiveEmployees);
  const getStale      = useLocationStore(s => s.getStaleEmployees);

  const allMarkers      = useMemo(() => Object.values(liveEmployees), [liveEmployees]);
  const activeEmployees = useMemo(() => getActive(), [liveEmployees]);
  const staleEmployees  = useMemo(() => getStale(),  [liveEmployees]);

  useEffect(() => {
    const currentIds = new Set(allMarkers.map(e => e.employee_id));
    const incoming   = new Set<string>();
    currentIds.forEach(id => { if (!prevIdsRef.current.has(id)) incoming.add(id); });
    prevIdsRef.current = currentIds;
    if (incoming.size === 0) return;
    setNewIds(incoming);
    const t = setTimeout(() => setNewIds(new Set()), 600);
    return () => clearTimeout(t);
  }, [allMarkers]);

  useEffect(() => {
    if (!selectedEmployee) return;
    const updated = liveEmployees[selectedEmployee.employee_id];
    if (updated) setSelectedEmployee(updated);
  }, [liveEmployees, selectedEmployee?.employee_id]);

  const focusEmployee = useCallback((emp: LiveEmployee) => {
    if (emp.lat == null || emp.lng == null) return;
    mapRef.current?.animateToRegion(
      { latitude: emp.lat, longitude: emp.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 },
      800,
    );
  }, []);

  const handleMarkerPress = useCallback((emp: LiveEmployee) => {
    setSelectedEmployee(emp);
    focusEmployee(emp);
  }, [focusEmployee]);

  const handleSelectFromList = useCallback((emp: LiveEmployee) => {
    setShowList(false);
    setTimeout(() => { setSelectedEmployee(emp); focusEmployee(emp); }, 150);
  }, [focusEmployee]);

  const handleMapPress = useCallback(() => setSelectedEmployee(null), []);

  // Positions relative to safe area edges
  const topOffset      = insets.top + 12;
  const bottomBarBottom = 28 + insets.bottom;

  return (
    // No SafeAreaView here — map intentionally fills entire screen
    // including behind status bar. All overlays are offset manually
    // using insets so they don't collide with system UI.
    <View style={s.container}>

      {/* Map fills entire screen (behind status bar too) */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: 26.8467, longitude: 80.9462,
          latitudeDelta: 5, longitudeDelta: 5,
        }}
        showsCompass={false}
        moveOnMarkerPress={false}
        onPress={handleMapPress}
      >
        {allMarkers.map(emp => (
          <EmployeeMarker
            key={emp.employee_id}
            employee={emp}
            isNew={newIds.has(emp.employee_id)}
            onPress={handleMarkerPress}
          />
        ))}
      </MapView>

      {/* Offline pill — floats just below status bar */}
      {!isOnline && (
        <View
          style={[s.offlinePill, { top: topOffset }]}
          pointerEvents="none"
        >
          <CloudOff size={12} color={C.pink} />
          <Text style={s.offlinePillText}>Offline — map data may be outdated</Text>
        </View>
      )}

      {/* Seeding banner — sits below offline pill if both showing */}
      {seeding && (
        <View
          style={[s.seedingBanner, { top: !isOnline ? topOffset + 40 : topOffset }]}
          pointerEvents="none"
        >
          <SeedingDots />
          <Text style={s.seedingText}>Loading employees…</Text>
        </View>
      )}

      {/* Empty state */}
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

      {/* Bottom bar — sits above home indicator */}
      <View style={[s.bottomBar, { bottom: bottomBarBottom }]} pointerEvents="box-none">
        <View style={s.legendPill}>
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
        >
          <Users size={14} color={C.tealLight} />
          <Text style={s.listBtnText}>Employees</Text>
          {activeEmployees.length > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{activeEmployees.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {selectedEmployee && (
        <EmployeeInfoCard
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          onFocus={focusEmployee}
          bottomOffset={insets.bottom}
        />
      )}

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

// ─────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // No backgroundColor on container — map tiles show through
  container: { flex: 1 },

  offlinePill: {
    position: 'absolute', alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: C.pinkLight,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999,
    elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8,
    borderWidth: 0.5, borderColor: `${C.pink}44`,
  },
  offlinePillText: {
    fontSize: 12, color: C.pink, fontWeight: '600',
  },

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