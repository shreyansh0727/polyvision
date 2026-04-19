// src/hooks/useTracking.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus }                  from 'react-native';
import { getAuth, onAuthStateChanged }               from '@react-native-firebase/auth';
import Geolocation, { GeolocationResponse }          from '@react-native-community/geolocation';
import { useAuthStore }                              from '../store/authStore';
import { startTracking, stopTracking }               from '../services/locationService';

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

export function useTracking(): TrackingHook {
  const employee = useAuthStore((s) => s.employee);

  const [isTracking,   setIsTracking]   = useState(false);
  const [isStarting,   setIsStarting]   = useState(false);
  const [isStopping,   setIsStopping]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [lastLocation, setLastLocation] = useState<LastLocation | null>(null);

  const isTrackingRef = useRef(false);
  const employeeIdRef = useRef<string | undefined>(employee?.id);

  useEffect(() => { employeeIdRef.current = employee?.id; }, [employee?.id]);

  // ── Snap current location ─────────────────────────────────────
  const snapLocation = useCallback((highAccuracy = false) => {
    Geolocation.getCurrentPosition(
      (pos: GeolocationResponse) => {
        setLastLocation({
          lat:       pos.coords.latitude,
          lng:       pos.coords.longitude,
          accuracy:  pos.coords.accuracy ?? null,
          timestamp: new Date().toISOString(),
        });
      },
      () => {},
      {
        enableHighAccuracy: highAccuracy,
        timeout:            highAccuracy ? 8_000 : 5_000,
        maximumAge:         highAccuracy ? 0 : 10_000,
      },
    );
  }, []);

  // ── Snap on foreground resume ─────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active' && isTrackingRef.current) {
        snapLocation(false);
      }
    });
    return () => sub.remove();
  }, [snapLocation]);

  // ── Auto-stop when Firebase session is lost ───────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), (user) => {   // ← modular ✅
      if (!user && isTrackingRef.current) {
        stopTracking(employeeIdRef.current).catch(() => {});
        setIsTracking(false);
        isTrackingRef.current = false;
        setLastLocation(null);
      }
    });
    return () => unsub();
  }, []);

  // ── Start ─────────────────────────────────────────────────────
  const start = useCallback(async (): Promise<void> => {
    if (isTrackingRef.current) return;

    const firebaseUser = getAuth().currentUser;               // ← modular ✅
    if (!firebaseUser || !employee?.id) {
      const msg = 'You must be signed in to start tracking.';
      setError(msg);
      throw new Error(msg);
    }

    setError(null);
    setIsStarting(true);

    try {
      await startTracking(employee.id);
      setIsTracking(true);
      isTrackingRef.current = true;
      snapLocation(true);
    } catch (e: any) {
      const message = e?.message ?? 'Failed to start tracking. Try again.';
      setError(message);
      throw e;
    } finally {
      setIsStarting(false);
    }
  }, [employee?.id, snapLocation]);

  // ── Stop ──────────────────────────────────────────────────────
  const stop = useCallback(async (): Promise<void> => {
    if (!isTrackingRef.current) return;

    setError(null);
    setIsStopping(true);

    try {
      await stopTracking(employeeIdRef.current);
      setIsTracking(false);
      isTrackingRef.current = false;
      setLastLocation(null);
    } catch (_) {
      setError('Failed to stop tracking cleanly.');
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