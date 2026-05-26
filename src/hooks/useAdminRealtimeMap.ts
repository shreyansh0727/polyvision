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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RealtimeMapControls {
  attach: () => void;
  detach: () => void;
}

interface CleanupBundle {
  unsubAdded:   () => void;
  unsubChanged: () => void;
  unsubRemoved: () => void;
  appSub:       { remove: () => void };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAdminRealtimeMap(): RealtimeMapControls {
  // Read auth state via stable selectors — these won't change identity each render
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const tenantId        = useAuthStore((s) => s.employee?.tenant_id);

  const cleanupRef = useRef<CleanupBundle | null>(null);

  // ── attach ──────────────────────────────────────────────────────────────────
  const attach = useCallback(() => {
    if (!isAuthenticated) {
      if (__DEV__) console.warn('[RealtimeMap] attach() called while unauthenticated — skipping');
      return;
    }

    if (!tenantId) {
      console.warn('[RealtimeMap] Missing tenant_id for admin — skipping attach');
      return;
    }

    // Guard against double-attach without detach in between
    if (cleanupRef.current) {
      if (__DEV__) console.warn('[RealtimeMap] Already attached — ignoring duplicate attach()');
      return;
    }

    // ── Access store actions via getState() — NOT via hooks (no Rules of Hooks violation)
    // Zustand's getState() is a plain static getter, safe to call anywhere.
    const { seedFromApi, updateEmployee, updateEmployeeStatus } = useLocationStore.getState();

    // Kick off the initial HTTP seed (non-blocking; failures are logged inside seedFromApi)
    seedFromApi().catch((err: unknown) => {
      console.warn('[RealtimeMap] seedFromApi() failed:', err);
    });

    const liveRef = ref(getDatabase(), `tenants/${tenantId}/locations`);

    // ── Stable snapshot handler — defined once, reused for added + changed ───
    const handleSnapshot = (snapshot: DataSnapshot): void => {
      const data        = snapshot.val();
      const employee_id = snapshot.key;

      // Defensive: skip malformed payloads
      if (!data || typeof data !== 'object' || !employee_id) return;

      // Validate that coordinates are present and numeric before writing to store
      const lat = typeof data.lat === 'number' && isFinite(data.lat) ? data.lat : null;
      const lng = typeof data.lng === 'number' && isFinite(data.lng) ? data.lng : null;

      if (lat === null || lng === null) {
        if (__DEV__) {
          console.warn(`[RealtimeMap] Skipping employee ${employee_id}: invalid coords`, data);
        }
        return;
      }

      // Call getState() here (not the captured reference above) so we always
      // use the latest action even if the store was replaced during hot reload.
      useLocationStore.getState().updateEmployee({
        employee_id,
        lat,
        lng,
        ...(typeof data.accuracy === 'number' && isFinite(data.accuracy)
          ? { accuracy: data.accuracy }
          : {}),
        ...(typeof data.battery === 'number' &&
          data.battery >= 0 &&
          data.battery <= 100
          ? { battery: Math.round(data.battery) }
          : {}),
        recorded_at: typeof data.recorded_at === 'string' && data.recorded_at
          ? data.recorded_at
          : new Date().toISOString(),
        is_online: data.is_online === true,
      });
    };

    const handleRemoved = (snapshot: DataSnapshot): void => {
      if (!snapshot.key) return;
      useLocationStore.getState().updateEmployeeStatus(snapshot.key, false);
    };

    // ── Register Firebase listeners ──────────────────────────────────────────
    let unsubAdded:   () => void;
    let unsubChanged: () => void;
    let unsubRemoved: () => void;

    try {
      unsubAdded   = onChildAdded(liveRef,   handleSnapshot);
      unsubChanged = onChildChanged(liveRef, handleSnapshot);
      unsubRemoved = onChildRemoved(liveRef, handleRemoved);
    } catch (err) {
      console.error('[RealtimeMap] Failed to register Firebase listeners:', err);
      return;
    }

    // ── Re-seed on foreground resume (covers offline → online transitions) ───
    const appSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next !== 'active') return;
      // Confirm the user is still authenticated before hitting the API
      if (!getAuth().currentUser) return;
      useLocationStore.getState().seedFromApi().catch((err: unknown) => {
        console.warn('[RealtimeMap] AppState resume seedFromApi() failed:', err);
      });
    });

    cleanupRef.current = { unsubAdded, unsubChanged, unsubRemoved, appSub };
  }, [isAuthenticated, tenantId]);

  // ── detach ──────────────────────────────────────────────────────────────────
  const detach = useCallback(() => {
    if (!cleanupRef.current) return;

    const { unsubAdded, unsubChanged, unsubRemoved, appSub } = cleanupRef.current;

    try { unsubAdded();   } catch (e) { console.warn('[RealtimeMap] unsubAdded error:', e); }
    try { unsubChanged(); } catch (e) { console.warn('[RealtimeMap] unsubChanged error:', e); }
    try { unsubRemoved(); } catch (e) { console.warn('[RealtimeMap] unsubRemoved error:', e); }
    try { appSub.remove(); } catch (e) { console.warn('[RealtimeMap] appSub.remove error:', e); }

    useLocationStore.getState().clearAll();

    cleanupRef.current = null;
  }, []);

  return { attach, detach };
}