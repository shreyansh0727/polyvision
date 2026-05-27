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

// ─── Constants ────────────────────────────────────────────────────────────────

const GPS_HIGH_ACCURACY_TIMEOUT_MS = 20_000;  // 20 s — high accuracy first attempt
const GPS_LOW_ACCURACY_TIMEOUT_MS  = 30_000;  // 30 s — fallback
const GPS_MAX_AGE_MS               = 10_000;  // accept a cached fix up to 10 s old
const BG_POLL_INTERVAL_MS          = 30_000;  // background poll every 30 s
const BATTERY_CACHE_MS             = 60_000;  // re-read battery at most once/min
const WATCH_DISTANCE_FILTER_M      = 15;      // foreground watcher movement threshold

// ─── Module-level state ───────────────────────────────────────────────────────

let watchId:    number | null = null;
let bgInterval: ReturnType<typeof setInterval> | null = null;

// Mutex pair: isTracking = settled state, startLock = in-progress guard
let isTracking = false;
let startLock  = false;

let _lastBattery:   number = 0;
let _lastBatteryAt: number = 0;

// ─── Battery ──────────────────────────────────────────────────────────────────

/** Cached battery level; refreshed at most once per minute */
async function getBattery(): Promise<number> {
  if (Date.now() - _lastBatteryAt > BATTERY_CACHE_MS) {
    try {
      const raw      = await DeviceInfo.getBatteryLevel();
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
        title:          'Location Permission',
        message:        'Employee Tracker needs your location for shift tracking.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
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
          title:          'Background Location',
          message:        'Allow "Always" location access so tracking continues when the app is minimised.',
          buttonPositive: 'Allow',
          buttonNegative: 'Skip',
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

// ─── GPS helpers ──────────────────────────────────────────────────────────────

interface GpsResult {
  lat:      number;
  lng:      number;
  accuracy: number | null;
}

/**
 * Get current position with automatic high→low accuracy fallback.
 *
 * Strategy:
 *   1. Try high-accuracy GPS (20 s timeout).
 *   2. On timeout or error, fall back to network/passive location (30 s timeout).
 *   3. If both fail, throw so the caller can decide how to handle it.
 */
async function getCurrentPositionWithFallback(): Promise<GpsResult> {
  // ── Attempt 1: high accuracy ─────────────────────────────────────────────
  try {
    return await new Promise<GpsResult>((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (pos: GeolocationResponse) => resolve({
          lat:      pos.coords.latitude,
          lng:      pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
        }),
        (err: GeolocationError) => reject(err),
        {
          enableHighAccuracy: true,
          timeout:            GPS_HIGH_ACCURACY_TIMEOUT_MS,
          maximumAge:         GPS_MAX_AGE_MS,
        },
      );
    });
  } catch (e: unknown) {
    const code = (e as GeolocationError)?.code;
    // code 3 = TIMEOUT, code 2 = POSITION_UNAVAILABLE — both warrant a fallback
    if (code === 3 || code === 2) {
      if (__DEV__) console.warn('[GPS] High-accuracy timed out — falling back to low accuracy');
    } else {
      // Unexpected error (e.g. code 1 = PERMISSION_DENIED) — don't retry
      throw e;
    }
  }

  // ── Attempt 2: low accuracy / network-based ───────────────────────────────
  return new Promise<GpsResult>((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (pos: GeolocationResponse) => resolve({
        lat:      pos.coords.latitude,
        lng:      pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
      }),
      (err: GeolocationError) => {
        console.error('[GPS] Low-accuracy fallback also failed:', err.message, 'code:', err.code);
        reject(new Error(`Location unavailable (code ${err.code}): ${err.message}`));
      },
      {
        enableHighAccuracy: false,
        timeout:            GPS_LOW_ACCURACY_TIMEOUT_MS,
        maximumAge:         GPS_MAX_AGE_MS,
      },
    );
  });
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
    // Non-fatal: RTDB already has the update; REST endpoint is secondary
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

  // Best-effort REST ping (non-blocking)
  writeLocationToBackend(payload).catch(() => {});
}

// ─── Background task ──────────────────────────────────────────────────────────

interface BgTaskData {
  tenantId:    string;
  employeeId:  string;
  firebaseUid: string;
}

/**
 * Background task: polls GPS every 30 s and pushes to RTDB.
 * Uses the high→low accuracy fallback so indoor devices don't stall.
 */
const backgroundTask = async (taskData: unknown): Promise<void> => {
  const data = taskData as Partial<BgTaskData> | null;

  if (!data?.tenantId || !data?.employeeId || !data?.firebaseUid) {
    console.error('[BG] Missing required taskData fields:', taskData);
    return;
  }

  const { tenantId, employeeId, firebaseUid } = data as BgTaskData;
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  while (true) {
    try {
      const pos = await getCurrentPositionWithFallback();
      await writeLocation(tenantId, firebaseUid, employeeId, {
        ...pos,
        battery: await getBattery(),
      });
    } catch (e) {
      // Log but never crash the loop — next iteration will retry
      console.warn('[BG] GPS/write error (will retry next cycle):', (e as Error)?.message ?? e);
    }

    await sleep(BG_POLL_INTERVAL_MS);
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
 * CHANGE: The initial GPS fix is now non-blocking. Tracking starts immediately
 * (watcher + background service), and the first RTDB write happens as soon as
 * a position is available — even if that takes 30+ seconds on weak signal.
 * This prevents the "location request timed out" crash on slow GPS devices.
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
  if (isTracking || startLock) {
    console.warn('[Tracking] Already running or starting — ignoring duplicate start');
    return;
  }
  startLock = true;

  try {
    const granted = await requestLocationPermissions();
    if (!granted) {
      startLock = false;
      return;
    }

    const locRef = ref(getDatabase(), `tenants/${tenantId}/locations/${firebaseUid}`);

    // Register onDisconnect BEFORE anything else so it's set even if GPS is slow
    try {
      await onDisconnect(locRef).update({ is_online: false });
    } catch (e) {
      console.warn('[RTDB] onDisconnect setup failed:', e);
      // Non-fatal — continue starting tracking
    }

    // ── Non-blocking initial fix ─────────────────────────────────────────────
    // Fire-and-forget: kick off a position request in the background.
    // If it succeeds quickly, RTDB gets an immediate update.
    // If it's slow (indoor, weak signal), tracking is already running via the
    // watcher and background task — the user isn't shown a timeout error.
    getCurrentPositionWithFallback()
      .then(async (pos) => {
        if (!isTracking) return; // aborted before fix arrived
        try {
          await writeLocation(tenantId, firebaseUid, employeeId, {
            ...pos,
            battery: await getBattery(),
          });
          if (__DEV__) console.log('[Tracking] Initial fix written ✅', pos);
        } catch (e) {
          console.warn('[Tracking] Initial RTDB write failed:', e);
        }
      })
      .catch((e) => {
        // Both high and low accuracy failed — the watcher will still push
        // updates whenever the device gets a fix.
        console.warn('[Tracking] Initial position unavailable (watcher will recover):', e);
      });

    // ── Foreground watcher ───────────────────────────────────────────────────
    watchId = Geolocation.watchPosition(
      async (pos: GeolocationResponse) => {
        if (!isTracking) return;
        try {
          await writeLocation(tenantId, firebaseUid, employeeId, {
            lat:      pos.coords.latitude,
            lng:      pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? null,
            battery:  await getBattery(),
          });
        } catch (e) {
          console.warn('[GEO] writeLocation error in watcher:', e);
        }
      },
      (err: GeolocationError) => {
        console.warn('[GEO] watchPosition error:', err.message, 'code:', err.code);
      },
      {
        enableHighAccuracy: true,
        distanceFilter:     WATCH_DISTANCE_FILTER_M,
        interval:           10_000,
        fastestInterval:    5_000,
      },
    );

    // ── Background service ───────────────────────────────────────────────────
    if (!BackgroundActions.isRunning()) {
      try {
        await BackgroundActions.start(backgroundTask, {
          ...backgroundOptions,
          parameters: { tenantId, employeeId, firebaseUid },
        });
      } catch (e) {
        console.warn('[Tracking] BackgroundActions.start() failed:', e);
        // Non-fatal — foreground watcher is still active
      }
    }

    isTracking = true;
    if (__DEV__) console.log('[Tracking] Started ✅');

  } catch (e: unknown) {
    console.error('[Tracking] startTracking crashed:', e);
    // Clean up any partial state
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
  // Clear immediately so any in-flight watcher callbacks won't write after stop
  isTracking = false;

  // ── Mark employee offline in RTDB ────────────────────────────────────────
  if (tenantId && firebaseUid) {
    try {
      const locRef = ref(getDatabase(), `tenants/${tenantId}/locations/${firebaseUid}`);
      await onDisconnect(locRef).cancel();
      await update(locRef, { is_online: false });
    } catch (e) {
      console.warn('[RTDB] Failed to mark employee offline:', e);
      // Non-fatal: onDisconnect handler will fire when connection drops
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

  // ── Clear legacy interval ─────────────────────────────────────────────────
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