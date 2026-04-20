// App.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { useAuthStore } from './src/store/authStore';
import Navigation from './src/navigation';
import { useOtaUpdate } from './src/hooks/useOtaUpdate';
import { useNetworkMonitor } from './src/hooks/useNetworkMonitor';
import { OfflineBanner } from './src/components/OfflineBanner';

export default function App() {
  useNetworkMonitor();
  useOtaUpdate();

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

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <View style={styles.root}>
          <StatusBar
            barStyle="light-content"
            backgroundColor="#020617"
          />
          <OfflineBanner />
          <Navigation />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});