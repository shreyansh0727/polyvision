// src/hooks/useTracking.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import Geolocation, { GeolocationResponse, GeolocationError } from '@react-native-community/geolocation';
import { useAuthStore } from '../store/authStore';
import { startTracking, stopTracking } from '../services/locationService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LastLocation {
  lat:       number;
  lng:       number;
  accuracy:  number | null;
  timestamp: string;
}

export interface TrackingHook {
  isTracking:   boolean;
  isStarting:   boolean;
  isStopping:   boolean;
  error:        string | null;
  lastLocation: LastLocation | null;
  start:        () => Promise<void>;
  stop:         () => Promise<void>;
  clearError:   () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTracking(): TrackingHook {
  const employee = useAuthStore((s) => s.employee);

  const [isTracking,   setIsTracking]   = useState(false);
  const [isStarting,   setIsStarting]   = useState(false);
  const [isStopping,   setIsStopping]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [lastLocation, setLastLocation] = useState<LastLocation | null>(null);

  // Refs mirror the employee IDs so async callbacks always read the latest value
  // without needing to be re-created (avoids stale closure issues in callbacks
  // registered once, like the AppState listener).
  const isTrackingRef  = useRef(false);
  const employeeIdRef  = useRef<string | undefined>(employee?.id);
  const tenantIdRef    = useRef<string | undefined>(employee?.tenant_id);
  // firebase_uid is what the RTDB path key must match (auth.uid rule)
  const firebaseUidRef = useRef<string | undefined>(employee?.firebase_uid);

  useEffect(() => {
    employeeIdRef.current  = employee?.id;
    tenantIdRef.current    = employee?.tenant_id;
    firebaseUidRef.current = employee?.firebase_uid;
  }, [employee?.id, employee?.tenant_id, employee?.firebase_uid]);

  // ── snapLocation ────────────────────────────────────────────────────────────
  const snapLocation = useCallback((highAccuracy = false) => {
    Geolocation.getCurrentPosition(
      (pos: GeolocationResponse) => {
        setLastLocation({
          lat:       pos.coords.latitude,
          lng:       pos.coords.longitude,
          accuracy:  typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : null,
          timestamp: new Date().toISOString(),
        });
      },
      (geoError: GeolocationError) => {
        // Surface the error rather than silently dropping it — the UI can
        // show a "location unavailable" hint without blocking the tracking session.
        if (__DEV__) {
          console.warn('[useTracking] snapLocation error:', geoError.message, geoError.code);
        }
        // Do NOT setError here — a single snap failure isn't a tracking failure.
        // The background watcher will keep retrying.
      },
      {
        enableHighAccuracy: highAccuracy,
        timeout:            highAccuracy ? 8_000 : 5_000,
        maximumAge:         highAccuracy ? 0     : 10_000,
      },
    );
  }, []);

  // ── Refresh location when app comes to foreground ──────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active' && isTrackingRef.current) {
        snapLocation(false);
      }
    });
    return () => sub.remove();
  }, [snapLocation]);

  // ── Auto-stop on sign-out ──────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), (user) => {
      if (user || !isTrackingRef.current) return;

      // User signed out while tracking — attempt a best-effort clean stop.
      // Use the refs since the employee store may already be cleared.
      const tId = tenantIdRef.current;
      const eId = employeeIdRef.current;
      const fId = firebaseUidRef.current;

      if (tId && (fId ?? eId)) {
        stopTracking(tId, fId ?? eId).catch((err: unknown) => {
          console.warn('[useTracking] stopTracking on sign-out failed:', err);
        });
      }

      setIsTracking(false);
      isTrackingRef.current = false;
      setLastLocation(null);
    });
    return () => unsub();
  }, []);

  // ── start ───────────────────────────────────────────────────────────────────
  const start = useCallback(async (): Promise<void> => {
    if (isTrackingRef.current) {
      if (__DEV__) console.warn('[useTracking] start() called while already tracking — no-op');
      return;
    }

    const firebaseUser = getAuth().currentUser;
    if (!firebaseUser) {
      const msg = 'You must be signed in to start tracking.';
      setError(msg);
      throw new Error(msg);
    }

    if (!employee?.id || !employee?.tenant_id) {
      const msg = 'Missing employee or tenant information.';
      setError(msg);
      throw new Error(msg);
    }

    // firebase_uid is required for the RTDB write to satisfy auth.uid === $employeeId
    const firebaseUid = employee.firebase_uid ?? firebaseUser.uid;
    if (!firebaseUid) {
      const msg = 'Unable to determine Firebase UID for location write.';
      setError(msg);
      throw new Error(msg);
    }

    setError(null);
    setIsStarting(true);

    try {
      await startTracking(employee.tenant_id, employee.id, firebaseUid);
      setIsTracking(true);
      isTrackingRef.current = true;
      snapLocation(true);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to start tracking. Please try again.';
      setError(message);
      throw e;
    } finally {
      setIsStarting(false);
    }
  }, [employee?.id, employee?.tenant_id, employee?.firebase_uid, snapLocation]);

  // ── stop ────────────────────────────────────────────────────────────────────
  const stop = useCallback(async (): Promise<void> => {
    if (!isTrackingRef.current) return;

    setError(null);
    setIsStopping(true);

    // Capture IDs synchronously — store may be cleared by the time await resolves
    const tId = tenantIdRef.current;
    const fId = firebaseUidRef.current ?? employeeIdRef.current;

    try {
      await stopTracking(tId, fId);
      setIsTracking(false);
      isTrackingRef.current = false;
      setLastLocation(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to stop tracking cleanly.';
      setError(message);
      // Still clear the local tracking state — the background service has
      // stopped even if the RTDB write failed (it will retry via onDisconnect).
      setIsTracking(false);
      isTrackingRef.current = false;
    } finally {
      setIsStopping(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    isTracking,
    isStarting,
    isStopping,
    error,
    lastLocation,
    start,
    stop,
    clearError,
  };
}