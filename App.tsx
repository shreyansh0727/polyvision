// App.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  StatusBar,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  Animated,
  ScrollView,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { ArrowDownToLine, X, Layers } from 'lucide-react-native';

import { useAuthStore } from './src/store/authStore';
import Navigation from './src/navigation';
import { useOtaUpdate } from './src/hooks/useOtaUpdate';
import { useNetworkMonitor } from './src/hooks/useNetworkMonitor';
import { OfflineBanner } from './src/components/OfflineBanner';
import { useInternalAppUpdate } from './src/hooks/useInternalAppUpdate';
import { MC, MF } from './src/navigation/AppTheme';

type InternalUpdate = NonNullable<ReturnType<typeof useInternalAppUpdate>['update']>;

function parseNotes(notes?: string | null): string[] {
  if (!notes) return [];
  return notes
    .split(/\n|;\s*/)
    .map(s => s.trim())
    .filter(Boolean);
}

// ─── Bottom-sheet update popup ───────────────────────────────────────────────
function UpdateSheet({
  visible,
  update,
  onDownload,
  onDismiss,
}: {
  visible: boolean;
  update: InternalUpdate;
  onDownload: () => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(420)).current;

  useEffect(() => {
    let mounted = true;

    if (visible) {
      Animated.spring(slideY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 180,
      }).start();
    } else if (mounted) {
      slideY.setValue(420);
    }

    return () => {
      mounted = false;
      slideY.stopAnimation();
    };
  }, [visible, slideY]);

  const dismiss = () => {
    Animated.timing(slideY, {
      toValue: 420,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onDismiss();
    });
  };

  const noteLines = useMemo(() => parseNotes(update.notes), [update.notes]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <Pressable style={styles.sheetBackdrop} onPress={dismiss}>
        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + 12,
              transform: [{ translateY: slideY }],
            },
          ]}
        >
          <Pressable onPress={() => {}}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetIconWrap}>
                <Layers size={20} color={MC.blue} />
              </View>

              <View style={styles.sheetTitles}>
                <Text style={styles.sheetTitle}>New build available</Text>
                <Text style={styles.sheetSub}>
                  {update.minSupportedVersion
                    ? `Latest v${update.latestVersion} • Minimum supported v${update.minSupportedVersion}`
                    : `v${update.latestVersion} is ready to download`}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={dismiss}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Dismiss update sheet"
              >
                <X size={13} color={MC.textSub} />
              </TouchableOpacity>
            </View>

            {noteLines.length > 0 && (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>What&apos;s new</Text>
                <ScrollView
                  style={styles.notesScroll}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  {noteLines.map((line, i) => (
                    <View key={`${line}-${i}`} style={styles.noteRow}>
                      <View style={styles.noteDot} />
                      <Text style={styles.noteText}>{line}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            <TouchableOpacity
              style={styles.downloadBtn}
              onPress={() => {
                dismiss();
                onDownload();
              }}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Download APK"
            >
              <ArrowDownToLine size={15} color={MC.bg} />
              <Text style={styles.downloadBtnText}>Download APK</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.laterBtn}
              onPress={dismiss}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel="Remind me later"
            >
              <Text style={styles.laterBtnText}>Remind me later</Text>
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ─── Slim persistent banner ───────────────────────────────────────────────────
function UpdateBanner({
  update,
  onDownload,
  onDismiss,
}: {
  update: InternalUpdate;
  onDownload: () => void;
  onDismiss: () => void;
}) {
  return (
    <View style={styles.banner}>
      <View style={styles.bannerIconWrap}>
        <ArrowDownToLine size={13} color={MC.bg} />
      </View>

      <View style={styles.bannerTextWrap}>
        <Text style={styles.bannerTag}>New build</Text>
        <Text style={styles.bannerVersion} numberOfLines={1}>
          {update.latestVersion ? `v${update.latestVersion} available` : 'Update available'}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.bannerBtn}
        onPress={onDownload}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Download app update"
      >
        <Text style={styles.bannerBtnText}>Update</Text>
      </TouchableOpacity>

      {!update.force && (
        <TouchableOpacity
          style={styles.bannerDismiss}
          onPress={onDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Dismiss update banner"
        >
          <X size={12} color={`${MC.bg}99`} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  useNetworkMonitor();
  useOtaUpdate();

  const { update: appUpdate, openDownload } = useInternalAppUpdate();

  const [firebaseReady, setFirebaseReady] = useState(false);
  const [popupDismissed, setPopupDismissed] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async () => {
      unsub();
      useAuthStore.getState().initAuthListener();
      await useAuthStore.getState().loadStoredAuth();
      setFirebaseReady(true);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (appUpdate?.latestVersion) {
      setPopupDismissed(false);
      setBannerDismissed(false);
    }
  }, [appUpdate?.latestVersion]);

  if (!firebaseReady) return null;

  const showUpdate = !!appUpdate?.needsUpdate && !appUpdate?.force;
  const showPopup = showUpdate && !popupDismissed;
  const showBanner = showUpdate && popupDismissed && !bannerDismissed;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <View style={styles.root}>
          <StatusBar barStyle="light-content" backgroundColor={MC.bg} />

          {showBanner && appUpdate && (
            <UpdateBanner
              update={appUpdate}
              onDownload={openDownload}
              onDismiss={() => setBannerDismissed(true)}
            />
          )}

          <OfflineBanner />
          <Navigation />

          {showUpdate && appUpdate && (
            <UpdateSheet
              visible={showPopup}
              update={appUpdate}
              onDownload={openDownload}
              onDismiss={() => setPopupDismissed(true)}
            />
          )}

          {appUpdate?.force && (
            <View style={styles.forceOverlay}>
              <View style={styles.forceCard}>
                <Text style={styles.forceTitle}>Update required</Text>
                <Text style={styles.forceSub}>
                  Please install the latest build to continue using the app.
                </Text>

                {!!appUpdate.latestVersion && (
                  <Text style={styles.forceMeta}>
                    Latest version: v{appUpdate.latestVersion}
                  </Text>
                )}

                <TouchableOpacity
                  style={styles.forceBtn}
                  onPress={openDownload}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel="Download required update"
                >
                  <Text style={styles.forceBtnText}>Download update</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // ── Bottom sheet ────────────────────────────────────────
  sheetBackdrop: {
    flex: 1,
    backgroundColor: '#000000b8',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: MC.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 0.5,
    borderBottomWidth: 0,
    borderColor: MC.border,
    paddingHorizontal: 20,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: MC.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 18,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  sheetIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: `${MC.blue}18`,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  sheetTitles: { flex: 1 },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: MC.textPrimary,
    fontFamily: MF.display,
  },
  sheetSub: {
    fontSize: 11,
    color: MC.textSub,
    fontFamily: MF.mono,
    marginTop: 3,
    lineHeight: 16,
  },
  sheetCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: MC.border,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },

  notesBox: {
    backgroundColor: `${MC.bg}66`,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: MC.border,
    padding: 12,
    marginBottom: 16,
  },
  notesLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: MC.textSub,
    fontFamily: MF.mono,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  notesScroll: {
    maxHeight: 120,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  noteDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: MC.blue,
    marginTop: 5,
    flexShrink: 0,
  },
  noteText: {
    flex: 1,
    fontSize: 11,
    color: MC.textSub,
    fontFamily: MF.mono,
    lineHeight: 17,
  },

  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: MC.blue,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  downloadBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: MC.bg,
    fontFamily: MF.mono,
  },
  laterBtn: { alignItems: 'center', paddingVertical: 10 },
  laterBtnText: {
    fontSize: 12,
    color: MC.textSub,
    fontFamily: MF.mono,
  },

  // ── Slim banner ──────────────────────────────────────────
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: MC.blue,
  },
  bannerIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  bannerTextWrap: { flex: 1 },
  bannerTag: {
    fontSize: 9,
    fontWeight: '800',
    color: `${MC.bg}aa`,
    fontFamily: MF.mono,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  bannerVersion: {
    fontSize: 11,
    fontWeight: '700',
    color: MC.bg,
    fontFamily: MF.mono,
    marginTop: 1,
  },
  bannerBtn: {
    backgroundColor: MC.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  bannerBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: MC.blue,
    fontFamily: MF.mono,
  },
  bannerDismiss: { padding: 4 },

  // ── Force overlay ────────────────────────────────────────
  forceOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000aa',
    zIndex: 999,
  },
  forceCard: {
    width: '82%',
    backgroundColor: MC.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: MC.border,
  },
  forceTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: MC.textPrimary,
    fontFamily: MF.display,
    marginBottom: 8,
  },
  forceSub: {
    fontSize: 12,
    color: MC.textSub,
    fontFamily: MF.mono,
    marginBottom: 10,
    lineHeight: 18,
  },
  forceMeta: {
    fontSize: 11,
    color: MC.textFaint,
    fontFamily: MF.mono,
    marginBottom: 16,
  },
  forceBtn: {
    backgroundColor: MC.green,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  forceBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: MC.bg,
    fontFamily: MF.mono,
  },
});