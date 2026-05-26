// src/hooks/useAdminRealtimeMap.ts
import { useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getAuth } from '@react-native-firebase/auth';
import {
  getDatabase,
  ref,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  DataSnapshot,
} from '@react-native-firebase/database';
import { useAuthStore } from '../store/authStore';
import { useLocationStore } from '../store/locationStore';

interface RealtimeMapControls {
  attach: () => void;
  detach: () => void;
}

export function useAdminRealtimeMap(): RealtimeMapControls {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const employee = useAuthStore((s) => s.employee);

  const getStoreActions = useCallback(() => ({
    seedFromApi: useLocationStore.getState().seedFromApi,
    updateEmployee: useLocationStore.getState().updateEmployee,
    updateEmployeeStatus: useLocationStore.getState().updateEmployeeStatus,
    clearAll: useLocationStore.getState().clearAll,
  }), []);

  const cleanupRef = useRef<{
    unsubAdded: () => void;
    unsubChanged: () => void;
    unsubRemoved: () => void;
    appSub: { remove: () => void };
  } | null>(null);

  const attach = useCallback(() => {
    if (!isAuthenticated) return;
    if (!employee?.tenant_id) {
      console.warn('[RealtimeMap] Missing tenant_id for admin');
      return;
    }
    if (cleanupRef.current) return;

    const actions = getStoreActions();

    actions.seedFromApi();

    const liveRef = ref(
      getDatabase(),
      `tenants/${employee.tenant_id}/locations`
    );

    const handleSnapshot = (snapshot: DataSnapshot) => {
      const data = snapshot.val();
      const employee_id = snapshot.key;

      if (!data || !employee_id) return;

      getStoreActions().updateEmployee({
        employee_id,
        lat: data.lat,
        lng: data.lng,
        ...(data.accuracy != null && { accuracy: data.accuracy }),
        ...(data.battery != null && { battery: data.battery }),
        recorded_at: data.recorded_at ?? new Date().toISOString(),
        is_online: data.is_online ?? true,
      });
    };

    const unsubAdded = onChildAdded(liveRef, handleSnapshot);
    const unsubChanged = onChildChanged(liveRef, handleSnapshot);
    const unsubRemoved = onChildRemoved(liveRef, (snapshot: DataSnapshot) => {
      if (snapshot.key) {
        getStoreActions().updateEmployeeStatus(snapshot.key, false);
      }
    });

    const appSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active' && getAuth().currentUser) {
        getStoreActions().seedFromApi();
      }
    });

    cleanupRef.current = { unsubAdded, unsubChanged, unsubRemoved, appSub };
  }, [isAuthenticated, employee?.tenant_id, getStoreActions]);

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