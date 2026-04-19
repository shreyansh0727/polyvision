// src/screens/admin/AdminVisitsScreen.tsx
import React, { useEffect, useState, useRef, useCallback, memo } from 'react';
import {
  FlatList, View, Text, StyleSheet, ListRenderItem,
  Animated, Platform, RefreshControl,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import Svg, {
  Circle, Path, Rect, Defs,
  LinearGradient, RadialGradient, Stop, G,
} from 'react-native-svg';
import {
  ClipboardList, MapPin, Clock, Trash2, Image as ImageIcon,
  ChevronRight, ChevronDown, RefreshCw, AlertCircle,
  CheckCircle2, User, CalendarDays, Hash,
} from 'lucide-react-native';
import { apiGet, apiDelete } from '../../services/api';

// ── Design Tokens ─────────────────────────────────────────────────
const C = {
  bg:           '#080C14',
  surface:      '#0E1520',
  surfaceAlt:   '#131B28',
  surfaceLift:  '#1A2438',
  green:        '#10D876',
  greenGlow:    'rgba(16,216,118,0.18)',
  greenDim:     'rgba(16,216,118,0.08)',
  gold:         '#F4B942',
  blue:         '#4B8EF1',
  rose:         '#F05A7E',
  roseDim:      'rgba(240,90,126,0.10)',
  textPrimary:  '#E8EDF5',
  textSub:      '#8A95A8',
  textFaint:    '#3D4A5C',
  border:       '#1C2840',
  borderBright: '#2A3B55',
};

const F = {
  display: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
  mono:    Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
};

// ── Types ─────────────────────────────────────────────────────────
type Visit = {
  visit_id:       string | null;
  id?:            string | null;
  employee_name?: string | null;
  employee_id:    string;
  caption?:       string | null;
  photo_url?:     string | null;
  thumb_url?:     string | null;
  visited_at?:    string | null;
  uploaded_at?:   string | null;
  created_at?:    string | null;
};

// ── Helpers ───────────────────────────────────────────────────────
function resolveId(v: Visit): string | null {
  return v.visit_id ?? v.id ?? null;
}

function resolveDate(v: Visit): Date | null {
  const raw = v.visited_at ?? v.uploaded_at ?? v.created_at ?? null;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function timeAgo(v: Visit): string {
  const d = resolveDate(v);
  if (!d) return '—';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)     return 'Just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-IN');
}

function fullDate(v: Visit): string {
  const d = resolveDate(v);
  if (!d) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function avatarColor(name: string): string {
  const palette = [C.green, C.gold, C.blue, '#A78BFA', '#FB923C'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

// ─────────────────────────────────────────────────────────────────
// AvatarRingSVG
// Draws the coloured ring + background fill for the avatar in SVG
// so it renders crisply without layout passes.
// ─────────────────────────────────────────────────────────────────
function AvatarRingSVG({ color, active }: { color: string; active: boolean }) {
  const size = 44;
  const cx   = size / 2;
  const r    = (size - 3) / 2;   // ring radius

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient id={`ag-${color.replace('#', '')}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0%"   stopColor={color} stopOpacity={active ? 0.22 : 0.10} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {/* Background fill */}
      <Circle
        cx={cx} cy={cx} r={cx}
        fill={`url(#ag-${color.replace('#', '')})`}
      />
      {/* Border ring */}
      <Circle
        cx={cx} cy={cx} r={r}
        fill="none"
        stroke={active ? color : C.border}
        strokeWidth={1.5}
        opacity={active ? 0.9 : 0.5}
      />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────
// AccentBarSVG
// Left-edge accent bar with a vertical gradient (top = accent,
// bottom = transparent) when expanded; flat border when collapsed.
// ─────────────────────────────────────────────────────────────────
function AccentBarSVG({ color, active }: { color: string; active: boolean }) {
  const id = `ab-${color.replace('#', '')}-${active ? '1' : '0'}`;
  return (
    <Svg width={3} height={120} viewBox="0 0 3 120" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%"   stopColor={active ? color : C.border} stopOpacity={active ? 1 : 0.5} />
          <Stop offset="100%" stopColor={active ? color : C.border} stopOpacity={active ? 0.2 : 0.1} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={3} height={120} fill={`url(#${id})`} />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────
// EmptyIllustrationSVG — clipboard + location pin decoration
// ─────────────────────────────────────────────────────────────────
function EmptyIllustrationSVG() {
  return (
    <Svg width={72} height={72} viewBox="0 0 72 72">
      <Defs>
        <RadialGradient id="eig" cx="50%" cy="50%" r="50%">
          <Stop offset="0%"   stopColor={C.green} stopOpacity={0.18} />
          <Stop offset="100%" stopColor={C.green} stopOpacity={0}    />
        </RadialGradient>
      </Defs>
      {/* Glow disc */}
      <Circle cx={36} cy={36} r={36} fill="url(#eig)" />
      {/* Clipboard body */}
      <Rect x={18} y={20} width={36} height={40} rx={5} fill={C.surfaceLift} stroke={C.borderBright} strokeWidth={1} />
      {/* Clip top */}
      <Rect x={28} y={16} width={16} height={8} rx={3} fill={C.surfaceLift} stroke={C.borderBright} strokeWidth={1} />
      {/* Lines */}
      <Rect x={24} y={32} width={24} height={2.5} rx={1.25} fill={C.textFaint} />
      <Rect x={24} y={39} width={18} height={2.5} rx={1.25} fill={C.textFaint} />
      <Rect x={24} y={46} width={20} height={2.5} rx={1.25} fill={C.textFaint} />
      {/* Pin badge */}
      <Circle cx={54} cy={22} r={10} fill={C.surface} stroke={C.borderBright} strokeWidth={1} />
      <Path
        d="M54 15C50.686 15 48 17.686 48 21C48 24.5 54 29 54 29C54 29 60 24.5 60 21C60 17.686 57.314 15 54 15Z"
        fill={C.green}
        opacity={0.9}
      />
      <Circle cx={54} cy={21} r={2.5} fill={C.surface} />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────
// VisitCard
// ─────────────────────────────────────────────────────────────────
const VisitCard = memo(function VisitCard({
  item, index, expanded, onToggle, onDelete,
}: {
  item:     Visit;
  index:    number;
  expanded: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const slideAnim   = useRef(new Animated.Value(24)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim,   { toValue: 0, duration: 320, delay: Math.min(index * 40, 400), useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 280, delay: Math.min(index * 40, 400), useNativeDriver: true }),
    ]).start();
  }, []);

  const [imgLoading, setImgLoading] = useState(true);
  const [deleting,   setDeleting]   = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const onImageLoad = () => {
    setImgLoading(false);
    Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  };

  useEffect(() => {
    if (!expanded) { fadeAnim.setValue(0); setImgLoading(true); }
  }, [expanded]);

  const displayName = item.employee_name ?? item.employee_id ?? 'Unknown';
  const initial     = displayName.charAt(0).toUpperCase();
  const accentColor = avatarColor(displayName);
  const cardKey     = resolveId(item) ?? `visit-${index}`;
  const hasPhoto    = !!item.photo_url;

  const handleDeletePress = () => {
    const visitId = resolveId(item);
    if (!visitId) return;
    onDelete(visitId, displayName);
  };

  return (
    <Animated.View
      style={[
        cs.card,
        { transform: [{ translateY: slideAnim }], opacity: opacityAnim },
        expanded && cs.cardExpanded,
        deleting  && cs.cardDeleting,
      ]}
    >
      {/* SVG accent bar */}
      <View style={{ alignSelf: 'stretch', overflow: 'hidden' }}>
        <AccentBarSVG color={accentColor} active={expanded} />
      </View>

      <View style={cs.body}>

        {/* Tap row */}
        <TouchableOpacity
          style={cs.row}
          onPress={() => onToggle(cardKey)}
          activeOpacity={0.72}
          disabled={!hasPhoto}
        >
          {/* SVG avatar ring + initial overlay */}
          <View style={{ width: 44, height: 44 }}>
            <AvatarRingSVG color={accentColor} active={expanded} />
            <View style={cs.avatarInitialOverlay}>
              <Text style={[cs.avatarText, { color: accentColor }]}>{initial}</Text>
            </View>
          </View>

          <View style={cs.mid}>
            <Text style={cs.name} numberOfLines={1}>{displayName}</Text>
            {item.caption
              ? <Text style={cs.caption} numberOfLines={expanded ? undefined : 1}>{item.caption}</Text>
              : <Text style={cs.noCaption}>No caption</Text>
            }
          </View>

          {/* Right: time badge + chevron */}
          <View style={cs.rightCol}>
            <View style={cs.timeBadge}>
              <Clock size={9} color={C.textSub} style={{ marginRight: 3 }} />
              <Text style={cs.timeAgo}>{timeAgo(item)}</Text>
            </View>
            {hasPhoto && (
              <View style={cs.photoHint}>
                {expanded
                  ? <ChevronDown size={14} color={C.green} />
                  : <>
                      <ChevronRight size={14} color={C.textFaint} />
                      <Text style={cs.photoHintLabel}>Photo</Text>
                    </>
                }
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Divider */}
        <View style={cs.divider} />

        {/* Footer: full date + delete */}
        <View style={cs.footer}>
          <CalendarDays size={11} color={C.textFaint} />
          <Text style={cs.footerDate}>{fullDate(item)}</Text>

          {expanded && (
            <TouchableOpacity
              style={[cs.deleteBtn, deleting && cs.deleteBtnDisabled]}
              onPress={handleDeletePress}
              disabled={deleting}
              activeOpacity={0.72}
            >
              {deleting
                ? <ActivityIndicator size="small" color={C.rose} />
                : <>
                    <Trash2 size={11} color={C.rose} />
                    <Text style={cs.deleteBtnLabel}>Delete</Text>
                  </>
              }
            </TouchableOpacity>
          )}
        </View>

        {/* Lazy image */}
        {expanded && hasPhoto && (
          <View style={cs.imageSection}>
            <View style={cs.imageDivider} />
            <View style={cs.imageWrap}>
              {imgLoading && (
                <View style={cs.imgPlaceholder}>
                  <ImageIcon size={20} color={C.textFaint} />
                  <ActivityIndicator size="small" color={C.green} style={{ marginTop: 6 }} />
                  <Text style={cs.imgPlaceholderText}>Loading photo…</Text>
                </View>
              )}
              <Animated.Image
                source={{ uri: item.photo_url! }}
                style={[cs.image, { opacity: fadeAnim }]}
                resizeMode="cover"
                onLoad={onImageLoad}
                onError={() => setImgLoading(false)}
              />
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
});

const cs = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: C.border, borderTopColor: C.borderBright,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  cardExpanded: { borderColor: C.borderBright, shadowOpacity: 0.5, shadowRadius: 16, elevation: 10 },
  cardDeleting: { opacity: 0.5 },
  body:         { flex: 1, padding: 14 },

  row:                { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarInitialOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '800', fontFamily: F.display },
  mid:        { flex: 1 },
  name:       { fontSize: 13, fontWeight: '700', color: C.textPrimary, fontFamily: F.display },
  caption:    { fontSize: 12, color: C.textSub, fontFamily: F.mono, marginTop: 2, lineHeight: 17 },
  noCaption:  { fontSize: 11, color: C.textFaint, fontFamily: F.mono, marginTop: 2, fontStyle: 'italic' },

  rightCol:      { alignItems: 'flex-end', gap: 5 },
  timeBadge:     {
    backgroundColor: C.surfaceLift, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: C.border,
    flexDirection: 'row', alignItems: 'center',
  },
  timeAgo:       { fontSize: 9, fontWeight: '700', color: C.textSub, fontFamily: F.mono, letterSpacing: 0.5 },
  photoHint:     { flexDirection: 'row', alignItems: 'center', gap: 2 },
  photoHintLabel:{ fontSize: 8, color: C.textFaint, fontFamily: F.mono, letterSpacing: 0.5 },

  divider: { height: 1, backgroundColor: C.border, marginVertical: 10 },

  footer:          { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerDate:      { fontSize: 10, color: C.textFaint, fontFamily: F.mono, flex: 1 },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.roseDim, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: `${C.rose}30`,
    minWidth: 72, justifyContent: 'center',
  },
  deleteBtnDisabled: { opacity: 0.5 },
  deleteBtnLabel:    { fontSize: 11, fontWeight: '700', color: C.rose, fontFamily: F.mono },

  imageSection:      { marginTop: 2 },
  imageDivider:      { height: 1, backgroundColor: C.borderBright, marginBottom: 12 },
  imageWrap: {
    borderRadius: 10, overflow: 'hidden',
    minHeight: 200, backgroundColor: C.surfaceAlt,
    justifyContent: 'center', alignItems: 'center',
  },
  imgPlaceholder: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', gap: 4, zIndex: 1,
  },
  imgPlaceholderText: { fontSize: 11, color: C.textSub, fontFamily: F.mono, marginTop: 2 },
  image:              { width: '100%', height: 220 },
});

// ─────────────────────────────────────────────────────────────────
// VisitsHeader
// ─────────────────────────────────────────────────────────────────
function VisitsHeader({ count }: { count: number }) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 100, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[hs.wrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
    >
      <View style={hs.titleRow}>
        <ClipboardList size={18} color={C.green} />
        <Text style={hs.title}>Visit Log</Text>
        <View style={hs.chip}>
          <Hash size={8} color={C.green} />
          <Text style={hs.chipText}>{count} records</Text>
        </View>
      </View>
      <Text style={hs.sub}>Employee location check-ins</Text>
      <View style={hs.hintRow}>
        <ImageIcon size={9} color={C.textFaint} />
        <Text style={hs.hint}>Tap a visit to view photo · Expand to delete</Text>
      </View>
    </Animated.View>
  );
}

const hs = StyleSheet.create({
  wrap:     { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title:    { fontSize: 20, fontWeight: '800', color: C.textPrimary, fontFamily: F.display, letterSpacing: 0.3, flex: 1 },
  chip:     {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.greenDim, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: C.greenGlow,
  },
  chipText: { fontSize: 10, fontWeight: '700', color: C.green, fontFamily: F.mono, letterSpacing: 0.5 },
  sub:      { fontSize: 11, color: C.textFaint, fontFamily: F.mono },
  hintRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  hint:     { fontSize: 10, color: C.textFaint, fontFamily: F.mono, fontStyle: 'italic' },
});

// ─────────────────────────────────────────────────────────────────
// SkeletonCard
// ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] });

  return (
    <Animated.View style={[ss.card, { opacity }]}>
      <View style={ss.accentBar} />
      <View style={ss.body}>
        <View style={ss.row}>
          <View style={ss.avatar} />
          <View style={ss.lines}>
            <View style={ss.lineWide} />
            <View style={ss.lineNarrow} />
          </View>
          <View style={ss.badge} />
        </View>
        <View style={ss.divider} />
        <View style={ss.footerLine} />
      </View>
    </Animated.View>
  );
}

const SHIMMER = C.surfaceLift;
const ss = StyleSheet.create({
  card:       { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  accentBar:  { width: 3, backgroundColor: C.border },
  body:       { flex: 1, padding: 14 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar:     { width: 44, height: 44, borderRadius: 22, backgroundColor: SHIMMER },
  lines:      { flex: 1, gap: 6 },
  lineWide:   { height: 12, borderRadius: 6, backgroundColor: SHIMMER, width: '65%' },
  lineNarrow: { height: 10, borderRadius: 5, backgroundColor: SHIMMER, width: '40%' },
  badge:      { width: 52, height: 22, borderRadius: 999, backgroundColor: SHIMMER },
  divider:    { height: 1, backgroundColor: C.border, marginVertical: 10 },
  footerLine: { height: 10, borderRadius: 5, backgroundColor: SHIMMER, width: '50%' },
});

// ─────────────────────────────────────────────────────────────────
// EmptyState
// ─────────────────────────────────────────────────────────────────
function EmptyState() {
  const scaleAnim   = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: 1, friction: 8, tension: 80, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 400,            useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[es.wrap, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}
    >
      <View style={es.card}>
        <EmptyIllustrationSVG />
        <Text style={es.title}>No visits yet</Text>
        <Text style={es.sub}>
          Check-in records will appear here once employees start logging visits
        </Text>
        <View style={es.hintRow}>
          <MapPin size={10} color={C.textFaint} />
          <Text style={es.hintText}>Locations tracked on check-in</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const es = StyleSheet.create({
  wrap:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  card:    {
    backgroundColor: C.surface, borderRadius: 20,
    paddingHorizontal: 32, paddingVertical: 28,
    alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  title:   { fontSize: 15, fontWeight: '700', color: C.textPrimary, fontFamily: F.display },
  sub:     { fontSize: 12, color: C.textSub, fontFamily: F.mono, textAlign: 'center', maxWidth: 230, lineHeight: 18 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  hintText:{ fontSize: 10, color: C.textFaint, fontFamily: F.mono },
});

// ─────────────────────────────────────────────────────────────────
// AdminVisitsScreen
// ─────────────────────────────────────────────────────────────────
export default function AdminVisitsScreen() {
  const [visits,     setVisits]     = useState<Visit[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadVisits = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    apiGet<Visit[]>('/admin/visits?limit=100')
      .then((data) => setVisits(data || []))
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  };

  useEffect(() => { loadVisits(); }, []);

  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const onRefresh = useCallback(() => {
    setExpandedId(null);
    loadVisits(true);
  }, []);

  const handleDelete = useCallback((visitId: string, employeeName: string) => {
    Alert.alert(
      'Delete Visit',
      `Remove this visit record from ${employeeName}?\n\nThe photo will also be deleted from storage. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(visitId);
            try {
              await apiDelete(`/visits/${visitId}`);
              setVisits((prev) => prev.filter((v) => resolveId(v) !== visitId));
              setExpandedId(null);
            } catch (e: any) {
              Alert.alert(
                'Delete Failed',
                e?.message ?? 'Could not delete this visit. Please try again.',
                [{ text: 'OK' }],
              );
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  }, []);

  const keyExtractor = useCallback(
    (item: Visit, index: number) => resolveId(item) ?? `visit-${index}`,
    [],
  );

  const renderItem: ListRenderItem<Visit> = useCallback(
    ({ item, index }) => {
      const cardKey = resolveId(item) ?? `visit-${index}`;
      return (
        <VisitCard
          item={item}
          index={index}
          expanded={expandedId === cardKey}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      );
    },
    [expandedId, handleToggle, handleDelete],
  );

  if (loading) {
    return (
      <View style={gs.container}>
        <VisitsHeader count={0} />
        <View style={gs.list}>
          {[...Array(6)].map((_, i) => <SkeletonCard key={`skeleton-${i}`} />)}
        </View>
      </View>
    );
  }

  return (
    <View style={gs.container}>
      <FlatList
        data={visits}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={<VisitsHeader count={visits.length} />}
        contentContainerStyle={visits.length === 0 ? gs.emptyList : gs.list}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={<EmptyState />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.green}
            colors={[C.green]}
          />
        }
        showsVerticalScrollIndicator={false}
        extraData={expandedId}
      />
    </View>
  );
}

const gs = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  list:      { padding: 16, paddingTop: 14, paddingBottom: 40, gap: 0 },
  emptyList: { flexGrow: 1 },
});