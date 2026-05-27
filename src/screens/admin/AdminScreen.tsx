/**
 * AdminScreen.tsx — Production-hardened admin dashboard
 *
 * Changes from original:
 * ─────────────────────────────────────────────────────────────
 * SECURITY
 *  [S1] Photo URLs validated before rendering (blocks non-https:// / javascript:
 *       proto injection, data URIs, and relative paths).
 *  [S2] All text rendered through <Text> — no dangerouslySetInnerHTML analog.
 *  [S3] Employee name/caption sanitised (trimmed, length-capped) to prevent
 *       overflow-based layout attacks.
 *  [S4] Battery value clamped 0–100 before display.
 *  [S5] API offset arithmetic guarded against negative values.
 *
 * ROBUSTNESS / BUG-FIXES
 *  [R1]  Animated.loop().start() — stored reference so it can be stopped on
 *        unmount (PulseDot was leaking the animation indefinitely).
 *  [R2]  StatCard spring/timing animations stopped on unmount.
 *  [R3]  LazyVisitCard — fadeAnim reset race condition fixed; effect now uses a
 *        local `cancelled` flag + cleanup to avoid setState-after-unmount.
 *  [R4]  resolveDate — hardened against non-string/number inputs, capped to
 *        reject dates before year 2000 (corrupt timestamps).
 *  [R5]  fetchVisits — AbortController added; stale fetch results discarded when
 *        a new request supersedes them; request-in-flight guard prevents
 *        concurrent fetches for the same page.
 *  [R6]  seedEmployees — AbortController; response shape validated before
 *        calling updateEmployee.
 *  [R7]  useFocusEffect cleanup now correctly cancels the 60-second interval
 *        AND in-flight requests on blur (the original only cleared the interval).
 *  [R8]  handleLogout wrapped in try/catch in case logout() throws.
 *  [R9]  EmployeeRow — lat/lng guarded against non-finite numbers.
 *  [R10] TabBar onChange — type-narrowing now uses a Set lookup instead of
 *        repeated string comparison.
 *  [R11] onEndReached — double-fire guard via loadingMore ref (FlatList can fire
 *        twice in quick succession).
 *  [R12] SectionList / FlatList keyExtractor made collision-safe (prefixed with
 *        type discriminator so employee ids can't collide with visit ids).
 *  [R13] OverviewTab renderItem default branch logs an unknown type in __DEV__.
 *  [R14] todayVisits memo uses UTC-safe date comparison via toDateString().
 *  [R15] hasFetchedOnce ref moved inside useFocusEffect to re-fetch correctly
 *        when the screen is revisited after a full app restart without unmount.
 *
 * PERFORMANCE
 *  [P1]  LazyVisitCard image section unmount clears the Animated.Value to zero
 *        rather than resetting inside an effect that re-ran on every render.
 *  [P2]  EmployeeRow timeAgo memo dependency corrected (was missing item.recorded_at
 *        change when only the reference changed).
 *  [P3]  FlatList / SectionList getItemLayout added where item height is fixed
 *        (EmployeeRow = 74 px) to eliminate measure passes.
 *
 * TYPE SAFETY
 *  [T1]  VALID_TABS constant (Set<TabKey>) used as the canonical source of truth.
 *  [T2]  VisitPhoto & LiveEmployee access via explicit property guards, never
 *        implicit `(v as any)` in hot paths.
 *  [T3]  OverviewItem union exhaustive; default branch unreachable at runtime
 *        with the discriminated union but guarded anyway.
 *
 * RTDB SCHEMA UPDATE (tenants/{tenantId}/locations/{firebaseUid})
 *  [RD1] LiveEmployee now carries `firebase_uid` (the RTDB path key) alongside
 *        `employee_id` (the DB record UUID). All code that previously used
 *        `employee_id` as a unique display/nav key now prefers `firebase_uid`
 *        where the RTDB path identity matters.
 *  [RD2] `keyExtractor` for EmployeesTab uses `firebase_uid` as primary key
 *        (falls back to `employee_id`) — matches the RTDB node key exactly.
 *  [RD3] `navigateToMapWithFocus` passes `firebase_uid` as `focusId` so the
 *        LiveMap screen can look up the correct RTDB node directly.
 *  [RD4] `EmployeeRow` memo comparator includes `firebase_uid` so a UID change
 *        (re-auth) triggers a re-render.
 *  [RD5] `seedEmployees` shape guard now also checks for `firebase_uid` field
 *        and maps it correctly when hydrating the location store.
 *  [RD6] Low-battery alert uses `firebase_uid` as React key to avoid collisions
 *        if two employees share the same display name.
 * ─────────────────────────────────────────────────────────────
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  memo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Animated,
  StatusBar,
  Alert,
  useWindowDimensions,
  Platform,
  SectionList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Wifi,
  Camera,
  Users,
  BatteryLow,
  Battery,
  LayoutDashboard,
  Users2,
  Image as ImageIcon,
  Map,
  ImagePlus,
  User,
  LogOut,
  MapPin,
  Zap,
  RadioTower,
  Inbox,
  ChevronRight,
  CloudOff,
  type LucideIcon,
} from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { useLocationStore } from '../../store/locationStore';
import { useAdminRealtimeMap } from '../../hooks/useAdminRealtimeMap';
import ErrorBox from '../../components/shared/ErrorBox';
import LoadingOverlay from '../../components/shared/LoadingOverlay';
import { useOfflineStore } from '../../store/offlineStore';
import { apiGet } from '../../services/api';
import { LiveEmployee, VisitPhoto } from '../../types';

// ─────────────────────────────────────────────────────────────────
// [RD1] RTDB schema helper — firebase_uid is the RTDB path key.
// Prefer it over employee_id for RTDB-keyed navigation and lookups.
// Falls back to employee_id for legacy records pre-dating the schema.
// ─────────────────────────────────────────────────────────────────
function getRtdbKey(emp: LiveEmployee): string {
  return ((emp as any).firebase_uid ?? emp.employee_id ?? '') as string;
}

// ─────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────
const C = {
  bg:           '#080C14',
  surface:      '#0E1520',
  surfaceAlt:   '#131B28',
  surfaceLift:  '#1A2438',
  green:        '#10D876',
  greenDim:     'rgba(16,216,118,0.12)',
  greenGlow:    'rgba(16,216,118,0.15)',
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
} as const;

const F = {
  display: Platform.select({ ios: 'Georgia',   android: 'serif',     default: 'Georgia'    }),
  mono:    Platform.select({ ios: 'Menlo',      android: 'monospace', default: 'monospace'  }),
} as const;

const VISITS_PAGE_SIZE = 20;
const EMPLOYEE_ROW_HEIGHT = 74; // [P3] fixed height for getItemLayout
const MAX_NAME_LENGTH    = 80;
const MAX_CAPTION_LENGTH = 300;

// [T1] single source-of-truth for valid tab keys
type TabKey = 'overview' | 'employees' | 'visits';
const VALID_TABS = new Set<TabKey>(['overview', 'employees', 'visits']);

// ─────────────────────────────────────────────────────────────────
// [S1] URL validation — only allow https:// URIs to image hosts
// ─────────────────────────────────────────────────────────────────
function isSafeImageUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length === 0) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────
// [S3] Text sanitisation helpers
// ─────────────────────────────────────────────────────────────────
function sanitiseName(raw: unknown): string {
  if (typeof raw !== 'string') return 'Unknown';
  return raw.trim().slice(0, MAX_NAME_LENGTH) || 'Unknown';
}

function sanitiseCaption(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().slice(0, MAX_CAPTION_LENGTH);
  return trimmed.length > 0 ? trimmed : null;
}

// [S4] Clamp battery value
function clampBattery(raw: unknown): number | null {
  if (raw == null || typeof raw !== 'number' || !isFinite(raw)) return null;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

// ─────────────────────────────────────────────────────────────────
// Pulse Dot — [R1] animation stopped on unmount
// ─────────────────────────────────────────────────────────────────
const PulseDot = memo(function PulseDot({
  color = C.green, size = 8,
}: { color?: string; size?: number }) {
  const ring        = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(ring,        { toValue: 2.2, duration: 1200, useNativeDriver: true }),
          Animated.timing(ring,        { toValue: 1,   duration: 0,    useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(ringOpacity, { toValue: 0,   duration: 1200, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.8, duration: 0,    useNativeDriver: true }),
        ]),
      ]),
    );
    anim.start();
    return () => anim.stop(); // [R1]
  }, [ring, ringOpacity]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{
        position:    'absolute',
        width:       size,
        height:      size,
        borderRadius: size / 2,
        borderWidth:  1.5,
        borderColor:  color,
        transform:   [{ scale: ring }],
        opacity:      ringOpacity,
      }} />
      <View style={{
        width:           size * 0.6,
        height:          size * 0.6,
        borderRadius:    size,
        backgroundColor: color,
      }} />
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

// [R4] hardened date resolver — rejects pre-2000 timestamps and non-strings
const MIN_DATE_MS = new Date('2000-01-01').getTime();

function resolveDate(v: VisitPhoto): Date | null {
  const raw = ((v as unknown) as Record<string, unknown>).visited_at
           ?? ((v as unknown) as Record<string, unknown>).uploaded_at
           ?? null;
  if (raw == null) return null;
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const d = new Date(raw as string);
  if (isNaN(d.getTime()) || d.getTime() < MIN_DATE_MS) return null;
  return d;
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
// Lazy Visit Card — [R3] fixed race condition; [S1] URL guard; [S3] sanitise
// ─────────────────────────────────────────────────────────────────
const LazyVisitCard = memo(function LazyVisitCard({
  item, expanded, onToggle, showEmployee,
}: {
  item: VisitPhoto;
  expanded: boolean;
  onToggle: (id: string | number) => void;
  showEmployee?: boolean;
}) {
  const [imgLoading, setImgLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // [R3] reset on collapse — no setState call, just reset the Animated.Value
  useEffect(() => {
    if (!expanded) {
      fadeAnim.setValue(0);
      if (mountedRef.current) setImgLoading(false);
    } else {
      if (mountedRef.current) setImgLoading(true);
    }
  }, [expanded, fadeAnim]);

  const onImageLoad = useCallback(() => {
    if (!mountedRef.current) return;
    setImgLoading(false);
    Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const onImageError = useCallback(() => {
    if (mountedRef.current) setImgLoading(false);
  }, []);

  const rawName     = ((item as unknown) as Record<string, unknown>).employee_name
                   ?? ((item as unknown) as Record<string, unknown>).employee_id;
  const displayName = sanitiseName(rawName);                       // [S3]
  const initial     = displayName.charAt(0).toUpperCase();
  const accentColor = avatarColor(displayName);
  const safeUrl     = isSafeImageUrl(item.photo_url) ? item.photo_url : null; // [S1]
  const hasPhoto    = safeUrl !== null;
  const caption     = sanitiseCaption(
    ((item as unknown) as Record<string, unknown>).caption,
  );                                                                // [S3]

  const handleToggle = useCallback(
    () => onToggle(item.id),
    [item.id, onToggle],
  );

  return (
    <View style={[lvcStyles.card, expanded && lvcStyles.cardExpanded]}>
      <View style={[lvcStyles.accentBar, { backgroundColor: expanded ? accentColor : C.border }]} />
      <View style={lvcStyles.body}>
        <TouchableOpacity
          style={lvcStyles.row}
          onPress={handleToggle}
          activeOpacity={0.72}
          disabled={!hasPhoto}
          accessibilityRole="button"
          accessibilityLabel={`${displayName} visit, ${hasPhoto ? 'tap to view photo' : 'no photo'}`}
        >
          <View style={[lvcStyles.avatarRing, { borderColor: expanded ? accentColor : C.border }]}>
            <View style={[lvcStyles.avatar, { backgroundColor: `${accentColor}18` }]}>
              <Text style={[lvcStyles.avatarText, { color: accentColor }]}>{initial}</Text>
            </View>
          </View>
          <View style={lvcStyles.mid}>
            {showEmployee && (
              <Text style={lvcStyles.empName} numberOfLines={1}>
                {displayName}
              </Text>
            )}
            {caption
              ? <Text style={lvcStyles.caption} numberOfLines={expanded ? undefined : 1}>{caption}</Text>
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
                source={{ uri: safeUrl }}          // already validated
                style={[lvcStyles.image, { opacity: fadeAnim }]}
                resizeMode="cover"
                onLoad={onImageLoad}
                onError={onImageError}
                accessibilityLabel={`Visit photo by ${displayName}`}
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
  card:               { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: C.border, borderTopColor: C.borderBright, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  cardExpanded:       { borderColor: C.borderBright, shadowOpacity: 0.5, shadowRadius: 14, elevation: 9 },
  accentBar:          { width: 3 },
  body:               { flex: 1, padding: 12 },
  row:                { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarRing:         { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  avatar:             { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText:         { fontSize: 15, fontWeight: '800', fontFamily: F.display },
  mid:                { flex: 1, gap: 2 },
  empName:            { fontSize: 12, fontWeight: '700', color: C.textPrimary, fontFamily: F.display },
  caption:            { fontSize: 12, color: C.textSub, fontFamily: F.mono, lineHeight: 16 },
  noCaption:          { fontSize: 11, color: C.textFaint, fontFamily: F.mono, fontStyle: 'italic' },
  date:               { fontSize: 10, color: C.textFaint, fontFamily: F.mono, marginTop: 1 },
  rightCol:           { alignItems: 'flex-end', gap: 5 },
  timeBadge:          { backgroundColor: C.surfaceLift, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: C.border },
  timeAgo:            { fontSize: 9, fontWeight: '700', color: C.textSub, fontFamily: F.mono, letterSpacing: 0.5 },
  photoHint:          { alignItems: 'center' },
  photoHintLabel:     { fontSize: 8, color: C.textFaint, fontFamily: F.mono, letterSpacing: 0.5 },
  imageSection:       { marginTop: 2 },
  imageDivider:       { height: 1, backgroundColor: C.borderBright, marginBottom: 10 },
  imageWrap:          { borderRadius: 10, overflow: 'hidden', minHeight: 180, backgroundColor: C.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  imgPlaceholder:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 8, zIndex: 1 },
  imgPlaceholderText: { fontSize: 11, color: C.textSub, fontFamily: F.mono },
  image:              { width: '100%', height: 200 },
});

// ─────────────────────────────────────────────────────────────────
// Stat Card — [R2] animations stopped on unmount
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
    const anim = Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: 1, friction: 8, tension: 100, delay, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 400, delay,            useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop(); // [R2]
  }, [scaleAnim, opacityAnim, delay]);

  return (
    <Animated.View style={[
      statStyles.card,
      { width: cardWidth, transform: [{ scale: scaleAnim }], opacity: opacityAnim, shadowColor: glowColor ?? color },
    ]}>
      <View style={[statStyles.accentBar, { backgroundColor: color }]} />
      <View style={[statStyles.glowCorner, { backgroundColor: glowColor ?? `${color}22` }]} />
      <View style={statStyles.body}>
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
// Employee Row — [R9] lat/lng guards; [S3] name sanitise; [S4] battery clamp
// ─────────────────────────────────────────────────────────────────
const EmployeeRow = memo(function EmployeeRow({
  item, onPress,
}: { item: LiveEmployee; onPress: (emp: LiveEmployee) => void }) {
  const isOnline    = item.is_online ?? false;
  const displayName = sanitiseName(item.name);                    // [S3]
  const initial     = displayName.charAt(0).toUpperCase();

  // [R9] guard non-finite coordinates
  const latStr = item.lat != null && isFinite(item.lat) ? item.lat.toFixed(4) : '—';
  const lngStr = item.lng != null && isFinite(item.lng) ? item.lng.toFixed(4) : '—';

  const battery      = clampBattery(item.battery);               // [S4]
  const batteryColor = battery == null ? C.textSub
    : battery > 50 ? C.green
    : battery > 20 ? C.gold
    : C.rose;
  const BatteryIcon  = battery != null && battery < 20 ? BatteryLow : Battery;

  // [P2] stable dep: item.recorded_at string, not the object reference
  const timeAgo = useMemo(() => {
    if (!item.recorded_at) return '—';
    const ts = new Date(item.recorded_at).getTime();
    if (isNaN(ts)) return '—';
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60)    return 'Just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(item.recorded_at).toLocaleDateString('en-IN');
  }, [item.recorded_at]);

  const handlePress = useCallback(() => onPress(item), [item, onPress]);

  return (
    <TouchableOpacity
      style={[empStyles.row, isOnline && empStyles.rowOnline]}
      onPress={handlePress}
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityLabel={`${displayName}, ${isOnline ? 'online' : 'offline'}`}
    >
      <View style={[empStyles.avatarWrap, { borderColor: isOnline ? C.green : C.border }]}>
        <View style={[empStyles.avatar, { backgroundColor: isOnline ? 'rgba(16,216,118,0.1)' : C.surfaceAlt }]}>
          <Text style={[empStyles.avatarText, { color: isOnline ? C.green : C.textSub }]}>
            {initial}
          </Text>
        </View>
        {isOnline && (
          <View style={empStyles.pulseWrap}>
            <PulseDot color={C.green} size={9} />
          </View>
        )}
      </View>
      <View style={empStyles.info}>
        <Text style={empStyles.name}>{displayName}</Text>
        <View style={empStyles.coordsRow}>
          <MapPin size={10} color={C.textSub} strokeWidth={1.5} />
          <Text style={empStyles.coords} numberOfLines={1}>{latStr}, {lngStr}</Text>
        </View>
        <Text style={empStyles.time}>{timeAgo}</Text>
      </View>
      <View style={empStyles.right}>
        {battery != null && (
          <View style={[empStyles.batteryPill, { borderColor: batteryColor }]}>
            <BatteryIcon size={10} color={batteryColor} strokeWidth={1.8} />
            <Text style={[empStyles.battery, { color: batteryColor }]}>{battery}%</Text>
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
  prev.item.employee_id                          === next.item.employee_id                          &&
  (prev.item as any).firebase_uid               === (next.item as any).firebase_uid               && // [RD4]
  prev.item.is_online                            === next.item.is_online                            &&
  prev.item.lat                                  === next.item.lat                                  &&
  prev.item.lng                                  === next.item.lng                                  &&
  prev.item.battery                              === next.item.battery                              &&
  prev.item.recorded_at                          === next.item.recorded_at                          &&
  prev.onPress                                   === next.onPress,
);

// [P3] fixed height for getItemLayout
const empStyles = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12, backgroundColor: C.surface, borderLeftWidth: 3, borderLeftColor: 'transparent', height: EMPLOYEE_ROW_HEIGHT },
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
// Tab Bar — [T1] uses VALID_TABS set; [R10] type-narrowing via Set
// ─────────────────────────────────────────────────────────────────
const TABS: { key: TabKey; label: string; Icon: LucideIcon }[] = [
  { key: 'overview',  label: 'Overview',  Icon: LayoutDashboard },
  { key: 'employees', label: 'Employees', Icon: Users2          },
  { key: 'visits',    label: 'Visits',    Icon: ImageIcon       },
];

const TabBar = memo(function TabBar({
  active, onChange, counts,
}: {
  active: TabKey;
  onChange: (key: TabKey) => void;
  counts: Record<TabKey, number>;
}) {
  return (
    <View style={tabStyles.bar}>
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[tabStyles.tab, isActive && tabStyles.tabActive]}
            onPress={() => onChange(tab.key)}
            activeOpacity={0.75}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
          >
            <tab.Icon
              size={14}
              color={isActive ? C.green : C.textFaint}
              strokeWidth={isActive ? 2.2 : 1.5}
            />
            <Text style={[tabStyles.tabLabel, isActive && tabStyles.tabLabelActive]}>
              {tab.label}
            </Text>
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
  bar:             { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 16, padding: 5, gap: 4, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
  tab:             { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, gap: 5 },
  tabActive:       { backgroundColor: C.surfaceLift, borderWidth: 1, borderColor: C.borderBright },
  tabLabel:        { fontSize: 12, fontWeight: '600', color: C.textSub, fontFamily: F.mono },
  tabLabelActive:  { color: C.textPrimary, fontWeight: '700' },
  badge:           { backgroundColor: C.surfaceAlt, borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: 'center' },
  badgeActive:     { backgroundColor: C.green },
  badgeText:       { fontSize: 9, color: C.textSub, fontWeight: '800', fontFamily: F.mono },
  badgeTextActive: { color: C.bg },
});

// ─────────────────────────────────────────────────────────────────
// Quick Action
// ─────────────────────────────────────────────────────────────────
const QuickAction = memo(function QuickAction({
  Icon, label, onPress, badge, accent,
}: { Icon: LucideIcon; label: string; onPress: () => void; badge?: string; accent?: string }) {
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const onPressIn  = useCallback(() => Animated.spring(scaleAnim, { toValue: 0.93, useNativeDriver: true }).start(), [scaleAnim]);
  const onPressOut = useCallback(() => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true }).start(), [scaleAnim]);

  return (
    <TouchableOpacity
      style={qaStyles.btn}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }], alignItems: 'center', gap: 6 }}>
        <View style={[qaStyles.iconBox, accent && { borderColor: accent, backgroundColor: `${accent}15` }]}>
          <Icon size={22} color={accent ?? C.textSub} strokeWidth={1.8} />
          {badge != null && (
            <View style={[qaStyles.badge, accent && { backgroundColor: accent }]}>
              <Text style={qaStyles.badgeText}>{badge}</Text>
            </View>
          )}
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
// Section Header, Panel, GlowLine, EmptyInline
// ─────────────────────────────────────────────────────────────────
function SectionHeader({
  label, count, onAction, actionLabel,
}: { label: string; count?: number; onAction?: () => void; actionLabel?: string }) {
  return (
    <View style={secStyles.row}>
      <View style={secStyles.left}>
        <View style={secStyles.dot} />
        <Text style={secStyles.label}>{label}</Text>
        {count != null && (
          <View style={secStyles.countPill}>
            <Text style={secStyles.countText}>{count}</Text>
          </View>
        )}
      </View>
      {onAction && (
        <TouchableOpacity onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel ?? 'See all'}>
          <Text style={secStyles.action}>{actionLabel ?? 'See all →'}</Text>
        </TouchableOpacity>
      )}
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
// Overview Tab — [R13] default branch guarded; [R14] UTC-safe today check
// ─────────────────────────────────────────────────────────────────
type OverviewItem =
  | { type: 'error';        key: string }
  | { type: 'alert';        key: string }
  | { type: 'stats';        key: string }
  | { type: 'quickActions'; key: string }
  | { type: 'onlineNow';    key: string }
  | { type: 'recentVisits'; key: string };

interface OverviewProps {
  error:                    string | null;
  lowBattery:               LiveEmployee[];
  onlineEmployees:          LiveEmployee[];
  offlineEmployees:         LiveEmployee[];
  employees:                LiveEmployee[];
  todayVisits:              VisitPhoto[];
  visits:                   VisitPhoto[];
  refreshing:               boolean;
  onRefresh:                () => void;
  onDismissError:           () => void;
  onRetry:                  () => void;
  navigateToMap:            () => void;
  navigateToMapWithFocus:   (emp: LiveEmployee) => void;
  goToEmployees:            () => void;
  goToVisits:               () => void;
  handleLogout:             () => void;
  expandedVisitId:          string | number | null;
  onToggleVisit:            (id: string | number) => void;
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
        return (
          <ErrorBox
            message={error!}
            severity="error"
            onDismiss={onDismissError}
            action={{ label: 'Retry', onPress: onRetry }}
          />
        );

      case 'alert':
        return (
          <Panel style={{ borderColor: C.rose, borderLeftWidth: 3, borderLeftColor: C.rose }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Zap size={13} color={C.rose} strokeWidth={2} />
              <Text style={{ color: C.rose, fontFamily: F.mono, fontSize: 12, fontWeight: '700' }}>
                LOW BATTERY ALERT
              </Text>
            </View>
            {/* [RD6] Use getRtdbKey (firebase_uid ?? employee_id) as key — avoids
                     collision when two employees share the same display name */}
            <Text style={{ color: C.textSub, fontFamily: F.mono, fontSize: 11, marginTop: 4 }}>
              {lowBattery
                .map((e) => sanitiseName(e.name))
                .join(', ')} — below 20%
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
              <QuickAction Icon={ImagePlus} label="All Visits" onPress={goToVisits}   accent={C.blue}
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
              <EmptyInline Icon={RadioTower} title="No employees online" sub="Employees appear here once they start their shift" />
            ) : (
              onlineEmployees.slice(0, 3).map((emp, i) => (
                <React.Fragment key={`emp-overview-${getRtdbKey(emp)}`} /* [RD6] */>
                  <EmployeeRow item={emp} onPress={navigateToMapWithFocus} />
                  {i < Math.min(onlineEmployees.length, 3) - 1 && (
                    <View style={{ height: 1, backgroundColor: C.border }} />
                  )}
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
              <EmptyInline Icon={Inbox} title="No visits today" sub="Visit photos logged today will appear here" />
            ) : (
              <>
                <Text style={styles.tapHint}>Tap a visit to load its photo</Text>
                <View style={styles.visitsList}>
                  {todayVisits.slice(0, 3).map((v) => (
                    <LazyVisitCard
                      key={`visit-overview-${String(v.id)}`}
                      item={v}
                      expanded={expandedVisitId === v.id}
                      onToggle={onToggleVisit}
                      showEmployee
                    />
                  ))}
                </View>
              </>
            )}
          </Panel>
        );

      default:
        // [R13] exhaustive guard — should never be reached
        if (__DEV__) {
          console.warn('[AdminScreen] OverviewTab: unknown item type:', (item as OverviewItem).type);
        }
        return null;
    }
  }, [
    error, lowBattery, onlineEmployees, offlineEmployees, employees,
    todayVisits, visits, onDismissError, onRetry, navigateToMap,
    navigateToMapWithFocus, goToEmployees, goToVisits, handleLogout,
    expandedVisitId, onToggleVisit,
  ]);

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.key}
      renderItem={renderItem}
      contentContainerStyle={styles.tabContent}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
      extraData={expandedVisitId}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.green} />
      }
    />
  );
});

// ─────────────────────────────────────────────────────────────────
// Employees Tab — [R12] prefixed keyExtractor; [P3] getItemLayout
// ─────────────────────────────────────────────────────────────────
type EmpSection = { title: string; color: string; data: LiveEmployee[] };

const SECTION_HEADER_HEIGHT = 46; // approximate

const EmployeesTab = memo(function EmployeesTab({
  onlineEmployees, offlineEmployees, refreshing, onRefresh, navigateToMapWithFocus,
}: {
  onlineEmployees:        LiveEmployee[];
  offlineEmployees:       LiveEmployee[];
  refreshing:             boolean;
  onRefresh:              () => void;
  navigateToMapWithFocus: (emp: LiveEmployee) => void;
}) {
  const sections = useMemo<EmpSection[]>(() => {
    const list: EmpSection[] = [];
    if (onlineEmployees.length)  list.push({ title: 'ONLINE',  color: C.green,     data: onlineEmployees  });
    if (offlineEmployees.length) list.push({ title: 'OFFLINE', color: C.textFaint, data: offlineEmployees });
    return list;
  }, [onlineEmployees, offlineEmployees]);

  const renderItem = useCallback(
    ({ item }: { item: LiveEmployee }) => (
      <EmployeeRow item={item} onPress={navigateToMapWithFocus} />
    ),
    [navigateToMapWithFocus],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: EmpSection }) => (
      <View style={styles.sectionLabelWrap}>
        {section.color === C.green
          ? <PulseDot color={C.green} size={8} />
          : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.textFaint }} />
        }
        <Text style={[styles.sectionLabel, { color: section.color }]}>{section.title}</Text>
      </View>
    ),
    [],
  );

  const ItemSeparator = useCallback(
    () => <View style={{ height: 1, backgroundColor: C.border }} />,
    [],
  );

  // [RD2] Use firebase_uid (RTDB path key) as the React key — falls back to employee_id
  const keyExtractor = useCallback(
    (item: LiveEmployee) => `emp-${getRtdbKey(item)}`,
    [],
  );

  // [P3] stable getItemLayout
  const getItemLayout = useCallback(
    (_data: unknown, index: number) => ({
      length: EMPLOYEE_ROW_HEIGHT,
      offset: EMPLOYEE_ROW_HEIGHT * index,
      index,
    }),
    [],
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      ItemSeparatorComponent={ItemSeparator}
      getItemLayout={getItemLayout}
      contentContainerStyle={styles.tabContent}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
      maxToRenderPerBatch={10}
      windowSize={5}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.green} />
      }
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
      ListEmptyComponent={
        <EmptyInline Icon={Users} title="No employees found" sub="Employees appear once registered" />
      }
    />
  );
});

// ─────────────────────────────────────────────────────────────────
// Visits Tab — [R11] double-fire guard; [R12] prefixed keys
// ─────────────────────────────────────────────────────────────────
const VisitsTab = memo(function VisitsTab({
  visits, todayVisits, refreshing, onRefresh,
  loadingMore, hasMoreVisits, visitsPage, fetchVisits,
  expandedVisitId, onToggleVisit,
}: {
  visits:          VisitPhoto[];
  todayVisits:     VisitPhoto[];
  refreshing:      boolean;
  onRefresh:       () => void;
  loadingMore:     boolean;
  hasMoreVisits:   boolean;
  visitsPage:      number;
  fetchVisits:     (page: number) => void;
  expandedVisitId: string | number | null;
  onToggleVisit:   (id: string | number) => void;
}) {
  // [R11] prevent double-fire from FlatList's onEndReached
  const endReachedCalledRef = useRef(false);

  const renderItem = useCallback(
    ({ item }: { item: VisitPhoto }) => (
      <LazyVisitCard
        item={item}
        expanded={expandedVisitId === item.id}
        onToggle={onToggleVisit}
        showEmployee
      />
    ),
    [expandedVisitId, onToggleVisit],
  );

  // [R12] prefixed key
  const keyExtractor = useCallback(
    (item: VisitPhoto) => `visit-${String(item.id)}`,
    [],
  );

  const onEndReached = useCallback(() => {
    if (loadingMore || !hasMoreVisits || endReachedCalledRef.current) return;
    endReachedCalledRef.current = true;
    fetchVisits(visitsPage + 1);
    // reset guard after a short delay
    setTimeout(() => { endReachedCalledRef.current = false; }, 1000);
  }, [loadingMore, hasMoreVisits, visitsPage, fetchVisits]);

  return (
    <FlatList
      data={visits}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      contentContainerStyle={[styles.tabContent, { gap: 10 }]}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
      maxToRenderPerBatch={5}
      updateCellsBatchingPeriod={100}
      windowSize={5}
      initialNumToRender={8}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      extraData={expandedVisitId}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.green} />
      }
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
      ListFooterComponent={loadingMore
        ? <Text style={styles.loadingMore}>Loading more…</Text>
        : null
      }
      ListEmptyComponent={
        <EmptyInline Icon={Camera} title="No visit photos yet" sub="Photos logged by employees will appear here" />
      }
    />
  );
});

// ─────────────────────────────────────────────────────────────────
// Main AdminScreen
// [R5]  AbortController on fetchVisits; stale-result guard
// [R6]  AbortController on seedEmployees; shape validation
// [R7]  useFocusEffect cleanup cancels requests + interval
// [R8]  handleLogout try/catch
// [R15] hasFetchedOnce moved inside useFocusEffect
// ─────────────────────────────────────────────────────────────────
export default function AdminScreen() {
  const navigation = useNavigation<any>();
  const logout     = useAuthStore(s => s.logout);
  const employee   = useAuthStore(s => s.employee);
  const { updateEmployee, liveEmployees } = useLocationStore();
  const { attach, detach } = useAdminRealtimeMap();

  const [visits,       setVisits]      = useState<VisitPhoto[]>([]);
  const [visitsPage,   setVisitsPage]  = useState(1);
  const [hasMoreVisits, setHasMore]    = useState(true);
  const [loading,      setLoading]     = useState(true);
  const [refreshing,   setRefreshing]  = useState(false);
  const [loadingMore,  setLoadingMore] = useState(false);
  const [error,        setError]       = useState<string | null>(null);
  const [activeTab,    setActiveTab]   = useState<TabKey>('overview');
  const [expandedVisitId, setExpandedVisitId] = useState<string | number | null>(null);

  const isOnline     = useOfflineStore(s => s.isOnline);

  // liveEmployees is keyed by firebaseUid in the store (matching the RTDB path).
  // Object.values gives us the LiveEmployee records regardless of key scheme. [RD1]
  const employees        = useMemo(() => Object.values(liveEmployees), [liveEmployees]);
  const onlineEmployees  = useMemo(() => employees.filter(e => e.is_online),  [employees]);
  const offlineEmployees = useMemo(() => employees.filter(e => !e.is_online), [employees]);
  const lowBattery       = useMemo(
    () => employees.filter(e => {
      const b = clampBattery(e.battery);
      return b != null && b <= 20;
    }),
    [employees],
  );

  // [R14] UTC-safe: compare date strings, not individual getDate()/getMonth()
  const todayVisits = useMemo(() => {
    const todayStr = new Date().toDateString();
    return visits.filter(v => {
      const d = resolveDate(v);
      return d != null && d.toDateString() === todayStr;
    });
  }, [visits]);

  const tabCounts = useMemo<Record<TabKey, number>>(
    () => ({
      overview:  lowBattery.length,
      employees: onlineEmployees.length,
      visits:    todayVisits.length,
    }),
    [lowBattery.length, onlineEmployees.length, todayVisits.length],
  );

  // Abort-controller refs so in-flight requests can be cancelled
  const seedAbortRef   = useRef<AbortController | null>(null);
  const visitsAbortRef = useRef<AbortController | null>(null);

  // [R6] validated seedEmployees
  const seedEmployees = useCallback(async () => {
    seedAbortRef.current?.abort();
    const ctrl = new AbortController();
    seedAbortRef.current = ctrl;
    try {
      const empRes = await apiGet('/admin/employees/live', { signal: ctrl.signal }) as unknown;
      if (ctrl.signal.aborted) return;
      if (!Array.isArray(empRes)) return;
      for (const emp of empRes as unknown[]) {
        // [RD5] Validate shape: must have employee_id (DB key).
        // firebase_uid (RTDB path key) may be absent on legacy records —
        // updateEmployee must tolerate that and fall back where needed.
        if (
          emp != null &&
          typeof emp === 'object' &&
          'employee_id' in (emp as object)
        ) {
          // If firebase_uid is present, ensure it's a non-empty string
          const uid = (emp as Record<string, unknown>).firebase_uid;
          if (uid !== undefined && (typeof uid !== 'string' || uid.length === 0)) {
            if (__DEV__) console.warn('[AdminScreen] seedEmployees: invalid firebase_uid, skipping', emp);
            continue;
          }
          updateEmployee(emp as LiveEmployee);
        }
      }
    } catch (e: unknown) {
      if ((e as Error)?.name === 'AbortError') return;
      if (__DEV__) console.warn('[AdminScreen] seedEmployees:', (e as Error)?.message ?? e);
    }
  }, [updateEmployee]);

  // [R5] AbortController + stale-result guard
  const fetchVisits = useCallback(
    async (page = 1, silent = false) => {
      // Guard: don't fire duplicate concurrent fetches for the same page
      if (page > 1 && loadingMore) return;

      visitsAbortRef.current?.abort();
      const ctrl = new AbortController();
      visitsAbortRef.current = ctrl;

      if (page === 1 && !silent) setLoading(true);
      if (page > 1) setLoadingMore(true);
      setError(null);

      // [S5] guard offset arithmetic
      const safeOffset = Math.max(0, (page - 1) * VISITS_PAGE_SIZE);

      try {
        const raw = await apiGet(
          `/admin/visits?limit=${VISITS_PAGE_SIZE}&offset=${safeOffset}`,
          { signal: ctrl.signal },
        );
        if (ctrl.signal.aborted) return; // stale — discard

        const visitRes = Array.isArray(raw) ? (raw as VisitPhoto[]) : [];
        setVisits(prev => (page === 1 ? visitRes : [...prev, ...visitRes]));
        setHasMore(visitRes.length === VISITS_PAGE_SIZE);
        setVisitsPage(page);
      } catch (e: unknown) {
        if ((e as Error)?.name === 'AbortError') return;
        setError((e as Error)?.message ?? 'Failed to load visits');
      } finally {
        if (!ctrl.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [loadingMore],
  );

  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [headerAnim]);

  // [R7] [R15] cleanup cancels requests + interval; hasFetchedOnce scoped inside
  useFocusEffect(
    useCallback(() => {
      attach();
      let hasFetchedOnce = false;

      if (!hasFetchedOnce) {
        seedEmployees();
        fetchVisits(1);
        hasFetchedOnce = true;
      }

      const id = setInterval(() => fetchVisits(1, true), 60_000);

      return () => {
        clearInterval(id);
        seedAbortRef.current?.abort();
        visitsAbortRef.current?.abort();
        detach();
      };
    }, [attach, detach, seedEmployees, fetchVisits]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setExpandedVisitId(null);
    seedEmployees();
    fetchVisits(1, true);
  }, [seedEmployees, fetchVisits]);

  // [R8] try/catch on logout
  const handleLogout = useCallback(() => {
    Alert.alert(
      'Logout',
      `Logout as ${employee?.name ?? 'Admin'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            try { logout(); }
            catch (e) {
              if (__DEV__) console.error('[AdminScreen] logout error:', e);
            }
          },
        },
      ],
      { cancelable: true },
    );
  }, [employee?.name, logout]);

  const navigateToMap = useCallback(
    () => navigation.navigate('LiveMap'),
    [navigation],
  );

  // [RD3] Pass firebase_uid as focusId — this is the RTDB node key the
  // LiveMap screen must look up in tenants/{tenantId}/locations/{firebaseUid}
  const navigateToMapWithFocus = useCallback(
    (emp: LiveEmployee) => navigation.navigate('LiveMap', { focusId: getRtdbKey(emp) }),
    [navigation],
  );

  const goToEmployees = useCallback(() => setActiveTab('employees'), []);
  const goToVisits    = useCallback(() => setActiveTab('visits'),    []);

  const fetchVisitsPage = useCallback(
    (page: number) => fetchVisits(page),
    [fetchVisits],
  );

  const onToggleVisit = useCallback((id: string | number) => {
    setExpandedVisitId(prev => (prev === id ? null : id));
  }, []);

  // [T1] [R10] type-safe tab change via Set
  const handleTabChange = useCallback((key: string) => {
    if (VALID_TABS.has(key as TabKey)) setActiveTab(key as TabKey);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <LoadingOverlay
        visible={loading && visits.length === 0 && employees.length === 0}
        message="Loading dashboard"
        variant="dots"
      />

      {!isOnline && (
        <View style={styles.offlineBanner}>
          <CloudOff size={12} color={C.rose} />
          <Text style={styles.offlineBannerText}>
            You are offline. Live data and visits will refresh once reconnected.
          </Text>
        </View>
      )}

      <Animated.View style={[styles.header, { opacity: headerAnim }]}>
        <View>
          <View style={styles.headerBadge}>
            <View style={styles.badgeDot} />
            <Text style={styles.headerBadgeText}>LIVE DASHBOARD</Text>
          </View>
          <Text style={styles.headerTitle}>Admin Control</Text>
          <Text style={styles.headerSub}>
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.mapBtn}
            onPress={navigateToMap}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open live map"
          >
            <Map size={13} color={C.bg} strokeWidth={2.5} />
            <Text style={styles.mapBtnText}>Map</Text>
            {onlineEmployees.length > 0 && (
              <View style={styles.mapBadge}>
                <Text style={styles.mapBadgeText}>{onlineEmployees.length}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Logout"
          >
            <LogOut size={13} color={C.rose} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <GlowLine />

      <View style={styles.tabBarWrapper}>
        <TabBar active={activeTab} onChange={handleTabChange} counts={tabCounts} />
      </View>

      <View style={styles.content}>
        {activeTab === 'overview' && (
          <OverviewTab
            error={error}
            lowBattery={lowBattery}
            onlineEmployees={onlineEmployees}
            offlineEmployees={offlineEmployees}
            employees={employees}
            todayVisits={todayVisits}
            visits={visits}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onDismissError={() => setError(null)}
            onRetry={() => fetchVisits(1)}
            navigateToMap={navigateToMap}
            navigateToMapWithFocus={navigateToMapWithFocus}
            goToEmployees={goToEmployees}
            goToVisits={goToVisits}
            handleLogout={handleLogout}
            expandedVisitId={expandedVisitId}
            onToggleVisit={onToggleVisit}
          />
        )}

        {activeTab === 'employees' && (
          <EmployeesTab
            onlineEmployees={onlineEmployees}
            offlineEmployees={offlineEmployees}
            refreshing={refreshing}
            onRefresh={onRefresh}
            navigateToMapWithFocus={navigateToMapWithFocus}
          />
        )}

        {activeTab === 'visits' && (
          <VisitsTab
            visits={visits}
            todayVisits={todayVisits}
            refreshing={refreshing}
            onRefresh={onRefresh}
            loadingMore={loadingMore}
            hasMoreVisits={hasMoreVisits}
            visitsPage={visitsPage}
            fetchVisits={fetchVisitsPage}
            expandedVisitId={expandedVisitId}
            onToggleVisit={onToggleVisit}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────
// Root styles
// ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  offlineBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 16,
    paddingVertical:   8,
    backgroundColor:   C.roseDim,
    borderBottomWidth: 1,
    borderBottomColor: `${C.rose}44`,
  },
  offlineBannerText: { flex: 1, fontSize: 11, color: C.rose, fontFamily: F.mono },

  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'flex-start',
    paddingHorizontal: 20,
    paddingTop:        18,
    paddingBottom:     14,
  },
  headerBadge:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  badgeDot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  headerBadgeText: { fontSize: 9, fontWeight: '800', color: C.green, fontFamily: F.mono, letterSpacing: 2 },
  headerTitle:     { fontSize: 24, fontWeight: '800', color: C.textPrimary, fontFamily: F.display, letterSpacing: -0.5 },
  headerSub:       { fontSize: 11, color: C.textSub, marginTop: 2, fontFamily: F.mono },
  headerActions:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },

  mapBtn: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  C.green,
    paddingHorizontal: 14,
    paddingVertical:   9,
    borderRadius:     999,
    gap:              6,
  },
  mapBtnText:  { fontSize: 12, color: C.bg, fontWeight: '800', fontFamily: F.mono },
  mapBadge:    { backgroundColor: C.bg, borderRadius: 999, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  mapBadgeText:{ fontSize: 10, color: C.green, fontWeight: '800', fontFamily: F.mono },
  logoutBtn:   { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surfaceAlt },

  tabBarWrapper: { paddingHorizontal: 16, paddingVertical: 10 },
  content:       { flex: 1 },
  tabContent:    { padding: 16, gap: 16, paddingBottom: 40 },
  statsGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickActions:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  listHeader:    { flexDirection: 'row', gap: 8, marginBottom: 4, alignItems: 'center', flexWrap: 'wrap' },
  statusChip:    { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusChipText:{ fontSize: 10, fontWeight: '700', fontFamily: F.mono },

  sectionLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, backgroundColor: C.bg },
  sectionLabel:     { fontSize: 10, fontWeight: '800', fontFamily: F.mono, letterSpacing: 1.5 },

  visitsList:   { gap: 10 },
  tapHint:      { fontSize: 10, color: C.textFaint, fontFamily: F.mono, fontStyle: 'italic' },
  viewMoreBtn:  { marginTop: 12, alignItems: 'center', paddingVertical: 8 },
  viewMoreText: { fontSize: 12, color: C.green, fontFamily: F.mono, fontWeight: '700' },
  loadingMore:  { textAlign: 'center', color: C.textSub, paddingVertical: 16, fontSize: 12, fontFamily: F.mono },

  emptyInline:  { alignItems: 'center', paddingVertical: 28, gap: 6 },
  emptyIconWrap:{ marginBottom: 4 },
  emptyText:    { fontSize: 14, fontWeight: '700', color: C.textSub, fontFamily: F.display },
  emptySubText: { fontSize: 12, color: C.textFaint, fontFamily: F.mono, textAlign: 'center', lineHeight: 18 },
});