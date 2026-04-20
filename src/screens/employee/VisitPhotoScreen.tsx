// src/screens/employee/VisitPhotoScreen.tsx
import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform,
  RefreshControl, Text, View, ActivityIndicator, TouchableOpacity,
  Animated, TextInput,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureAndUploadVisitPhoto, VisitRecord } from '../../services/photoService';
import { offlineGet } from '../../services/useOfflineApi';
import { useAuthStore } from '../../store/authStore';
import { useOfflineStore } from '../../store/offlineStore';
import { VisitPhoto } from '../../types';
import { MC, MF } from '../../navigation/AppTheme';
import {
  Camera, Image as ImageIcon, FileText, Inbox, Upload,
  CheckCircle2, AlertCircle, History, Hash, WifiOff, CloudOff,
  Clock,
} from 'lucide-react-native';

// ─────────────────────────────────────────────────────────────────
// Inline sub-components
// ─────────────────────────────────────────────────────────────────

function CaptionInput({
  value, onChangeText, editable,
}: { value: string; onChangeText: (t: string) => void; editable: boolean }) {
  return (
    <View style={sub.captionWrap}>
      <View style={sub.captionIcon}>
        <FileText size={13} color={MC.textSub} />
      </View>
      <TextInput
        style={sub.captionInput}
        placeholder="Add a caption… (optional)"
        placeholderTextColor={MC.textFaint}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        multiline
        maxLength={200}
      />
    </View>
  );
}

function PhotoPreview({ uri, synced }: { uri: string; synced: boolean }) {
  const fade = React.useRef(new Animated.Value(0)).current;
  return (
    <View style={[sub.previewWrap, !synced && sub.previewUnsynced]}>
      <View style={sub.previewHeader}>
        {synced ? (
          <>
            <CheckCircle2 size={12} color={MC.green} />
            <Text style={sub.previewLabel}>Photo captured</Text>
          </>
        ) : (
          <>
            <WifiOff size={12} color={MC.rose} />
            <Text style={[sub.previewLabel, { color: MC.rose }]}>
              Offline — will sync when online
            </Text>
          </>
        )}
      </View>
      <Animated.Image
        source={{ uri }}
        style={[sub.previewImg, { opacity: fade }]}
        resizeMode="cover"
        onLoad={() =>
          Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start()
        }
      />
    </View>
  );
}

function UploadProgress({ step }: { step: string }) {
  const pulse = React.useRef(new Animated.Value(0.5)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={sub.progressWrap}>
      <Animated.View style={{ opacity: pulse }}>
        <Upload size={14} color={MC.gold} />
      </Animated.View>
      <Text style={sub.progressText}>{step}</Text>
    </View>
  );
}

function CaptureButton({ loading, onPress }: { loading: boolean; onPress: () => void }) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.95, friction: 4, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    onPress();
  };
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[sub.captureBtn, loading && sub.captureBtnDisabled]}
        onPress={press}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading
          ? <ActivityIndicator size="small" color={MC.bg} />
          : <Camera size={18} color={MC.bg} />}
        <Text style={sub.captureBtnText}>
          {loading ? 'Processing…' : 'Capture Visit Photo'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const sub = StyleSheet.create({
  captionWrap: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: MC.surface, borderRadius: 12,
    borderWidth: 1, borderColor: MC.border, padding: 12,
  },
  captionIcon: { paddingTop: 2 },
  captionInput: {
    flex: 1, fontSize: 13, color: MC.textPrimary,
    fontFamily: MF.mono, minHeight: 48, lineHeight: 20,
  },
  previewWrap: {
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: `${MC.green}44`,
  },
  previewUnsynced: {
    borderColor: `${MC.rose}66`,
  },
  previewHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${MC.green}14`, paddingHorizontal: 12, paddingVertical: 8,
  },
  previewLabel: { fontSize: 11, color: MC.green, fontFamily: MF.mono },
  previewImg: { width: '100%', height: 180 },
  progressWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: MC.goldDim, borderRadius: 10,
    borderWidth: 1, borderColor: `${MC.gold}44`, padding: 12,
  },
  progressText: { fontSize: 12, color: MC.gold, fontFamily: MF.mono },
  captureBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: MC.green, borderRadius: 14,
    paddingVertical: 15, paddingHorizontal: 24,
    shadowColor: MC.green, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
  },
  captureBtnDisabled: { opacity: 0.55 },
  captureBtnText: {
    fontSize: 14, fontWeight: '800', color: MC.bg,
    fontFamily: MF.mono, letterSpacing: 0.3,
  },
});

// CoordPin
function CoordPin({ color = MC.blue }: { color?: string }) {
  return (
    <Svg width={10} height={14} viewBox="0 0 10 14">
      <Path
        d="M5 0C2.24 0 0 2.24 0 5c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5z"
        fill={color}
        opacity={0.9}
      />
      <Circle cx={5} cy={5} r={2} fill={MC.bg} />
    </Svg>
  );
}

// LazyVisitCard
const LazyVisitCard = memo(function LazyVisitCard({
  item, expanded, onToggle,
}: {
  item: VisitPhoto;
  expanded: boolean;
  onToggle: (id: string | number) => void;
}) {
  const [imgLoading, setImgLoading] = useState(true);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const rotAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(rotAnim, {
      toValue: expanded ? 1 : 0, duration: 200, useNativeDriver: true,
    }).start();
  }, [expanded]);

  const onImageLoad = () => {
    setImgLoading(false);
    Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  };

  useEffect(() => {
    if (!expanded) { fadeAnim.setValue(0); setImgLoading(true); }
  }, [expanded]);

  const dateStr = (() => {
    if (!item.uploaded_at) return '—';
    return new Date(item.uploaded_at).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  })();

  const hasCoords = item.lat != null && item.lng != null;

  const chevronRotation = rotAnim.interpolate({
    inputRange: [0, 1], outputRange: ['0deg', '90deg'],
  });

  const isLocal = String(item.id).startsWith('local');

  return (
    <View style={[card.wrap, isLocal && card.wrapLocal]}>
      <TouchableOpacity
        style={card.header}
        onPress={() => onToggle(item.id)}
        activeOpacity={0.72}
      >
        <View style={[card.accent, expanded && card.accentOn, isLocal && card.accentLocal]} />

        <View style={[card.thumb, expanded && card.thumbOn]}>
          <ImageIcon size={16} color={expanded ? MC.green : MC.textFaint} />
        </View>

        <View style={card.info}>
          <View style={card.titleRow}>
            {item.caption
              ? <Text style={card.caption} numberOfLines={expanded ? undefined : 1}>{item.caption}</Text>
              : <Text style={card.captionEmpty}>No caption</Text>}
            {isLocal && (
              <View style={card.unsyncedPill}>
                <CloudOff size={9} color={MC.rose} />
                <Text style={card.unsyncedText}>Not synced</Text>
              </View>
            )}
          </View>

          <View style={card.meta}>
            <Clock size={9} color={MC.textFaint} />
            <Text style={card.metaText}>{dateStr}</Text>
          </View>

          {hasCoords && (
            <View style={card.meta}>
              <CoordPin />
              <Text style={card.metaText} numberOfLines={1}>
                {item.lat!.toFixed(5)}, {item.lng!.toFixed(5)}
              </Text>
            </View>
          )}
        </View>

        <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
          <ImageIcon size={16} color={expanded ? MC.green : MC.textSub} />
        </Animated.View>
      </TouchableOpacity>

      {expanded && (
        <View style={card.imageSection}>
          <View style={card.divider} />
          <View style={card.imageWrap}>
            {imgLoading && (
              <View style={card.imgPlaceholder}>
                <ActivityIndicator size="small" color={MC.green} />
                <Text style={card.imgPlaceholderText}>Loading photo…</Text>
              </View>
            )}
            <Animated.Image
              source={{ uri: item.photo_url }}
              style={[card.image, { opacity: fadeAnim }]}
              resizeMode="cover"
              onLoad={onImageLoad}
              onError={() => setImgLoading(false)}
            />
          </View>
        </View>
      )}
    </View>
  );
});

const card = StyleSheet.create({
  wrap: {
    backgroundColor: MC.surface, borderRadius: 14,
    overflow: 'hidden', borderWidth: 1, borderColor: MC.border, marginBottom: 10,
  },
  wrapLocal: {
    borderColor: `${MC.rose}55`,
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  accent: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: MC.textFaint },
  accentOn: { backgroundColor: MC.green },
  accentLocal: { backgroundColor: MC.rose },
  thumb: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: MC.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: MC.border,
  },
  thumbOn: { borderColor: `${MC.green}55`, backgroundColor: `${MC.green}10` },
  info: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  caption: { fontSize: 13, fontWeight: '700', color: MC.textPrimary, fontFamily: MF.display },
  captionEmpty: { fontSize: 12, fontStyle: 'italic', color: MC.textFaint, fontFamily: MF.mono },
  unsyncedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 999, backgroundColor: `${MC.rose}15`,
  },
  unsyncedText: { fontSize: 9, color: MC.rose, fontFamily: MF.mono },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 10, color: MC.textSub, fontFamily: MF.mono },
  imageSection: { paddingHorizontal: 14, paddingBottom: 14 },
  divider: { height: 1, backgroundColor: MC.border, marginBottom: 12 },
  imageWrap: {
    borderRadius: 10, overflow: 'hidden', minHeight: 200,
    backgroundColor: MC.surfaceAlt, justifyContent: 'center', alignItems: 'center',
  },
  imgPlaceholder: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', gap: 8, zIndex: 1,
  },
  imgPlaceholderText: { fontSize: 11, color: MC.textSub, fontFamily: MF.mono },
  image: { width: '100%', height: 220 },
});

// ─────────────────────────────────────────────────────────────────
// VisitPhotoScreen
// ─────────────────────────────────────────────────────────────────
export default function VisitPhotoScreen() {
  const employee = useAuthStore(s => s.employee);
  const isOnline = useOfflineStore(s => s.isOnline);

  const [caption, setCaption] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadStep, setUploadStep] = useState<string | null>(null);
  const [visits, setVisits] = useState<VisitPhoto[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | number | null>(null);

  const loadVisits = async () => {
    if (!employee?.id) return;
    try {
      const { data } = await offlineGet<VisitPhoto[]>(`/visits/${employee.id}`, 5 * 60_000);
      setVisits(data);
    } catch (e) {
      console.error('VisitPhotoScreen load error:', e);
    } finally {
      setLoadingVisits(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoadingVisits(true);
    loadVisits();
  }, [employee?.id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setExpandedId(null);
    loadVisits();
  }, [employee?.id]);

  const handleToggle = useCallback((id: string | number) => {
    setExpandedId(prev => (prev === id ? null : id));
  }, []);

  if (loadingVisits && visits.length === 0) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={MC.green} />
      </View>
    );
  }

  const handleCapture = async () => {
    setLoading(true);
    setPhotoUrl(null);
    setLastSynced(null);
    const captionAtCapture = caption;

    try {
      const visit: VisitRecord | null = await captureAndUploadVisitPhoto(
        captionAtCapture,
        step => setUploadStep(step),
      );
      if (!visit) {
        setUploadStep(null);
        return;
      }

      setPhotoUrl(visit.photo_url);
      setLastSynced(visit.synced);
      setCaption('');
      setUploadStep(null);

      const newVisit: VisitPhoto = {
        id: visit.visit_id,
        employee_id: visit.employee_id,
        photo_url: visit.photo_url,
        caption: visit.caption,
        lat: visit.lat,
        lng: visit.lng,
        uploaded_at: visit.visited_at,
      };
      setVisits(prev => [newVisit, ...prev]);
      setExpandedId(visit.visit_id);

      if (visit.synced) {
        Alert.alert('Visit Logged', 'Your visit photo has been saved successfully.');
      } else {
        Alert.alert(
          'Visit Saved Offline',
          'You are offline. This visit will sync automatically when your connection returns.',
        );
      }
    } catch (e: any) {
      setUploadStep(null);
      const message =
        e.message?.includes('permission')
          ? 'Camera or location permission was denied. Please enable it in Settings.'
          : e.message?.includes('Firebase') || e.message?.includes('upload')
          ? 'Photo upload failed. Check your internet connection.'
          : e.message ?? 'Something went wrong. Please try again.';
      Alert.alert('Upload Failed', message, [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.keyboardView} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={s.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.container}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={MC.green}
              colors={[MC.green]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={s.headerBlock}>
            <View style={s.kickerRow}>
              <Camera size={10} color={MC.textFaint} />
              <Text style={s.kicker}>VISIT LOG</Text>
            </View>
            <Text style={s.title}>Log Visit</Text>
            <Text style={s.subtitle}>
              Capture a photo to record your visit with GPS location.
            </Text>
            {!isOnline && (
              <View style={s.offlineRow}>
                <CloudOff size={12} color={MC.rose} />
                <Text style={s.offlineText}>
                  You are offline. New visits will be saved locally and synced later.
                </Text>
              </View>
            )}
          </View>

          <CaptionInput value={caption} onChangeText={setCaption} editable={!loading} />
          {photoUrl && <PhotoPreview uri={photoUrl} synced={lastSynced ?? true} />}
          {uploadStep && <UploadProgress step={uploadStep} />}
          <CaptureButton loading={loading} onPress={handleCapture} />

          {visits.length > 0 && (
            <View style={s.historySection}>
              <View style={s.historyHeader}>
                <View style={s.historyTitleRow}>
                  <History size={13} color={MC.green} />
                  <Text style={s.historyTitle}>Visit History</Text>
                </View>
                <View style={s.historyCountPill}>
                  <Hash size={9} color={MC.textFaint} />
                  <Text style={s.historyCount}>{visits.length}</Text>
                </View>
              </View>
              <Text style={s.historyHint}>Tap a row to load its photo</Text>

              {visits.map(v => (
                <LazyVisitCard
                  key={String(v.id)}
                  item={v}
                  expanded={expandedId === v.id}
                  onToggle={handleToggle}
                />
              ))}
            </View>
          )}

          {visits.length === 0 && !loadingVisits && (
            <View style={s.emptyState}>
              <View style={s.emptyIconWrap}>
                <Inbox size={32} color={MC.textFaint} />
              </View>
              <Text style={s.emptyText}>No visits logged yet</Text>
              <Text style={s.emptySub}>Capture your first visit above</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  keyboardView: { flex: 1, backgroundColor: MC.bg },
  scroll: { flex: 1 },
  container: { padding: 24, paddingBottom: 48, gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: MC.bg },

  headerBlock: { marginBottom: 4 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  kicker: {
    fontSize: 9, fontWeight: '800', color: MC.textFaint,
    fontFamily: MF.mono, letterSpacing: 1.6, textTransform: 'uppercase',
  },
  title: {
    fontSize: 22, fontWeight: '800', color: MC.textPrimary,
    fontFamily: MF.display, letterSpacing: 0.2,
  },
  subtitle: { fontSize: 12, color: MC.textSub, marginTop: 4, fontFamily: MF.mono },
  offlineRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    backgroundColor: `${MC.rose}12`, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 6,
  },
  offlineText: { fontSize: 11, color: MC.rose, fontFamily: MF.mono },

  historySection: { marginTop: 8 },
  historyHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  historyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyTitle: {
    fontSize: 13, fontWeight: '800', color: MC.textPrimary,
    fontFamily: MF.mono, letterSpacing: 1, textTransform: 'uppercase',
  },
  historyCountPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: MC.surfaceAlt, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: MC.border,
  },
  historyCount: { fontSize: 10, color: MC.textFaint, fontFamily: MF.mono, fontWeight: '600' },
  historyHint: {
    fontSize: 10, color: MC.textFaint, fontFamily: MF.mono,
    marginBottom: 12, fontStyle: 'italic',
  },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: MC.surfaceAlt, borderWidth: 1, borderColor: MC.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyText: { fontSize: 14, fontWeight: '700', color: MC.textSub, fontFamily: MF.display },
  emptySub: { fontSize: 11, color: MC.textFaint, fontFamily: MF.mono },
});