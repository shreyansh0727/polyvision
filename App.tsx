// App.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, StatusBar, Text, TouchableOpacity } from 'react-native';
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
import { ArrowRightCircle } from 'lucide-react-native';

export default function App() {
  useNetworkMonitor();
  useOtaUpdate();

  const { update: appUpdate, openDownload } = useInternalAppUpdate();

  const [firebaseReady, setFirebaseReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async () => {
      unsub();
      useAuthStore.getState().initAuthListener();
      await useAuthStore.getState().loadStoredAuth();
      setFirebaseReady(true);
    });

    return () => unsub();
  }, []);

  if (!firebaseReady) return null;

  const showUpdateBanner = appUpdate?.needsUpdate && !appUpdate.force;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <View style={styles.root}>
          <StatusBar
            barStyle="light-content"
            backgroundColor="#020617"
          />

          {/* APK update banner (non-blocking) */}
          {showUpdateBanner && (
            <View style={styles.updateBanner}>
              <View style={styles.updateTextWrap}>
                <Text style={styles.updateTitle}>
                  New build available{appUpdate.latestVersion ? ` v${appUpdate.latestVersion}` : ''}
                </Text>
                <Text style={styles.updateSub} numberOfLines={2}>
                  {appUpdate.notes || 'Tap update to download the latest APK.'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.updateBtn}
                onPress={openDownload}
                activeOpacity={0.85}
              >
                <ArrowRightCircle size={16} color={MC.bg} />
                <Text style={styles.updateBtnText}>Update</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Optional: blocking overlay when force-update is required */}
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

  updateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: MC.blue,
  },
  updateTextWrap: { flex: 1, marginRight: 12 },
  updateTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: MC.bg,
    fontFamily: MF.mono,
    letterSpacing: 0.5,
  },
  updateSub: {
    fontSize: 11,
    color: MC.bg,
    opacity: 0.9,
    marginTop: 2,
    fontFamily: MF.mono,
  },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: MC.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  updateBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: MC.blue,
    fontFamily: MF.mono,
  },

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