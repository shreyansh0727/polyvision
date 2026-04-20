import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useOfflineStore } from '../store/offlineStore';
import { syncOfflineQueue } from '../services/offlineSync';

/**
 * Drop this hook once in App.tsx.
 * Watches network state and triggers queue sync on reconnect.
 */
export function useNetworkMonitor(): void {
  const setOnline = useOfflineStore((s) => s.setOnline);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setOnline(online);

      if (online) {
        // Back online — flush queued requests
        syncOfflineQueue();
      }
    });

    return () => unsub();
  }, []);
}
