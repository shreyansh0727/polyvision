// src/screens/admin/AdminScreen.tsx
import React, {
  useState, useEffect, useCallback, useRef, useMemo, memo,
} from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, RefreshControl, Animated,
  SafeAreaView, StatusBar, Alert, useWindowDimensions,
  Platform, SectionList, ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  Wifi, Camera, Users, BatteryLow, Battery,
  LayoutDashboard, Users2, Image as ImageIcon,
  Map, ImagePlus, User, LogOut,
  MapPin, Zap, RadioTower, Inbox,
  ChevronRight, type LucideIcon,
} from 'lucide-react-native';

import { useAuthStore }        from '../../store/authStore';
import { useLocationStore }    from '../../store/locationStore';
import { useAdminRealtimeMap } from '../../hooks/useAdminRealtimeMap';

import ErrorBox       from '../../components/shared/ErrorBox';
import LoadingOverlay from '../../components/shared/LoadingOverlay';

import { apiGet }                   from '../../services/api';
import { LiveEmployee, VisitPhoto } from '../../types';
import { MC } from '../../navigation/AppTheme';

const VISITS_PAGE_SIZE = 20;

// ─────────────────────────────────────────────────────────────────
// Design Tokens
// ─────────────────────────────────────────────────────────────────
const C = {
  bg:          '#080C14',
  surface:     '#0E1520',
  surfaceAlt:  '#131B28',
  surfaceLift: '#1A2438',
  green:       '#10D876',
  greenDim:    '#0A7A43',
  greenGlow:   'rgba(16,216,118,0.15)',
  gold:        '#F4B942',
  goldDim:     'rgba(244,185,66,0.12)',
  rose:        '#F05A7E',
  roseDim:     'rgba(240,90,126,0.12)',
  blue:        '#4B8EF1',
  blueDim:     'rgba(75,142,241,0.12)',
  textPrimary: '#E8EDF5',
  textSub:     '#8A95A8',
  textFaint:   '#3D4A5C',
  border:      '#1C2840',
  borderBright:'#2A3B55',
};

const F = {
  display: Platform.select({ ios: 'Georgia',  android: 'serif',     default: 'Georgia' }),
  mono:    Platform.select({ ios: 'Menlo',     android: 'monospace', default: 'monospace' }),
};

// ─────────────────────────────────────────────────────────────────
// Pulse Dot
// ─────────────────────────────────────────────────────────────────
const PulseDot = memo(function PulseDot({ color = C.green, size = 8 }: { color?: string; size?: number }) {
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
        position: 'absolute', width: size, height: size,
        borderRadius: size / 2, borderWidth: 1.5, borderColor: color,
        transform: [{ scale: ring }], opacity: ringOpacity,
      }} />
      <View style={{ width: size * 0.6, height: size * 0.6, borderRadius: size, backgroundColor: color }} />
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
function avatarColor(name: string): string {
  const palette = [C.green, C.gold, C.blue, '#A78BFA', '#FB923C'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function resolveDate(v: VisitPhoto): Date | null {
  const raw = (v as any).visited_at ?? v.uploaded_at ?? null;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function timeAgoFromVisit(v: VisitPhoto): string {
  const d = resolveDate(v);
  if (!d) return '—';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)     return 'Just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-IN');
}

function fullDateFromVisit(v: VisitPhoto): string {
  const d = resolveDate(v);
  if (!d) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─────────────────────────────────────────────────────────────────
// Lazy Visit Card
// ─────────────────────────────────────────────────────────────────
const LazyVisitCard = memo(function LazyVisitCard({
  item, expanded, onToggle, showEmployee,
}: {
  item: VisitPhoto; expanded: boolean;
  onToggle: (id: string | number) => void; showEmployee?: boolean;
}) {
  const [imgLoading, setImgLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const onImageLoad = () => {
    setImgLoading(false);
    Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  };

  useEffect(() => {
    if (!expanded) { fadeAnim.setValue(0); setImgLoading(true); }
  }, [expanded]);

  const displayName = (item as any).employee_name ?? (item as any).employee_id ?? 'Employee';
  const initial     = displayName.charAt(0).toUpperCase();
  const accentColor = avatarColor(displayName);
  const hasPhoto    = !!item.photo_url;

  return (
    <View style={[lvcStyles.card, expanded && lvcStyles.cardExpanded]}>
      <View style={[lvcStyles.accentBar, { backgroundColor: expanded ? accentColor : C.border }]} />
      <View style={lvcStyles.body}>
        <TouchableOpacity
          style={lvcStyles.row} onPress={() => onToggle(item.id)}
          activeOpacity={0.72} disabled={!hasPhoto}
        >
          <View style={[lvcStyles.avatarRing, { borderColor: expanded ? accentColor : C.border }]}>
            <View style={[lvcStyles.avatar, { backgroundColor: `${accentColor}18` }]}>
              <Text style={[lvcStyles.avatarText, { color: accentColor }]}>{initial}</Text>
            </View>
          </View>
          <View style={lvcStyles.mid}>
            {showEmployee && <Text style={lvcStyles.empName} numberOfLines={1}>{displayName}</Text>}
            {item.caption
              ? <Text style={lvcStyles.caption} numberOfLines={expanded ? undefined : 1}>{item.caption}</Text>
              : <Text style={lvcStyles.noCaption}>No caption</Text>
            }
            <Text style={lvcStyles.date}>{fullDateFromVisit(item)}</Text>
          </View>
          <View style={lvcStyles.rightCol}>
            <View style={lvcStyles.timeBadge}>
              <Text style={lvcStyles.timeAgo}>{timeAgoFromVisit(item)}</Text>
            </View>
            {hasPhoto && (
              <View style={lvcStyles.photoHint}>
                {/* ChevronRight replaces the › text arrow */}
                <ChevronRight
                  size={18}
                  color={expanded ? C.green : C.textFaint}
                  strokeWidth={expanded ? 2.5 : 1.5}
                  style={expanded ? { transform: [{ rotate: '90deg' }] } : undefined}
                />
                {!expanded && (
                  <Text style={lvcStyles.photoHintLabel}>Photo</Text>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>

        {expanded && hasPhoto && (
          <View style={lvcStyles.imageSection}>
            <View style={lvcStyles.imageDivider} />
            <View style={lvcStyles.imageWrap}>
              {imgLoading && (
                <View style={lvcStyles.imgPlaceholder}>
                  <ActivityIndicator size="small" color={C.green} />
                  <Text style={lvcStyles.imgPlaceholderText}>Loading photo…</Text>
                </View>
              )}
              <Animated.Image
                source={{ uri: item.photo_url! }}
                style={[lvcStyles.image, { opacity: fadeAnim }]}
                resizeMode="cover"
                onLoad={onImageLoad}
                onError={() => setImgLoading(false)}
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );
},
(prev, next) =>
  prev.expanded         === next.expanded         &&
  prev.item.id          === next.item.id          &&
  prev.item.uploaded_at === next.item.uploaded_at &&
  prev.showEmployee     === next.showEmployee     &&
  prev.onToggle         === next.onToggle,
);

const lvcStyles = StyleSheet.create({
  card:           { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: C.border, borderTopColor: C.borderBright, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  cardExpanded:   { borderColor: C.borderBright, shadowOpacity: 0.5, shadowRadius: 14, elevation: 9 },
  accentBar:      { width: 3 },
  body:           { flex: 1, padding: 12 },
  row:            { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarRing:     { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  avatar:         { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText:     { fontSize: 15, fontWeight: '800', fontFamily: F.display },
  mid:            { flex: 1, gap: 2 },
  empName:        { fontSize: 12, fontWeight: '700', color: C.textPrimary, fontFamily: F.display },
  caption:        { fontSize: 12, color: C.textSub, fontFamily: F.mono, lineHeight: 16 },
  noCaption:      { fontSize: 11, color: C.textFaint, fontFamily: F.mono, fontStyle: 'italic' },
  date:           { fontSize: 10, color: C.textFaint, fontFamily: F.mono, marginTop: 1 },
  rightCol:       { alignItems: 'flex-end', gap: 5 },
  timeBadge:      { backgroundColor: C.surfaceLift, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: C.border },
  timeAgo:        { fontSize: 9, fontWeight: '700', color: C.textSub, fontFamily: F.mono, letterSpacing: 0.5 },
  photoHint:      { alignItems: 'center' },
  photoHintLabel: { fontSize: 8, color: C.textFaint, fontFamily: F.mono, letterSpacing: 0.5 },
  imageSection:   { marginTop: 2 },
  imageDivider:   { height: 1, backgroundColor: C.borderBright, marginBottom: 10 },
  imageWrap:      { borderRadius: 10, overflow: 'hidden', minHeight: 180, backgroundColor: C.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  imgPlaceholder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 8, zIndex: 1 },
  imgPlaceholderText: { fontSize: 11, color: C.textSub, fontFamily: F.mono },
  image:          { width: '100%', height: 200 },
});

// ─────────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────────
const StatCard = memo(function StatCard({
  Icon, label, value, sub, color, glowColor, delay,
}: {
  Icon: LucideIcon; label: string; value: string | number;
  sub?: string; color: string; glowColor?: string; delay: number;
}) {
  const { width: SCREEN_W } = useWindowDimensions();
  const cardWidth   = (SCREEN_W - 48) / 2;
  const scaleAnim   = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: 1, friction: 8, tension: 100, delay, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 400, delay,            useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[statStyles.card, { width: cardWidth, transform: [{ scale: scaleAnim }], opacity: opacityAnim, shadowColor: glowColor ?? color }]}>
      <View style={[statStyles.accentBar, { backgroundColor: color }]} />
      <View style={[statStyles.glowCorner, { backgroundColor: glowColor ?? `${color}22` }]} />
      <View style={statStyles.body}>
        {/* Lucide icon replaces emoji */}
        <View style={statStyles.iconWrap}>
          <Icon size={20} color={color} strokeWidth={1.8} />
        </View>
        <Text style={[statStyles.value, { color }]}>{value}</Text>
        <Text style={statStyles.label}>{label}</Text>
        {sub ? <Text style={statStyles.sub}>{sub}</Text> : null}
      </View>
    </Animated.View>
  );
});

const statStyles = StyleSheet.create({
  card:       { backgroundColor: C.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.border, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  accentBar:  { height: 3 },
  glowCorner: { position: 'absolute', top: 0, right: 0, width: 60, height: 60, borderBottomLeftRadius: 60 },
  body:       { padding: 16, gap: 3 },
  iconWrap:   { marginBottom: 6 },
  value:      { fontSize: 30, fontWeight: '800', letterSpacing: -1, fontFamily: F.display },
  label:      { fontSize: 11, fontWeight: '600', color: C.textSub, fontFamily: F.mono, letterSpacing: 0.5, textTransform: 'uppercase' },
  sub:        { fontSize: 10, color: C.textFaint, marginTop: 2, fontFamily: F.mono },
});

// ─────────────────────────────────────────────────────────────────
// Employee Row
// ─────────────────────────────────────────────────────────────────
const EmployeeRow = memo(function EmployeeRow({
  item, onPress,
}: { item: LiveEmployee; onPress: (emp: LiveEmployee) => void }) {
  const isOnline     = item.is_online ?? false;
  const displayName  = item.name ?? 'Unknown';
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const latStr       = item.lat != null ? item.lat.toFixed(4) : '—';
  const lngStr       = item.lng != null ? item.lng.toFixed(4) : '—';

  const batteryColor = item.battery == null ? C.textSub
    : item.battery > 50 ? C.green
    : item.battery > 20 ? C.gold
    : C.rose;

  const BatteryIcon = item.battery != null && item.battery < 20 ? BatteryLow : Battery;

  const timeAgo = useMemo(() => {
    if (!item.recorded_at) return '—';
    const diff = Math.floor((Date.now() - new Date(item.recorded_at).getTime()) / 1000);
    if (diff < 60)    return 'Just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(item.recorded_at).toLocaleDateString('en-IN');
  }, [item.recorded_at]);

  const handlePress = useCallback(() => onPress(item), [item, onPress]);

  return (
    <TouchableOpacity
      style={[empStyles.row, isOnline && empStyles.rowOnline]}
      onPress={handlePress} activeOpacity={0.72}
    >
      <View style={[empStyles.avatarWrap, { borderColor: isOnline ? C.green : C.border }]}>
        <View style={[empStyles.avatar, { backgroundColor: isOnline ? 'rgba(16,216,118,0.1)' : C.surfaceAlt }]}>
          <Text style={[empStyles.avatarText, { color: isOnline ? C.green : C.textSub }]}>{avatarLetter}</Text>
        </View>
        {isOnline && <View style={empStyles.pulseWrap}><PulseDot color={C.green} size={9} /></View>}
      </View>
      <View style={empStyles.info}>
        <Text style={empStyles.name}>{displayName}</Text>
        {/* MapPin replaces 📍 */}
        <View style={empStyles.coordsRow}>
          <MapPin size={10} color={C.textSub} strokeWidth={1.5} />
          <Text style={empStyles.coords} numberOfLines={1}>{latStr}, {lngStr}</Text>
        </View>
        <Text style={empStyles.time}>{timeAgo}</Text>
      </View>
      <View style={empStyles.right}>
        {item.battery != null && (
          <View style={[empStyles.batteryPill, { borderColor: batteryColor }]}>
            {/* Battery / BatteryLow replaces 🔋 */}
            <BatteryIcon size={10} color={batteryColor} strokeWidth={1.8} />
            <Text style={[empStyles.battery, { color: batteryColor }]}>{item.battery}%</Text>
          </View>
        )}
        <View style={[empStyles.statusPill, { backgroundColor: isOnline ? C.greenGlow : C.surfaceAlt }]}>
          <Text style={[empStyles.statusText, { color: isOnline ? C.green : C.textSub }]}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
},
(prev, next) =>
  prev.item.employee_id === next.item.employee_id &&
  prev.item.is_online   === next.item.is_online   &&
  prev.item.lat         === next.item.lat         &&
  prev.item.lng         === next.item.lng         &&
  prev.item.battery     === next.item.battery     &&
  prev.item.recorded_at === next.item.recorded_at &&
  prev.onPress          === next.onPress,
);

const empStyles = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12, backgroundColor: C.surface, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  rowOnline:  { borderLeftColor: C.green, backgroundColor: 'rgba(16,216,118,0.03)' },
  avatarWrap: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  avatar:     { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontWeight: '800', fontFamily: F.display },
  pulseWrap:  { position: 'absolute', bottom: -1, right: -1, backgroundColor: C.bg, borderRadius: 6, padding: 1 },
  info:       { flex: 1, gap: 3 },
  name:       { fontSize: 14, fontWeight: '700', color: C.textPrimary, fontFamily: F.display },
  coordsRow:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  coords:     { fontSize: 10, color: C.textSub, fontFamily: F.mono },
  time:       { fontSize: 10, color: C.textFaint, fontFamily: F.mono },
  right:      { alignItems: 'flex-end', gap: 6 },
  batteryPill:{ flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  battery:    { fontSize: 10, fontWeight: '700', fontFamily: F.mono },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 9, fontWeight: '800', fontFamily: F.mono, letterSpacing: 1 },
});

// ─────────────────────────────────────────────────────────────────
// Tab Bar — Lucide icons replace ◈ ◉ ◎
// ─────────────────────────────────────────────────────────────────
const TABS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: 'overview',  label: 'Overview',  Icon: LayoutDashboard },
  { key: 'employees', label: 'Employees', Icon: Users2          },
  { key: 'visits',    label: 'Visits',    Icon: ImageIcon        },
];

const TabBar = memo(function TabBar({ active, onChange, counts }: {
  active: string; onChange: (key: string) => void; counts: Record<string, number>;
}) {
  return (
    <View style={tabStyles.bar}>
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[tabStyles.tab, isActive && tabStyles.tabActive]}
            onPress={() => onChange(tab.key)} activeOpacity={0.75}
          >
            <tab.Icon
              size={14}
              color={isActive ? C.green : C.textFaint}
              strokeWidth={isActive ? 2.2 : 1.5}
            />
            <Text style={[tabStyles.tabLabel, isActive && tabStyles.tabLabelActive]}>{tab.label}</Text>
            {counts[tab.key] > 0 && (
              <View style={[tabStyles.badge, isActive && tabStyles.badgeActive]}>
                <Text style={[tabStyles.badgeText, isActive && tabStyles.badgeTextActive]}>
                  {counts[tab.key] > 99 ? '99+' : counts[tab.key]}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const tabStyles = StyleSheet.create({
  bar:            { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 16, padding: 5, gap: 4, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
  tab:            { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, gap: 5 },
  tabActive:      { backgroundColor: C.surfaceLift, borderWidth: 1, borderColor: C.borderBright },
  tabLabel:       { fontSize: 12, fontWeight: '600', color: C.textSub, fontFamily: F.mono },
  tabLabelActive: { color: C.textPrimary, fontWeight: '700' },
  badge:          { backgroundColor: C.surfaceAlt, borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: 'center' },
  badgeActive:    { backgroundColor: C.green },
  badgeText:      { fontSize: 9, color: C.textSub, fontWeight: '800', fontFamily: F.mono },
  badgeTextActive:{ color: C.bg },
});

// ─────────────────────────────────────────────────────────────────
// Quick Action — Lucide icons replace emoji
// ─────────────────────────────────────────────────────────────────
const QuickAction = memo(function QuickAction({
  Icon, label, onPress, badge, accent,
}: { Icon: LucideIcon; label: string; onPress: () => void; badge?: string; accent?: string }) {
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const onPressIn  = useCallback(() => Animated.spring(scaleAnim, { toValue: 0.93, useNativeDriver: true }).start(), []);
  const onPressOut = useCallback(() => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true }).start(), []);

  return (
    <TouchableOpacity style={qaStyles.btn} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} activeOpacity={1}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }], alignItems: 'center', gap: 6 }}>
        <View style={[qaStyles.iconBox, accent && { borderColor: accent, backgroundColor: `${accent}15` }]}>
          <Icon size={22} color={accent ?? C.textSub} strokeWidth={1.8} />
          {badge ? (
            <View style={[qaStyles.badge, accent && { backgroundColor: accent }]}>
              <Text style={qaStyles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={qaStyles.label}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

const qaStyles = StyleSheet.create({
  btn:       { alignItems: 'center', flex: 1 },
  iconBox:   { width: 54, height: 54, borderRadius: 18, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  label:     { fontSize: 10, color: C.textSub, fontWeight: '600', textAlign: 'center', fontFamily: F.mono, letterSpacing: 0.3 },
  badge:     { position: 'absolute', top: -5, right: -5, backgroundColor: C.rose, borderRadius: 999, minWidth: 17, height: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: C.surface },
  badgeText: { fontSize: 9, color: '#fff', fontWeight: '800' },
});

// ─────────────────────────────────────────────────────────────────
// Section Header, Panel, GlowLine
// ─────────────────────────────────────────────────────────────────
function SectionHeader({ label, count, onAction, actionLabel }: {
  label: string; count?: number; onAction?: () => void; actionLabel?: string;
}) {
  return (
    <View style={secStyles.row}>
      <View style={secStyles.left}>
        <View style={secStyles.dot} />
        <Text style={secStyles.label}>{label}</Text>
        {count != null && (
          <View style={secStyles.countPill}><Text style={secStyles.countText}>{count}</Text></View>
        )}
      </View>
      {onAction && <TouchableOpacity onPress={onAction}><Text style={secStyles.action}>{actionLabel ?? 'See all →'}</Text></TouchableOpacity>}
    </View>
  );
}

const secStyles = StyleSheet.create({
  row:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  left:      { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot:       { width: 3, height: 14, borderRadius: 2, backgroundColor: C.green },
  label:     { fontSize: 12, fontWeight: '800', color: C.textPrimary, fontFamily: F.mono, letterSpacing: 1, textTransform: 'uppercase' },
  countPill: { backgroundColor: C.surfaceLift, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: C.border },
  countText: { fontSize: 10, color: C.textSub, fontWeight: '700', fontFamily: F.mono },
  action:    { fontSize: 11, color: C.green, fontFamily: F.mono, fontWeight: '700' },
});

function Panel({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[panelStyles.panel, style]}>{children}</View>;
}
const panelStyles = StyleSheet.create({
  panel: { backgroundColor: C.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 5 },
});

function GlowLine() {
  return <View style={{ height: 1, marginHorizontal: 16, marginTop: 2, borderBottomWidth: 1, borderBottomColor: C.border }} />;
}

// EmptyInline — Lucide Icon instead of emoji string
function EmptyInline({ Icon, title, sub }: { Icon: LucideIcon; title: string; sub: string }) {
  return (
    <View style={styles.emptyInline}>
      <View style={styles.emptyIconWrap}>
        <Icon size={32} color={C.textFaint} strokeWidth={1.2} />
      </View>
      <Text style={styles.emptyText}>{title}</Text>
      <Text style={styles.emptySubText}>{sub}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// Overview Tab
// ─────────────────────────────────────────────────────────────────
type OverviewItem =
  | { type: 'error';        key: string }
  | { type: 'alert';        key: string }
  | { type: 'stats';        key: string }
  | { type: 'quickActions'; key: string }
  | { type: 'onlineNow';    key: string }
  | { type: 'recentVisits'; key: string };

interface OverviewProps {
  error: string | null; lowBattery: LiveEmployee[];
  onlineEmployees: LiveEmployee[]; offlineEmployees: LiveEmployee[];
  employees: LiveEmployee[]; todayVisits: VisitPhoto[]; visits: VisitPhoto[];
  refreshing: boolean; onRefresh: () => void;
  onDismissError: () => void; onRetry: () => void;
  navigateToMap: () => void; navigateToMapWithFocus: (emp: LiveEmployee) => void;
  goToEmployees: () => void; goToVisits: () => void; handleLogout: () => void;
  expandedVisitId: string | number | null; onToggleVisit: (id: string | number) => void;
}

const OverviewTab = memo(function OverviewTab(props: OverviewProps) {
  const {
    error, lowBattery, onlineEmployees, offlineEmployees, employees,
    todayVisits, visits, refreshing, onRefresh, onDismissError, onRetry,
    navigateToMap, navigateToMapWithFocus, goToEmployees, goToVisits, handleLogout,
    expandedVisitId, onToggleVisit,
  } = props;

  const items = useMemo<OverviewItem[]>(() => {
    const list: OverviewItem[] = [];
    if (error)             list.push({ type: 'error',        key: 'error' });
    if (lowBattery.length) list.push({ type: 'alert',        key: 'alert' });
    list.push(
      { type: 'stats',        key: 'stats' },
      { type: 'quickActions', key: 'quickActions' },
      { type: 'onlineNow',    key: 'onlineNow' },
      { type: 'recentVisits', key: 'recentVisits' },
    );
    return list;
  }, [error, lowBattery.length]);

  const renderItem = useCallback(({ item }: { item: OverviewItem }) => {
    switch (item.type) {
      case 'error':
        return <ErrorBox message={error!} severity="error" onDismiss={onDismissError} action={{ label: 'Retry', onPress: onRetry }} />;

      case 'alert':
        return (
          <Panel style={{ borderColor: C.rose, borderLeftWidth: 3, borderLeftColor: C.rose }}>
            {/* Zap replaces ⚡ */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Zap size={13} color={C.rose} strokeWidth={2} />
              <Text style={{ color: C.rose, fontFamily: F.mono, fontSize: 12, fontWeight: '700' }}>LOW BATTERY ALERT</Text>
            </View>
            <Text style={{ color: C.textSub, fontFamily: F.mono, fontSize: 11, marginTop: 4 }}>
              {lowBattery.map((e) => e.name ?? 'Unknown').join(', ')} — below 20%
            </Text>
          </Panel>
        );

      case 'stats':
        return (
          <View style={styles.statsGrid}>
            <StatCard Icon={Wifi}       label="Online Now"      value={onlineEmployees.length}  sub={`of ${employees.length} total`}       color={C.green} glowColor={C.greenGlow} delay={0}   />
            <StatCard Icon={Camera}     label="Visits Today"    value={todayVisits.length}       sub={`${visits.length} total`}             color={C.blue}  glowColor={C.blueDim}   delay={80}  />
            <StatCard Icon={Users}      label="Total Employees" value={employees.length}         sub={`${offlineEmployees.length} offline`} color={C.gold}  glowColor={C.goldDim}   delay={160} />
            <StatCard
              Icon={BatteryLow}
              label="Low Battery"
              value={lowBattery.length}
              sub="< 20% charge"
              color={lowBattery.length > 0 ? C.rose : C.green}
              glowColor={lowBattery.length > 0 ? C.roseDim : C.greenGlow}
              delay={240}
            />
          </View>
        );

      case 'quickActions':
        return (
          <Panel>
            <SectionHeader label="Quick Actions" />
            <View style={styles.quickActions}>
              <QuickAction Icon={Map}      label="Live Map"   onPress={navigateToMap}  accent={C.green}
                badge={onlineEmployees.length > 0 ? String(onlineEmployees.length) : undefined} />
              <QuickAction Icon={ImagePlus} label="All Visits" onPress={goToVisits}    accent={C.blue}
                badge={todayVisits.length > 0 ? String(todayVisits.length) : undefined} />
              <QuickAction Icon={User}     label="Employees"  onPress={goToEmployees} accent={C.gold} />
              <QuickAction Icon={LogOut}   label="Logout"     onPress={handleLogout}  accent={C.rose} />
            </View>
          </Panel>
        );

      case 'onlineNow':
        return (
          <Panel>
            <SectionHeader label="Online Right Now" count={onlineEmployees.length} onAction={goToEmployees} />
            {onlineEmployees.length === 0 ? (
              /* RadioTower replaces 📡 */
              <EmptyInline Icon={RadioTower} title="No employees online" sub="Employees appear here once they start their shift" />
            ) : (
              onlineEmployees.slice(0, 3).map((emp, i) => (
                <React.Fragment key={emp.employee_id}>
                  <EmployeeRow item={emp} onPress={navigateToMapWithFocus} />
                  {i < Math.min(onlineEmployees.length, 3) - 1 && <View style={{ height: 1, backgroundColor: C.border }} />}
                </React.Fragment>
              ))
            )}
            {onlineEmployees.length > 3 && (
              <TouchableOpacity onPress={goToEmployees} style={styles.viewMoreBtn}>
                <Text style={styles.viewMoreText}>View {onlineEmployees.length - 3} more →</Text>
              </TouchableOpacity>
            )}
          </Panel>
        );

      case 'recentVisits':
        return (
          <Panel>
            <SectionHeader label="Recent Visits" count={todayVisits.length} onAction={goToVisits} />
            {todayVisits.length === 0 ? (
              /* Inbox replaces 📭 */
              <EmptyInline Icon={Inbox} title="No visits today" sub="Visit photos logged today will appear here" />
            ) : (
              <>
                <Text style={styles.tapHint}>Tap a visit to load its photo</Text>
                <View style={styles.visitsList}>
                  {todayVisits.slice(0, 3).map((v) => (
                    <LazyVisitCard key={String(v.id)} item={v} expanded={expandedVisitId === v.id} onToggle={onToggleVisit} showEmployee />
                  ))}
                </View>
              </>
            )}
          </Panel>
        );

      default: return null;
    }
  }, [
    error, lowBattery, onlineEmployees, offlineEmployees, employees,
    todayVisits, visits, onDismissError, onRetry, navigateToMap,
    navigateToMapWithFocus, goToEmployees, goToVisits, handleLogout,
    expandedVisitId, onToggleVisit,
  ]);

  return (
    <FlatList
      data={items} keyExtractor={(item) => item.key} renderItem={renderItem}
      contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}
      removeClippedSubviews extraData={expandedVisitId}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.green} />}
    />
  );
});

// ─────────────────────────────────────────────────────────────────
// Employees Tab
// ─────────────────────────────────────────────────────────────────
type EmpSection = { title: string; color: string; data: LiveEmployee[] };

const EmployeesTab = memo(function EmployeesTab({
  onlineEmployees, offlineEmployees, refreshing, onRefresh, navigateToMapWithFocus,
}: {
  onlineEmployees: LiveEmployee[]; offlineEmployees: LiveEmployee[];
  refreshing: boolean; onRefresh: () => void;
  navigateToMapWithFocus: (emp: LiveEmployee) => void;
}) {
  const sections = useMemo<EmpSection[]>(() => {
    const list: EmpSection[] = [];
    if (onlineEmployees.length)  list.push({ title: 'ONLINE',  color: C.green,     data: onlineEmployees  });
    if (offlineEmployees.length) list.push({ title: 'OFFLINE', color: C.textFaint, data: offlineEmployees });
    return list;
  }, [onlineEmployees, offlineEmployees]);

  const renderItem          = useCallback(({ item }: { item: LiveEmployee }) => <EmployeeRow item={item} onPress={navigateToMapWithFocus} />, [navigateToMapWithFocus]);
  const renderSectionHeader = useCallback(({ section }: { section: EmpSection }) => (
    <View style={styles.sectionLabelWrap}>
      {section.color === C.green
        ? <PulseDot color={C.green} size={8} />
        : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.textFaint }} />}
      <Text style={[styles.sectionLabel, { color: section.color }]}>{section.title}</Text>
    </View>
  ), []);
  const ItemSeparator = useCallback(() => <View style={{ height: 1, backgroundColor: C.border }} />, []);
  const keyExtractor  = useCallback((item: LiveEmployee) => String(item.employee_id), []);

  return (
    <SectionList
      sections={sections} keyExtractor={keyExtractor}
      renderItem={renderItem} renderSectionHeader={renderSectionHeader}
      ItemSeparatorComponent={ItemSeparator}
      contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}
      removeClippedSubviews maxToRenderPerBatch={10} windowSize={5}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.green} />}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <View style={[styles.statusChip, { borderColor: onlineEmployees.length > 0 ? C.green : C.textFaint }]}>
            {onlineEmployees.length > 0 && <PulseDot color={C.green} size={7} />}
            <Text style={[styles.statusChipText, { color: onlineEmployees.length > 0 ? C.green : C.textSub }]}>
              {onlineEmployees.length} online · {offlineEmployees.length} offline
            </Text>
          </View>
        </View>
      }
      ListEmptyComponent={<EmptyInline Icon={Users} title="No employees found" sub="Employees appear once registered" />}
    />
  );
});

// ─────────────────────────────────────────────────────────────────
// Visits Tab
// ─────────────────────────────────────────────────────────────────
const VisitsTab = memo(function VisitsTab({
  visits, todayVisits, refreshing, onRefresh,
  loadingMore, hasMoreVisits, visitsPage, fetchVisits,
  expandedVisitId, onToggleVisit,
}: {
  visits: VisitPhoto[]; todayVisits: VisitPhoto[];
  refreshing: boolean; onRefresh: () => void;
  loadingMore: boolean; hasMoreVisits: boolean;
  visitsPage: number; fetchVisits: (page: number) => void;
  expandedVisitId: string | number | null; onToggleVisit: (id: string | number) => void;
}) {
  const renderItem   = useCallback(({ item }: { item: VisitPhoto }) => (
    <LazyVisitCard item={item} expanded={expandedVisitId === item.id} onToggle={onToggleVisit} showEmployee />
  ), [expandedVisitId, onToggleVisit]);
  const keyExtractor = useCallback((item: VisitPhoto) => String(item.id), []);
  const onEndReached = useCallback(() => {
    if (!loadingMore && hasMoreVisits) fetchVisits(visitsPage + 1);
  }, [loadingMore, hasMoreVisits, visitsPage, fetchVisits]);

  return (
    <FlatList
      data={visits} keyExtractor={keyExtractor} renderItem={renderItem}
      contentContainerStyle={[styles.tabContent, { gap: 10 }]}
      showsVerticalScrollIndicator={false} removeClippedSubviews
      maxToRenderPerBatch={5} updateCellsBatchingPeriod={100}
      windowSize={5} initialNumToRender={8}
      onEndReached={onEndReached} onEndReachedThreshold={0.4}
      extraData={expandedVisitId}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.green} />}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <View style={[styles.statusChip, { borderColor: C.blue }]}>
            <Text style={[styles.statusChipText, { color: C.blue }]}>{todayVisits.length} today</Text>
          </View>
          <View style={[styles.statusChip, { borderColor: C.border }]}>
            <Text style={[styles.statusChipText, { color: C.textSub }]}>{visits.length} total</Text>
          </View>
          <Text style={styles.tapHint}>Tap to load photo</Text>
        </View>
      }
      ListFooterComponent={loadingMore ? <Text style={styles.loadingMore}>Loading more…</Text> : null}
      ListEmptyComponent={<EmptyInline Icon={Camera} title="No visit photos yet" sub="Photos logged by employees will appear here" />}
    />
  );
});

// ─────────────────────────────────────────────────────────────────
// Main AdminScreen
// ─────────────────────────────────────────────────────────────────
export default function AdminScreen() {
  const navigation = useNavigation<any>();

  const logout         = useAuthStore((s) => s.logout);
  const employee       = useAuthStore((s) => s.employee);
  const updateEmployee = useLocationStore((s) => s.updateEmployee);

  const { attach, detach } = useAdminRealtimeMap();

  const liveEmployees = useLocationStore((s) => s.liveEmployees);
  const employees     = useMemo(() => Object.values(liveEmployees), [liveEmployees]);

  const [visits,        setVisits]      = useState<VisitPhoto[]>([]);
  const [visitsPage,    setVisitsPage]  = useState(1);
  const [hasMoreVisits, setHasMore]     = useState(true);
  const [loading,       setLoading]     = useState(true);
  const [refreshing,    setRefreshing]  = useState(false);
  const [loadingMore,   setLoadingMore] = useState(false);
  const [error,         setError]       = useState<string | null>(null);
  const [activeTab,     setActiveTab]   = useState('overview');
  const [expandedVisitId, setExpandedVisitId] = useState<string | number | null>(null);

  const onToggleVisit = useCallback((id: string | number) => {
    setExpandedVisitId((prev) => (prev === id ? null : id));
  }, []);

  const onlineEmployees  = useMemo(() => employees.filter((e) => e.is_online),  [employees]);
  const offlineEmployees = useMemo(() => employees.filter((e) => !e.is_online), [employees]);
  const lowBattery       = useMemo(() => employees.filter((e) => e.battery != null && e.battery! < 20), [employees]);
  const todayVisits      = useMemo(() => {
    const today = new Date();
    return visits.filter((v) => {
      const d = new Date(v.uploaded_at);
      return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    });
  }, [visits]);

  const tabCounts = useMemo(() => ({
    overview:  lowBattery.length,
    employees: onlineEmployees.length,
    visits:    todayVisits.length,
  }), [lowBattery.length, onlineEmployees.length, todayVisits.length]);

  const seedEmployees = useCallback(async () => {
    try {
      const empRes = await apiGet<LiveEmployee[]>('/admin/employees/live');
      const list = Array.isArray(empRes) ? empRes : [];
      list.forEach((emp) => updateEmployee(emp));
    } catch (e: any) {
      console.warn('[AdminScreen] seedEmployees failed:', e?.message ?? e);
    }
  }, [updateEmployee]);

  const fetchVisits = useCallback(async (page = 1, silent = false) => {
    if (page === 1 && !silent) setLoading(true);
    if (page > 1)              setLoadingMore(true);
    setError(null);
    try {
      const raw = await apiGet<VisitPhoto[]>(
        `/admin/visits?limit=${VISITS_PAGE_SIZE}&offset=${(page - 1) * VISITS_PAGE_SIZE}`,
      );
      const visitRes = Array.isArray(raw) ? raw : [];
      setVisits((prev) => page === 1 ? visitRes : [...prev, ...visitRes]);
      setHasMore(visitRes.length === VISITS_PAGE_SIZE);
      setVisitsPage(page);
    } catch (e: any) {
      setError(e?.message || 'Failed to load visits');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

const hasFetchedOnce = useRef(false);

useFocusEffect(
  useCallback(() => {
    // ── Data ──────────────────────────────────────────────────
    attach();
    seedEmployees();
    fetchVisits(1, hasFetchedOnce.current);
    hasFetchedOnce.current = true;

    return () => { detach(); };
  }, [attach, detach, seedEmployees, fetchVisits]),
);

  useEffect(() => {
    const id = setInterval(() => fetchVisits(1, true), 60_000);
    return () => clearInterval(id);
  }, [fetchVisits]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setExpandedVisitId(null);
    seedEmployees();
    fetchVisits(1, true);
  }, [fetchVisits, seedEmployees]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Logout',
      `Logout as ${employee?.name ?? 'Admin'}?`,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Logout', style: 'destructive', onPress: logout }],
      { cancelable: true },
    );
  }, [employee?.name, logout]);

  const navigateToMap          = useCallback(() => navigation.navigate('LiveMap'), [navigation]);
  const navigateToMapWithFocus = useCallback((emp: LiveEmployee) => navigation.navigate('LiveMap', { focusId: emp.employee_id }), [navigation]);
  const goToEmployees          = useCallback(() => setActiveTab('employees'), []);
  const goToVisits             = useCallback(() => setActiveTab('visits'),    []);
  const fetchVisitsPage        = useCallback((page: number) => fetchVisits(page), [fetchVisits]);

  const headerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={MC.bg} />

      <LoadingOverlay
        visible={loading && visits.length === 0 && employees.length === 0}
        message="Loading dashboard…"
        variant="dots"
      />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerAnim }]}>
        <View>
          <View style={styles.headerBadge}>
            <PulseDot color={C.green} size={7} />
            <Text style={styles.headerBadgeText}>LIVE DASHBOARD</Text>
          </View>
          <Text style={styles.headerTitle}>Admin Control</Text>
          <Text style={styles.headerSub}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {/* Map icon + label replaces 🗺️ Map */}
          <TouchableOpacity style={styles.mapBtn} onPress={navigateToMap} activeOpacity={0.8}>
            <Map size={13} color={C.bg} strokeWidth={2.5} />
            <Text style={styles.mapBtnText}>Map</Text>
            {onlineEmployees.length > 0 && (
              <View style={styles.mapBadge}>
                <Text style={styles.mapBadgeText}>{onlineEmployees.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>

      <GlowLine />

      <View style={styles.tabBarWrapper}>
        <TabBar active={activeTab} onChange={setActiveTab} counts={tabCounts} />
      </View>

      <View style={styles.content}>
        {activeTab === 'overview' && (
          <OverviewTab
            error={error} lowBattery={lowBattery}
            onlineEmployees={onlineEmployees} offlineEmployees={offlineEmployees}
            employees={employees} todayVisits={todayVisits} visits={visits}
            refreshing={refreshing} onRefresh={onRefresh}
            onDismissError={() => setError(null)} onRetry={() => fetchVisits(1)}
            navigateToMap={navigateToMap} navigateToMapWithFocus={navigateToMapWithFocus}
            goToEmployees={goToEmployees} goToVisits={goToVisits} handleLogout={handleLogout}
            expandedVisitId={expandedVisitId} onToggleVisit={onToggleVisit}
          />
        )}
        {activeTab === 'employees' && (
          <EmployeesTab
            onlineEmployees={onlineEmployees} offlineEmployees={offlineEmployees}
            refreshing={refreshing} onRefresh={onRefresh}
            navigateToMapWithFocus={navigateToMapWithFocus}
          />
        )}
        {activeTab === 'visits' && (
          <VisitsTab
            visits={visits} todayVisits={todayVisits}
            refreshing={refreshing} onRefresh={onRefresh}
            loadingMore={loadingMore} hasMoreVisits={hasMoreVisits}
            visitsPage={visitsPage} fetchVisits={fetchVisitsPage}
            expandedVisitId={expandedVisitId} onToggleVisit={onToggleVisit}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: C.bg },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14 },
  headerBadge:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  headerBadgeText: { fontSize: 9, fontWeight: '800', color: C.green, fontFamily: F.mono, letterSpacing: 2 },
  headerTitle:     { fontSize: 24, fontWeight: '800', color: C.textPrimary, fontFamily: F.display, letterSpacing: -0.5 },
  headerSub:       { fontSize: 11, color: C.textSub, marginTop: 2, fontFamily: F.mono },
  headerActions:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  mapBtn:          { flexDirection: 'row', alignItems: 'center', backgroundColor: C.green, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, gap: 6 },
  mapBtnText:      { fontSize: 12, color: C.bg, fontWeight: '800', fontFamily: F.mono },
  mapBadge:        { backgroundColor: C.bg, borderRadius: 999, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  mapBadgeText:    { fontSize: 10, color: C.green, fontWeight: '800', fontFamily: F.mono },
  tabBarWrapper:   { paddingHorizontal: 16, paddingVertical: 10 },
  content:         { flex: 1 },
  tabContent:      { padding: 16, gap: 16, paddingBottom: 40 },
  statsGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickActions:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  listHeader:      { flexDirection: 'row', gap: 8, marginBottom: 4, alignItems: 'center', flexWrap: 'wrap' },
  statusChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusChipText:  { fontSize: 10, fontWeight: '700', fontFamily: F.mono },
  sectionLabelWrap:{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, backgroundColor: C.bg },
  sectionLabel:    { fontSize: 10, fontWeight: '800', fontFamily: F.mono, letterSpacing: 1.5 },
  visitsList:      { gap: 10 },
  tapHint:         { fontSize: 10, color: C.textFaint, fontFamily: F.mono, fontStyle: 'italic' },
  viewMoreBtn:     { marginTop: 12, alignItems: 'center', paddingVertical: 8 },
  viewMoreText:    { fontSize: 12, color: C.green, fontFamily: F.mono, fontWeight: '700' },
  loadingMore:     { textAlign: 'center', color: C.textSub, paddingVertical: 16, fontSize: 12, fontFamily: F.mono },
  emptyInline:     { alignItems: 'center', paddingVertical: 28, gap: 6 },
  emptyIconWrap:   { marginBottom: 4 },
  emptyText:       { fontSize: 14, fontWeight: '700', color: C.textSub, fontFamily: F.display },
  emptySubText:    { fontSize: 12, color: C.textFaint, fontFamily: F.mono, textAlign: 'center', lineHeight: 18 },
});