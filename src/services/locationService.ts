// src/services/locationService.ts
//
// KEY FIX: Firebase security rules use `auth.uid === $employeeId`.
// This means the RTDB path key MUST be the Firebase Auth UID, not the
// database employee record ID. Every public function now accepts and uses
// `firebaseUid` as the path key.
//
// Database path: tenants/{tenantId}/locations/{firebaseUid}
//                                                ↑
//                                         Must equal auth.uid

import Geolocation, {
  GeolocationResponse,
  GeolocationError,
} from '@react-native-community/geolocation';
import BackgroundActions from 'react-native-background-actions';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import {
  getDatabase,
  ref,
  update,
  onDisconnect,
} from '@react-native-firebase/database';
import { apiPost } from './api';
import { useOfflineStore } from '../store/offlineStore';

// ─── Module-level state ───────────────────────────────────────────────────────
// These are intentionally module-level so they survive React re-renders.
// They are protected by a mutex pattern to prevent race conditions.

let watchId:    number | null = null;
let bgInterval: ReturnType<typeof setInterval> | null = null;

// `isTracking` and `startLock` together form a mutex:
//   - `isTracking` reflects the settled state (started or stopped)
//   - `startLock` prevents concurrent start calls from racing past the guard
let isTracking = false;
let startLock  = false;

let _lastBattery:   number = 0;
let _lastBatteryAt: number = 0;

// ─── Battery ──────────────────────────────────────────────────────────────────

/** Cached battery level; refreshed at most once per minute */
async function getBattery(): Promise<number> {
  if (Date.now() - _lastBatteryAt > 60_000) {
    try {
      const raw = await DeviceInfo.getBatteryLevel();
      _lastBattery   = Math.min(100, Math.max(0, Math.round(raw * 100)));
      _lastBatteryAt = Date.now();
    } catch (e) {
      if (__DEV__) console.warn('[Tracking] getBattery() failed:', e);
    }
  }
  return _lastBattery;
}

// ─── Permissions ──────────────────────────────────────────────────────────────

export async function requestLocationPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  let foreground: string;
  try {
    foreground = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title:           'Location Permission',
        message:         'Employee Tracker needs your location for shift tracking.',
        buttonPositive:  'Allow',
        buttonNegative:  'Deny',
      },
    );
  } catch (e) {
    console.error('[Permissions] foreground request threw:', e);
    return false;
  }

  if (foreground !== PermissionsAndroid.RESULTS.GRANTED) {
    Alert.alert(
      'Permission Required',
      'Location permission is required for shift tracking. Please enable it in Settings.',
    );
    return false;
  }

  if (Number(Platform.Version) >= 29) {
    try {
      const background = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
        {
          title:           'Background Location',
          message:         'Allow "Always" location access so tracking continues when the app is minimised.',
          buttonPositive:  'Allow',
          buttonNegative:  'Skip',
        },
      );
      if (background !== PermissionsAndroid.RESULTS.GRANTED) {
        console.warn('[Permissions] Background location denied — foreground-only mode active');
      }
    } catch (e) {
      console.warn('[Permissions] background request threw:', e);
    }
  }

  return true;
}

// ─── Backend write ────────────────────────────────────────────────────────────

async function writeLocationToBackend(payload: {
  lat:       number;
  lng:       number;
  accuracy?: number | null;
  battery?:  number | null;
}): Promise<void> {
  const { isOnline } = useOfflineStore.getState();

  const body = {
    lat:      payload.lat,
    lng:      payload.lng,
    accuracy: payload.accuracy ?? null,
    battery:  payload.battery  ?? null,
  };

  if (!isOnline) {
    // Replace any previous unsynced ping — no point queueing stale coords
    useOfflineStore.setState((state) => ({
      queue: [
        ...state.queue.filter((r) => r.endpoint !== '/location/ping'),
        {
          id:        `ping-${Date.now()}`,
          endpoint:  '/location/ping',
          method:    'POST',
          body,
          createdAt: new Date().toISOString(),
          retries:   0,
        },
      ],
    }));
    if (__DEV__) console.log('[Tracking] Offline — location ping queued');
    return;
  }

  try {
    await apiPost('/location/ping', body);
  } catch (e) {
    // Non-fatal: RTDB already has the update; the REST endpoint is secondary
    console.warn('[API] /location/ping failed:', e);
  }
}

// ─── RTDB write ───────────────────────────────────────────────────────────────

/**
 * Write a location update to RTDB.
 *
 * @param tenantId    - Tenant ID (scopes the RTDB path)
 * @param firebaseUid - Firebase Auth UID — MUST match auth.uid per security rules.
 *                      This is NOT the database employee record ID.
 * @param employeeId  - DB employee record ID (stored as a field, not the path key)
 * @param payload     - Location data
 */
async function writeLocation(
  tenantId:    string,
  firebaseUid: string,
  employeeId:  string,
  payload: {
    lat:       number;
    lng:       number;
    accuracy?: number | null;
    battery?:  number | null;
  },
): Promise<void> {
  const recorded_at = new Date().toISOString();

  // Path key is firebaseUid — matches auth.uid === $employeeId rule
  const locRef = ref(getDatabase(), `tenants/${tenantId}/locations/${firebaseUid}`);

  try {
    await update(locRef, {
      employee_id:  employeeId,   // store the DB ID as a field for lookups
      firebase_uid: firebaseUid,
      lat:          payload.lat,
      lng:          payload.lng,
      accuracy:     payload.accuracy ?? null,
      battery:      payload.battery  ?? null,
      recorded_at,
      is_online:    true,
    });
  } catch (e) {
    console.warn('[RTDB] writeLocation failed:', e);
    throw e;
  }

  // Best-effort REST ping (non-blocking path)
  await writeLocationToBackend(payload);
}

// ─── Background task ──────────────────────────────────────────────────────────

interface BgTaskData {
  tenantId:    string;
  employeeId:  string;
  firebaseUid: string;
}

/**
 * Background task: polls GPS every 30 s and pushes to RTDB.
 *
 * The function must never return until BackgroundActions cancels it.
 * We implement this as a `while(true)` loop with a Promise-based sleep
 * instead of the original never-settling `new Promise(() => {...})`,
 * which leaked the interval on task termination.
 */
const backgroundTask = async (taskData: unknown): Promise<void> => {
  const data = taskData as Partial<BgTaskData> | null;

  if (!data?.tenantId || !data?.employeeId || !data?.firebaseUid) {
    console.error('[BG] Missing required taskData fields:', taskData);
    return;
  }

  const { tenantId, employeeId, firebaseUid } = data as BgTaskData;
  const POLL_INTERVAL_MS = 30_000;

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  while (true) {
    await new Promise<void>((resolve) => {
      Geolocation.getCurrentPosition(
        async (pos: GeolocationResponse) => {
          try {
            await writeLocation(tenantId, firebaseUid, employeeId, {
              lat:      pos.coords.latitude,
              lng:      pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              battery:  await getBattery(),
            });
          } catch (e) {
            console.warn('[BG] writeLocation error:', e);
          }
          resolve();
        },
        (err: GeolocationError) => {
          console.warn('[BG] GPS error:', err.message, err.code);
          resolve(); // don't stall the loop on GPS failure
        },
        { enableHighAccuracy: false, timeout: 10_000 },
      );
    });

    await sleep(POLL_INTERVAL_MS);
  }
};

const backgroundOptions = {
  taskName:              'LocationTracking',
  taskTitle:             'Shift Tracking Active',
  taskDesc:              'Your location is being shared with your team.',
  taskIcon:              { name: 'ic_launcher', type: 'mipmap' },
  color:                 '#01696f',
  linkingURI:            'employeetracker://tracking',
  foregroundServiceType: ['location'] as ['location'],
  parameters:            {} as BgTaskData,
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start location tracking.
 *
 * @param tenantId    - Tenant ID
 * @param employeeId  - DB employee record ID (stored as a field in RTDB)
 * @param firebaseUid - Firebase Auth UID (used as RTDB path key to satisfy security rules)
 */
export async function startTracking(
  tenantId:    string,
  employeeId:  string,
  firebaseUid: string,
): Promise<void> {
  // Mutex: prevent concurrent start calls
  if (isTracking || startLock) {
    console.warn('[Tracking] Already running or starting — ignoring duplicate start');
    return;
  }
  startLock = true;

  try {
    const granted = await requestLocationPermissions();
    if (!granted) return;

    // Path key is firebaseUid
    const locRef = ref(getDatabase(), `tenants/${tenantId}/locations/${firebaseUid}`);

    // Register onDisconnect BEFORE writing is_online: true
    // so the server-side cleanup fires even if the app crashes mid-start
    await onDisconnect(locRef).update({ is_online: false });

    await update(locRef, {
      employee_id:  employeeId,
      firebase_uid: firebaseUid,
      is_online:    true,
    });

    // Start foreground GPS watcher
    watchId = Geolocation.watchPosition(
      async (pos: GeolocationResponse) => {
        try {
          await writeLocation(tenantId, firebaseUid, employeeId, {
            lat:      pos.coords.latitude,
            lng:      pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            battery:  await getBattery(),
          });
        } catch (e) {
          console.warn('[GEO] writeLocation error in watcher:', e);
        }
      },
      (err: GeolocationError) => {
        console.warn('[GEO] watchPosition error:', err.message, err.code);
      },
      {
        enableHighAccuracy: true,
        distanceFilter:     15,
        interval:           10_000,
        fastestInterval:    5_000,
      },
    );

    // Start background service (Android foreground service / iOS background mode)
    if (!BackgroundActions.isRunning()) {
      await BackgroundActions.start(backgroundTask, {
        ...backgroundOptions,
        parameters: { tenantId, employeeId, firebaseUid },
      });
    }

    isTracking = true;
    if (__DEV__) console.log('[Tracking] Started ✅');
  } catch (e: unknown) {
    console.error('[Tracking] startTracking crashed:', e);
    // Best-effort rollback — don't re-throw from cleanup
    await stopTracking(tenantId, firebaseUid).catch(() => {});
    throw e;
  } finally {
    startLock = false;
  }
}

/**
 * Stop location tracking and mark the employee offline in RTDB.
 *
 * @param tenantId    - Tenant ID (optional; skips RTDB write if absent)
 * @param firebaseUid - Firebase Auth UID path key (optional; skips RTDB write if absent)
 */
export async function stopTracking(
  tenantId?:    string,
  firebaseUid?: string,
): Promise<void> {
  // Clear tracking state immediately so any in-flight watcher callbacks
  // won't queue new writes after stop is called.
  isTracking = false;

  // ── Mark employee offline in RTDB ────────────────────────────────────────
  if (tenantId && firebaseUid) {
    try {
      const locRef = ref(getDatabase(), `tenants/${tenantId}/locations/${firebaseUid}`);
      // Cancel the onDisconnect handler first, then write explicitly
      await onDisconnect(locRef).cancel();
      await update(locRef, { is_online: false });
    } catch (e) {
      console.warn('[RTDB] Failed to mark employee offline:', e);
      // Non-fatal: the onDisconnect handler set during startTracking
      // will fire when the connection drops, cleaning up server-side.
    }
  }

  // ── Clear foreground watcher ──────────────────────────────────────────────
  if (watchId !== null) {
    try {
      Geolocation.clearWatch(watchId);
    } catch (e) {
      console.warn('[GEO] clearWatch error:', e);
    }
    watchId = null;
  }

  // ── Clear legacy interval (kept for safety; backgroundTask no longer uses it) ─
  if (bgInterval !== null) {
    clearInterval(bgInterval);
    bgInterval = null;
  }

  // ── Stop background service ───────────────────────────────────────────────
  try {
    if (BackgroundActions.isRunning()) {
      await BackgroundActions.stop();
    }
  } catch (e) {
    console.warn('[Tracking] BackgroundActions.stop() error:', e);
  }

  if (__DEV__) console.log('[Tracking] Stopped ✅');
}

/** Returns true if location tracking is currently active */
export function getIsTracking(): boolean {
  return isTracking;
}