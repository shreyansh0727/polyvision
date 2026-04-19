// src/components/map/EmployeeListPanel.tsx
import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Animated, Dimensions, ViewStyle,
} from 'react-native';
import Svg, { Circle, Path, G } from 'react-native-svg';
import {
  X, MapPin, Clock, BatteryLow, BatteryMedium, BatteryFull,
  Battery, Wifi, WifiOff, Users, ChevronRight,
} from 'lucide-react-native';
import { LiveEmployee } from '../../types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PANEL_HEIGHT = SCREEN_HEIGHT * 0.52;
const STALE_MS     = 5 * 60 * 1000;

// ── Palette (light admin theme) ───────────────────────────────────
const C = {
  ink:        '#1c1c1a',
  inkMid:     '#44433f',
  muted:      '#7a7974',
  faint:      '#bab9b4',
  surface:    '#ffffff',
  surfaceAlt: '#f7f6f2',
  border:     '#e8e6e0',
  divider:    '#f3f0ec',
  tealDark:   '#085041',
  teal:       '#0F6E56',
  tealLight:  '#E1F5EE',
  green:      '#437a22',
  greenLight: '#EAF3DE',
  amber:      '#d19900',
  amberLight: '#FAEEDA',
  rose:       '#a12c7b',
  roseLight:  '#FBEAF0',
};

// ─────────────────────────────────────────────────────────────────
// StatusDotSVG — live/stale indicator with subtle glow
// ─────────────────────────────────────────────────────────────────
function StatusDotSVG({ online }: { online: boolean }) {
  const color = online ? C.teal : C.muted;
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      {online && (
        <Circle cx={8} cy={8} r={7} fill={color} opacity={0.15} />
      )}
      <Circle cx={8} cy={8} r={4} fill={color} />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────
// BatteryIcon — level-aware lucide variant
// ─────────────────────────────────────────────────────────────────
function BatteryIcon({ level }: { level: number | null | undefined }) {
  if (level == null) return <Battery size={13} color={C.muted} />;
  const color =
    level > 50 ? C.green :
    level > 20 ? C.amber : C.rose;
  if (level <= 20) return <BatteryLow    size={13} color={color} />;
  if (level <= 50) return <BatteryMedium size={13} color={color} />;
  return              <BatteryFull   size={13} color={color} />;
}

function batteryTextColor(b: number | null | undefined): string {
  if (b == null) return C.muted;
  if (b > 50)    return C.green;
  if (b > 20)    return C.amber;
  return C.rose;
}

// ─────────────────────────────────────────────────────────────────
// timeAgo
// ─────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString('en-IN');
}

// ─────────────────────────────────────────────────────────────────
// EmployeeRow
// ─────────────────────────────────────────────────────────────────
function EmployeeRow({
  item, onPress,
}: {
  item:    LiveEmployee;
  onPress: (emp: LiveEmployee) => void;
}) {
  const isOnline = Date.now() - new Date(item.recorded_at).getTime() < STALE_MS;

  return (
    <TouchableOpacity
      style={s.row}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      {/* Status dot + name + coords */}
      <View style={s.rowLeft}>
        <StatusDotSVG online={isOnline} />
        <View style={s.nameGroup}>
          <Text style={s.name}>{item.name}</Text>
          <View style={s.coordRow}>
            <MapPin size={9} color={C.faint} />
            <Text style={s.coords} numberOfLines={1}>
              {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
            </Text>
          </View>
        </View>
      </View>

      {/* Battery + time + chevron */}
      <View style={s.rowRight}>
        <View style={s.batteryRow}>
          <BatteryIcon level={item.battery} />
          <Text style={[s.batteryText, { color: batteryTextColor(item.battery) }]}>
            {item.battery != null ? `${item.battery}%` : '—'}
          </Text>
        </View>
        <View style={s.timeRow}>
          <Clock size={9} color={C.muted} />
          <Text style={s.time}>{timeAgo(item.recorded_at)}</Text>
        </View>
      </View>

      <ChevronRight size={13} color={C.faint} style={{ marginLeft: 4 }} />
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────
// SectionHeader
// ─────────────────────────────────────────────────────────────────
function SectionHeader({ title, count }: { title: string; count: number }) {
  const isOnline = title === 'Online';
  return (
    <View style={s.sectionHeader}>
      {isOnline
        ? <Wifi    size={11} color={C.teal} />
        : <WifiOff size={11} color={C.muted} />}
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={[
        s.countPill,
        { backgroundColor: isOnline ? C.tealLight : C.surfaceAlt },
      ]}>
        <Text style={[
          s.countText,
          { color: isOnline ? C.tealDark : C.muted },
        ]}>
          {count}
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// EmptyState (inline — removes external EmptyState import)
// ─────────────────────────────────────────────────────────────────
function InlineEmpty() {
  return (
    <View style={s.empty}>
      <View style={s.emptyIconWrap}>
        <Users size={28} color={C.muted} />
      </View>
      <Text style={s.emptyTitle}>No employees online</Text>
      <Text style={s.emptySub}>Employees appear here once they start tracking</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// EmployeeListPanel
// ─────────────────────────────────────────────────────────────────
interface Props {
  employees: LiveEmployee[];
  onSelect:  (emp: LiveEmployee) => void;
  onClose:   () => void;
  style?:    ViewStyle;
}

export default function EmployeeListPanel({
  employees, onSelect, onClose, style,
}: Props) {
  const slideY = useRef(new Animated.Value(PANEL_HEIGHT)).current;

  useEffect(() => {
    Animated.spring(slideY, {
      toValue: 0, friction: 9, tension: 80, useNativeDriver: true,
    }).start();
  }, []);

  const handleClose = () => {
    Animated.timing(slideY, {
      toValue: PANEL_HEIGHT, duration: 240, useNativeDriver: true,
    }).start(() => onClose());
  };

  const online  = employees.filter((e) => Date.now() - new Date(e.recorded_at).getTime() < STALE_MS);
  const offline = employees.filter((e) => Date.now() - new Date(e.recorded_at).getTime() >= STALE_MS);

  type ListItem =
    | { type: 'header';   title: string; count: number }
    | { type: 'employee'; data: LiveEmployee };

  const listData: ListItem[] = [
    ...(online.length > 0
      ? [
          { type: 'header'   as const, title: 'Online',  count: online.length },
          ...online.map((e) => ({ type: 'employee' as const, data: e })),
        ]
      : []),
    ...(offline.length > 0
      ? [
          { type: 'header'   as const, title: 'Offline', count: offline.length },
          ...offline.map((e) => ({ type: 'employee' as const, data: e })),
        ]
      : []),
  ];

  return (
    <>
      {/* Backdrop */}
      <TouchableOpacity
        style={s.backdrop}
        onPress={handleClose}
        activeOpacity={1}
      />

      {/* Panel */}
      <Animated.View
        style={[s.panel, { transform: [{ translateY: slideY }] }, style]}
      >
        {/* Drag handle */}
        <View style={s.handle} />

        {/* Header */}
        <View style={s.panelHeader}>
          <View style={s.panelTitleRow}>
            <Users size={15} color={C.ink} />
            <Text style={s.panelTitle}>All Employees</Text>
            <Text style={s.panelCount}>({employees.length})</Text>
          </View>
          <TouchableOpacity
            style={s.closeBtn}
            onPress={handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={14} color={C.muted} />
          </TouchableOpacity>
        </View>

        {/* List / empty */}
        {employees.length === 0
          ? <InlineEmpty />
          : (
            <FlatList
              data={listData}
              keyExtractor={(item, index) =>
                item.type === 'header'
                  ? `header-${item.title}`
                  : `emp-${item.data.employee_id}-${index}`
              }
              renderItem={({ item }) => {
                if (item.type === 'header') {
                  return <SectionHeader title={item.title} count={item.count} />;
                }
                return (
                  <EmployeeRow
                    item={item.data}
                    onPress={(emp) => {
                      handleClose();
                      setTimeout(() => onSelect(emp), 260);
                    }}
                  />
                );
              }}
              ItemSeparatorComponent={() => <View style={s.separator} />}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.listContent}
            />
          )}
      </Animated.View>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28, 25, 20, 0.3)',
    zIndex: 10,
  },
  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: PANEL_HEIGHT, backgroundColor: C.surface,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    zIndex: 11,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, elevation: 10,
    paddingHorizontal: 16, paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: C.border, marginTop: 10, marginBottom: 6,
  },

  // Header
  panelHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  panelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelTitle:    { fontSize: 16, fontWeight: '700', color: C.ink },
  panelCount:    { fontSize: 14, fontWeight: '400', color: C.muted },
  closeBtn:      { width: 28, height: 28, borderRadius: 8, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },

  // Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 8, paddingTop: 14,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: C.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, flex: 1,
  },
  countPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  countText: { fontSize: 11, fontWeight: '700' },

  // Row
  row:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  rowLeft:    { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  rowRight:   { alignItems: 'flex-end', gap: 4 },
  nameGroup:  { flex: 1, gap: 3, minWidth: 0 },
  name:       { fontSize: 14, fontWeight: '600', color: C.ink },
  coordRow:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  coords:     { fontSize: 10, color: C.faint, fontFamily: 'monospace' },
  batteryRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  batteryText:{ fontSize: 12, fontWeight: '600' },
  timeRow:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  time:       { fontSize: 11, color: C.muted },

  separator:   { height: 1, backgroundColor: C.divider },
  listContent: { paddingBottom: 16 },

  // Empty state
  empty:        { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 10 },
  emptyIconWrap:{ width: 60, height: 60, borderRadius: 18, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:   { fontSize: 15, fontWeight: '700', color: C.inkMid },
  emptySub:     { fontSize: 12, color: C.muted, textAlign: 'center', maxWidth: 240, lineHeight: 18 },
});