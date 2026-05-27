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

export interface RealtimeMapControls {
  attach: () => void;
  detach: () => void;
}

interface CleanupBundle {
  unsubAdded: () => void;
  unsubChanged: () => void;
  unsubRemoved: () => void;
  appSub: { remove: () => void };
}

export function useAdminRealtimeMap(): RealtimeMapControls {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const tenantId = useAuthStore((s) => s.employee?.tenant_id);

  const cleanupRef = useRef<CleanupBundle | null>(null);

  const attach = useCallback(() => {
    if (!isAuthenticated) {
      if (__DEV__) console.warn('[RealtimeMap] attach() called while unauthenticated — skipping');
      return;
    }

    if (!tenantId) {
      console.warn('[RealtimeMap] Missing tenant_id for admin — skipping attach');
      return;
    }

    if (cleanupRef.current) {
      if (__DEV__) console.warn('[RealtimeMap] Already attached — ignoring duplicate attach()');
      return;
    }

    const { seedFromApi } = useLocationStore.getState();

    seedFromApi().catch((err: unknown) => {
      console.warn('[RealtimeMap] seedFromApi() failed:', err);
    });

    const liveRef = ref(getDatabase(), `tenants/${tenantId}/locations`);

    const handleSnapshot = (snapshot: DataSnapshot): void => {
      const data = snapshot.val();
      const firebase_uid = snapshot.key;

      if (!data || typeof data !== 'object' || !firebase_uid) return;

      const employee_id =
        typeof data.employee_id === 'string' && data.employee_id.trim()
          ? data.employee_id
          : null;

      if (!employee_id) {
        if (__DEV__) {
          console.warn(`[RealtimeMap] Skipping ${firebase_uid}: missing employee_id`, data);
        }
        return;
      }

      const lat = typeof data.lat === 'number' && isFinite(data.lat) ? data.lat : null;
      const lng = typeof data.lng === 'number' && isFinite(data.lng) ? data.lng : null;

      // Allow offline/status-only records into the store if employee_id exists
      if (lat === null || lng === null) {
        useLocationStore.getState().updateEmployee({
          employee_id,
          is_online: data.is_online === true,
          recorded_at:
            typeof data.recorded_at === 'string' && data.recorded_at
              ? data.recorded_at
              : new Date().toISOString(),
        });
        return;
      }

      useLocationStore.getState().updateEmployee({
        employee_id,
        lat,
        lng,
        ...(typeof data.accuracy === 'number' && isFinite(data.accuracy)
          ? { accuracy: data.accuracy }
          : {}),
        ...(typeof data.battery === 'number' && data.battery >= 0 && data.battery <= 100
          ? { battery: Math.round(data.battery) }
          : {}),
        recorded_at:
          typeof data.recorded_at === 'string' && data.recorded_at
            ? data.recorded_at
            : new Date().toISOString(),
        is_online: data.is_online === true,
      });
    };

    const handleRemoved = (snapshot: DataSnapshot): void => {
      const data = snapshot.val();
      const employee_id =
        data &&
        typeof data === 'object' &&
        typeof data.employee_id === 'string' &&
        data.employee_id.trim()
          ? data.employee_id
          : null;

      if (!employee_id) return;
      useLocationStore.getState().updateEmployeeStatus(employee_id, false);
    };

    let unsubAdded: () => void;
    let unsubChanged: () => void;
    let unsubRemoved: () => void;

    try {
      unsubAdded = onChildAdded(liveRef, handleSnapshot);
      unsubChanged = onChildChanged(liveRef, handleSnapshot);
      unsubRemoved = onChildRemoved(liveRef, handleRemoved);
    } catch (err) {
      console.error('[RealtimeMap] Failed to register Firebase listeners:', err);
      return;
    }

    const appSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next !== 'active') return;
      if (!getAuth().currentUser) return;
      useLocationStore.getState().seedFromApi().catch((err: unknown) => {
        console.warn('[RealtimeMap] AppState resume seedFromApi() failed:', err);
      });
    });

    cleanupRef.current = { unsubAdded, unsubChanged, unsubRemoved, appSub };
  }, [isAuthenticated, tenantId]);

  const detach = useCallback(() => {
    if (!cleanupRef.current) return;

    const { unsubAdded, unsubChanged, unsubRemoved, appSub } = cleanupRef.current;

    try { unsubAdded(); } catch (e) { console.warn('[RealtimeMap] unsubAdded error:', e); }
    try { unsubChanged(); } catch (e) { console.warn('[RealtimeMap] unsubChanged error:', e); }
    try { unsubRemoved(); } catch (e) { console.warn('[RealtimeMap] unsubRemoved error:', e); }
    try { appSub.remove(); } catch (e) { console.warn('[RealtimeMap] appSub.remove error:', e); }

    useLocationStore.getState().clearAll();
    cleanupRef.current = null;
  }, []);

  return { attach, detach };
}