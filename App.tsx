// App.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet }             from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider }       from 'react-native-safe-area-context';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { useAuthStore }           from './src/store/authStore';
import Navigation                 from './src/navigation';

export default function App() {
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
        <Navigation />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });