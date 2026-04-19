// src/hooks/useAdminRealtimeMap.ts
import { useRef, useCallback }      from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getAuth }                  from '@react-native-firebase/auth';
import {
  getDatabase,
  ref,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  DataSnapshot,
}                                   from '@react-native-firebase/database';
import { useAuthStore }             from '../store/authStore';
import { useLocationStore }         from '../store/locationStore';

interface RealtimeMapControls {
  attach: () => void;
  detach: () => void;
}

export function useAdminRealtimeMap(): RealtimeMapControls {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Always read latest store actions via getState() at call time
  // instead of a snapshot ref — avoids stale closures if store reinitializes
  const getStoreActions = useCallback(() => ({
    seedFromApi:          useLocationStore.getState().seedFromApi,
    updateEmployee:       useLocationStore.getState().updateEmployee,
    updateEmployeeStatus: useLocationStore.getState().updateEmployeeStatus,
    clearAll:             useLocationStore.getState().clearAll,
  }), []);

  const cleanupRef = useRef<{
    unsubAdded:   () => void;
    unsubChanged: () => void;
    unsubRemoved: () => void;
    appSub:       { remove: () => void };
  } | null>(null);

  const attach = useCallback(() => {
    if (!isAuthenticated)   return;
    if (cleanupRef.current) return; // already attached — guard against double-call

    const actions = getStoreActions();

    // 1. REST seed for initial snapshot
    actions.seedFromApi();

    // 2. RTDB realtime listeners — modular API ✅
    const liveRef = ref(getDatabase(), 'live_locations');

    const handleSnapshot = (snapshot: DataSnapshot) => {
      const data        = snapshot.val();
      const employee_id = snapshot.key;
      if (!data || !employee_id) return;

      getStoreActions().updateEmployee({
        employee_id,
        lat:         data.lat,
        lng:         data.lng,
        ...(data.accuracy != null && { accuracy: data.accuracy }),
        ...(data.battery  != null && { battery:  data.battery }),
        recorded_at: data.recorded_at ?? new Date().toISOString(),
        is_online:   data.is_online   ?? true,
      });
    };

    const unsubAdded   = onChildAdded(liveRef,   handleSnapshot);
    const unsubChanged = onChildChanged(liveRef,  handleSnapshot);
    const unsubRemoved = onChildRemoved(liveRef, (snapshot: DataSnapshot) => {
      if (snapshot.key) {
        getStoreActions().updateEmployeeStatus(snapshot.key, false);
      }
    });

    // 3. Re-seed on foreground resume — skip if user logged out meanwhile
    const appSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active' && getAuth().currentUser) {
        getStoreActions().seedFromApi();
      }
    });

    cleanupRef.current = { unsubAdded, unsubChanged, unsubRemoved, appSub };
  }, [isAuthenticated, getStoreActions]);

  const detach = useCallback(() => {
    if (!cleanupRef.current) return;

    const { unsubAdded, unsubChanged, unsubRemoved, appSub } = cleanupRef.current;

    unsubAdded();
    unsubChanged();
    unsubRemoved();
    appSub.remove();
    getStoreActions().clearAll();

    cleanupRef.current = null;
  }, [getStoreActions]);

  return { attach, detach };
}