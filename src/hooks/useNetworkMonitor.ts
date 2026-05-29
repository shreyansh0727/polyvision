import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useOfflineStore } from '../store/offlineStore';
import { syncOfflineQueue } from '../services/offlineSync';

/**
 * Drop this hook once in App.tsx.
 * Watches network state and triggers queue sync on reconnect.
 * Also refreshes NetInfo when app returns from background.
 */
export function useNetworkMonitor(): void {
  const setOnline = useOfflineStore((s) => s.setOnline);
  const syncingRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const applyNetworkState = async () => {
      try {
        const state = await NetInfo.fetch();

        const online =
          state.isConnected === true &&
          state.isInternetReachable !== false;

        setOnline(online);

        if (online && !syncingRef.current) {
          syncingRef.current = true;
          try {
            await syncOfflineQueue();
          } finally {
            syncingRef.current = false;
          }
        }
      } catch {
        setOnline(false);
      }
    };

    const unsubNetInfo = NetInfo.addEventListener((state) => {
      const online =
        state.isConnected === true &&
        state.isInternetReachable !== false;

      setOnline(online);

      if (online && !syncingRef.current) {
        syncingRef.current = true;
        Promise.resolve(syncOfflineQueue()).finally(() => {
          syncingRef.current = false;
        });
      }
    });

    const appStateSub = AppState.addEventListener('change', async (nextState) => {
      const wasBackground =
        appStateRef.current === 'background' || appStateRef.current === 'inactive';

      if (wasBackground && nextState === 'active') {
        await applyNetworkState();
      }

      appStateRef.current = nextState;
    });

    applyNetworkState();

    return () => {
      unsubNetInfo();
      appStateSub.remove();
    };
  }, [setOnline]);
}