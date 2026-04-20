// App.tsx
import React, { useEffect, useState } from 'react';
import {
  StyleSheet, View, StatusBar, Text, TouchableOpacity,
  Modal, Pressable,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { useAuthStore } from './src/store/authStore';
import Navigation from './src/navigation';
import { useOtaUpdate } from './src/hooks/useOtaUpdate';
import { useNetworkMonitor } from './src/hooks/useNetworkMonitor';
import { OfflineBanner } from './src/components/OfflineBanner';
import { useInternalAppUpdate } from './src/hooks/useInternalAppUpdate';
import { MC, MF } from './src/navigation/AppTheme';
import { ArrowRightCircle, X, Download, Sparkles } from 'lucide-react-native';

export default function App() {
  useNetworkMonitor();
  useOtaUpdate();

  const { update: appUpdate, openDownload } = useInternalAppUpdate();

  const [firebaseReady, setFirebaseReady] = useState(false);
  const [popupDismissed, setPopupDismissed] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async () => {
      unsub();
      useAuthStore.getState().initAuthListener();
      await useAuthStore.getState().loadStoredAuth();
      setFirebaseReady(true);
    });

    return () => unsub();
  }, []);

  // Reset dismissed state if a new update comes in
  useEffect(() => {
    if (appUpdate?.latestVersion) {
      setPopupDismissed(false);
    }
  }, [appUpdate?.latestVersion]);

  if (!firebaseReady) return null;

  const showUpdate = appUpdate?.needsUpdate && !appUpdate.force;
  const showPopup = showUpdate && !popupDismissed;
  const showBanner = showUpdate && popupDismissed;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <View style={styles.root}>
          <StatusBar barStyle="light-content" backgroundColor="#020617" />

          {/* ── Slim banner (after popup is dismissed) ── */}
          {showBanner && (
            <View style={styles.updateBanner}>
              <View style={styles.updateTextWrap}>
                <Text style={styles.updateTitle}>
                  New build available{appUpdate.latestVersion ? ` v${appUpdate.latestVersion}` : ''}
                </Text>
                <Text style={styles.updateSub} numberOfLines={1}>
                  {appUpdate.notes || 'Tap update to download the latest APK.'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.updateBtn}
                onPress={openDownload}
                activeOpacity={0.85}
              >
                <ArrowRightCircle size={14} color={MC.bg} />
                <Text style={styles.updateBtnText}>Update</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Update popup modal ── */}
          <Modal
            visible={showPopup}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={() => setPopupDismissed(true)}
          >
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => setPopupDismissed(true)}
            >
              {/* Prevent tap-through on card */}
              <Pressable style={styles.modalCard} onPress={() => {}}>

                {/* Close button */}
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setPopupDismissed(true)}
                  hitSlop={8}
                >
                  <X size={16} color={MC.textSub} />
                </TouchableOpacity>

                {/* Icon badge */}
                <View style={styles.iconBadge}>
                  <Sparkles size={22} color={MC.blue} />
                </View>

                <Text style={styles.popupTitle}>New Build Available</Text>

                {appUpdate?.latestVersion && (
                  <View style={styles.versionBadge}>
                    <Text style={styles.versionBadgeText}>
                      v{appUpdate.latestVersion}
                    </Text>
                  </View>
                )}

                {appUpdate?.notes && (
                  <Text style={styles.popupNotes}>{appUpdate.notes}</Text>
                )}

                <TouchableOpacity
                  style={styles.downloadBtn}
                  onPress={() => {
                    setPopupDismissed(true);
                    openDownload();
                  }}
                  activeOpacity={0.88}
                >
                  <Download size={15} color={MC.bg} />
                  <Text style={styles.downloadBtnText}>Download Update</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.laterBtn}
                  onPress={() => setPopupDismissed(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.laterBtnText}>Maybe later</Text>
                </TouchableOpacity>

              </Pressable>
            </Pressable>
          </Modal>

          {/* ── Force-update blocking overlay ── */}
          {appUpdate?.force && (
            <View style={styles.forceOverlay}>
              <View style={styles.forceCard}>
                <Text style={styles.forceTitle}>Update required</Text>
                <Text style={styles.forceSub}>
                  Please install the latest build to continue using the app.
                </Text>
                <TouchableOpacity
                  style={styles.forceBtn}
                  onPress={openDownload}
                  activeOpacity={0.9}
                >
                  <Text style={styles.forceBtnText}>Download update</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <OfflineBanner />
          <Navigation />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // ── Slim banner ──────────────────────────────────────────
  updateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: MC.blue,
  },
  updateTextWrap: { flex: 1, marginRight: 12 },
  updateTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: MC.bg,
    fontFamily: MF.mono,
    letterSpacing: 0.5,
  },
  updateSub: {
    fontSize: 10,
    color: MC.bg,
    opacity: 0.85,
    marginTop: 1,
    fontFamily: MF.mono,
  },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: MC.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  updateBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: MC.blue,
    fontFamily: MF.mono,
  },

  // ── Popup modal ──────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#000000b0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  modalCard: {
    width: '100%',
    backgroundColor: MC.surface,
    borderRadius: 20,
    padding: 24,
    paddingTop: 28,
    borderWidth: 1,
    borderColor: MC.border,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    padding: 4,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: `${MC.blue}22`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  popupTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: MC.textPrimary,
    fontFamily: MF.display,
    marginBottom: 8,
    textAlign: 'center',
  },
  versionBadge: {
    backgroundColor: `${MC.blue}22`,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginBottom: 12,
  },
  versionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: MC.blue,
    fontFamily: MF.mono,
    letterSpacing: 0.6,
  },
  popupNotes: {
    fontSize: 12,
    color: MC.textSub,
    fontFamily: MF.mono,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: MC.blue,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 28,
    width: '100%',
    justifyContent: 'center',
    marginBottom: 10,
  },
  downloadBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: MC.bg,
    fontFamily: MF.mono,
  },
  laterBtn: {
    paddingVertical: 8,
  },
  laterBtnText: {
    fontSize: 12,
    color: MC.textSub,
    fontFamily: MF.mono,
  },

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