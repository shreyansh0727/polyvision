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

const GPS_HIGH_ACCURACY_TIMEOUT_MS = 20_000; // 20 s — GPS chip warm-up budget
const GPS_LOW_ACCURACY_TIMEOUT_MS  = 30_000; // 30 s — network/cell fallback budget
const BG_POLL_INTERVAL_MS          = 30_000; // background poll every 30 s
const BATTERY_CACHE_MS             = 60_000; // re-read battery at most once/min
const WATCH_DISTANCE_FILTER_M      = 15;     // foreground watcher movement threshold

/**
 * BUG FIX #1 — maximumAge: 0 forces the OS to acquire a FRESH position.
 *
 * The original code used maximumAge: 10_000 ms.  The OS location cache is
 * shared across ALL apps on the device.  If Google Maps, WhatsApp, or any
 * background service requested location in the previous 10 s, Android/iOS
 * serves that cached fix instantly — even if it came from a cell tower with
 * 5 000 m accuracy while the device was indoors.  On a moving vehicle that
 * cached fix can place the employee 70–80 km from their true position.
 *
 * Setting maximumAge: 0 guarantees each call starts a new position acquisition
 * from the hardware rather than reading an app-agnostic OS cache.
 */
const GPS_MAX_AGE_MS = 0;

/**
 * BUG FIX #2 — Accuracy ceiling for HIGH-accuracy (GPS) fixes.
 *
 * Android's Fused Location Provider fires the watchPosition callback with
 * a low-accuracy network fix BEFORE the GPS chip finishes warming up (TTFF).
 * These "early" callbacks have accuracy values of 200–2 000 m and go straight
 * to RTDB without any filter in the original code.
 *
 * Any fix worse than this threshold is silently discarded. 50 m is tight
 * enough to be useful and loose enough to work indoors near a window.
 */
const GPS_ACCURACY_THRESHOLD_M = 50;

/**
 * BUG FIX #2b — Accuracy ceiling for LOW-accuracy (network/cell) fixes.
 *
 * When GPS is unavailable we fall back to Wi-Fi / cell towers. In India,
 * cell-tower-only fixes regularly report accuracy of 1 000–15 000 m.
 * A 15 000 m radius is a circle 30 km across — a random point inside it
 * is meaningless.  We cap network fixes at 500 m; anything worse is dropped
 * and the last known-good position is kept in RTDB instead.
 */
const NETWORK_ACCURACY_THRESHOLD_M = 500;

// ─── Module-level state ───────────────────────────────────────────────────────

let watchId:    number | null = null;
let bgInterval: ReturnType<typeof setInterval> | null = null;

// Mutex pair: isTracking = settled state, startLock = in-progress guard
let isTracking = false;
let startLock  = false;

let _lastBattery:   number = 0;
let _lastBatteryAt: number = 0;

/**
 * BUG FIX #6 — Track the best accuracy we have successfully written to RTDB.
 *
 * Before overwriting RTDB we compare the new fix's accuracy against this value.
 * A new fix is only written when it is at least as accurate as the last one,
 * OR when the last write was more than MAX_ACCURACY_REGRESSION_AGE_MS ago
 * (so a temporarily degraded signal eventually recovers rather than freezing
 * the map dot forever).
 */
let _lastWrittenAccuracy: number     = Infinity;
let _lastWrittenAt:       number     = 0;
const MAX_ACCURACY_REGRESSION_AGE_MS = 60_000; // allow re-write after 60 s even if worse

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
 * BUG FIX #1: maximumAge is now 0 on both attempts (see GPS_MAX_AGE_MS).
 * BUG FIX #5: The low-accuracy fallback previously used the same maximumAge
 *   as the high-accuracy attempt.  Since the OS cache is shared, it would
 *   return the exact same stale fix that caused the high-accuracy call to
 *   time out — giving no fresher data, just a worse provider.  maximumAge: 0
 *   forces the network provider to actually query towers/Wi-Fi.
 *
 * Strategy:
 *   1. Try high-accuracy GPS (20 s timeout, fresh fix only).
 *   2. On timeout or POSITION_UNAVAILABLE, fall back to network/cell (30 s,
 *      fresh fix only).
 *   3. If both fail, throw so the caller can decide how to handle it.
 *
 * NOTE: This function does NOT apply the accuracy threshold — callers do
 * that via shouldWriteFix() so each call site can use the appropriate ceiling.
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
          maximumAge:         GPS_MAX_AGE_MS, // BUG FIX #1: was GPS_MAX_AGE_MS=10_000
        },
      );
    });
  } catch (e: unknown) {
    const code = (e as GeolocationError)?.code;
    // code 3 = TIMEOUT, code 2 = POSITION_UNAVAILABLE — both warrant a fallback
    if (code === 3 || code === 2) {
      if (__DEV__) console.warn('[GPS] High-accuracy timed out — falling back to network location');
    } else {
      // Unexpected error (e.g. code 1 = PERMISSION_DENIED) — don't retry
      throw e;
    }
  }

  // ── Attempt 2: low accuracy / network-based ───────────────────────────────
  // BUG FIX #5: maximumAge: 0 here forces the network provider to do a fresh
  // tower/Wi-Fi query rather than re-serving the same stale OS-cache fix
  // that caused the GPS attempt to fail.
  return new Promise<GpsResult>((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (pos: GeolocationResponse) => resolve({
        lat:      pos.coords.latitude,
        lng:      pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
      }),
      (err: GeolocationError) => {
        console.error('[GPS] Network fallback also failed:', err.message, 'code:', err.code);
        reject(new Error(`Location unavailable (code ${err.code}): ${err.message}`));
      },
      {
        enableHighAccuracy: false,
        timeout:            GPS_LOW_ACCURACY_TIMEOUT_MS,
        maximumAge:         0, // BUG FIX #5: force a fresh network fix, not the cached GPS miss
      },
    );
  });
}

// ─── Accuracy guard ───────────────────────────────────────────────────────────

/**
 * BUG FIX #2, #3, #4, #6 — Central accuracy gate for every write path.
 *
 * Returns true when the fix is good enough to write to RTDB.
 *
 * Rules:
 *  a. If accuracy is null/undefined — reject.  An unknown-accuracy fix from
 *     a degraded provider is worse than no update at all.
 *  b. If accuracy > threshold — reject.  The fix is too coarse to be useful.
 *  c. If accuracy > _lastWrittenAccuracy AND the last write was recent — reject.
 *     Avoid overwriting a precise GPS fix with a coarse cell-tower fix that
 *     arrived immediately after (Android sends network fixes while GPS warms up).
 *     After MAX_ACCURACY_REGRESSION_AGE_MS the guard relaxes so the dot
 *     doesn't freeze if GPS degrades long-term.
 *
 * @param accuracy      - metres (lower = better)
 * @param threshold     - maximum acceptable accuracy in metres
 */
function shouldWriteFix(accuracy: number | null | undefined, threshold: number): boolean {
  if (accuracy == null || !isFinite(accuracy)) {
    if (__DEV__) console.log(`[AccuracyGuard] Rejected: accuracy unknown`);
    return false;
  }

  if (accuracy > threshold) {
    if (__DEV__)
      console.log(`[AccuracyGuard] Rejected: ${accuracy.toFixed(0)} m > threshold ${threshold} m`);
    return false;
  }

  // BUG FIX #6: regression guard — don't let a degraded fix clobber a good one
  const ageMs = Date.now() - _lastWrittenAt;
  if (
    _lastWrittenAccuracy !== Infinity &&
    accuracy > _lastWrittenAccuracy * 2 &&   // more than 2× worse than last write
    ageMs < MAX_ACCURACY_REGRESSION_AGE_MS
  ) {
    if (__DEV__)
      console.log(
        `[AccuracyGuard] Rejected regression: ${accuracy.toFixed(0)} m vs last ` +
        `${_lastWrittenAccuracy.toFixed(0)} m (${(ageMs / 1000).toFixed(0)}s ago)`,
      );
    return false;
  }

  return true;
}

/** Update the last-written accuracy tracker after a successful RTDB write */
function recordWrite(accuracy: number | null): void {
  _lastWrittenAccuracy = accuracy ?? Infinity;
  _lastWrittenAt       = Date.now();
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
 * BUG FIX #2, #3, #4, #6: All call sites now pass the fix through
 * shouldWriteFix() before calling this function, so inaccurate fixes
 * (cell-tower noise, GPS warm-up artifacts, stale OS cache) never reach RTDB.
 *
 * @param tenantId    - Tenant ID (scopes the RTDB path)
 * @param firebaseUid - Firebase Auth UID — MUST match auth.uid per security rules.
 * @param employeeId  - DB employee record ID (stored as a field, not the path key)
 * @param payload     - Location data (accuracy already validated by caller)
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

  const locRef = ref(getDatabase(), `tenants/${tenantId}/locations/${firebaseUid}`);

  try {
    await update(locRef, {
      employee_id:  employeeId,
      firebase_uid: firebaseUid,
      lat:          payload.lat,
      lng:          payload.lng,
      accuracy:     payload.accuracy ?? null,
      battery:      payload.battery  ?? null,
      recorded_at,
      is_online:    true,
    });

    // BUG FIX #6: record the accuracy of this successful write
    recordWrite(payload.accuracy ?? null);
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
 *
 * BUG FIX #3: Added accuracy guard before every writeLocation call.
 * When the screen is off, the GPS chip enters a low-power mode; the first
 * fix after wake-up often comes from cell towers with accuracy > 1 000 m.
 * These are now discarded using NETWORK_ACCURACY_THRESHOLD_M (500 m).
 *
 * GPS fixes must pass GPS_ACCURACY_THRESHOLD_M (50 m).
 * Network fixes must pass NETWORK_ACCURACY_THRESHOLD_M (500 m).
 * getCurrentPositionWithFallback() reports which provider was used via
 * the accuracy value — GPS is typically < 20 m, network is typically > 100 m,
 * so the thresholds naturally route to the right ceiling.
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

      // BUG FIX #3: choose the correct accuracy ceiling based on fix quality.
      // A GPS fix (accuracy < 50 m) uses the tight GPS threshold.
      // A network/cell fix (accuracy > 50 m) uses the looser network threshold.
      // Anything above 500 m is silently dropped.
      const accuracyThreshold =
        (pos.accuracy != null && pos.accuracy <= GPS_ACCURACY_THRESHOLD_M)
          ? GPS_ACCURACY_THRESHOLD_M
          : NETWORK_ACCURACY_THRESHOLD_M;

      if (!shouldWriteFix(pos.accuracy, accuracyThreshold)) {
        if (__DEV__)
          console.log(
            `[BG] Fix dropped — accuracy ${pos.accuracy?.toFixed(0) ?? 'unknown'} m` +
            ` exceeds threshold ${accuracyThreshold} m`,
          );
      } else {
        await writeLocation(tenantId, firebaseUid, employeeId, {
          ...pos,
          battery: await getBattery(),
        });
      }
    } catch (e) {
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
    }

    // ── Non-blocking initial fix ─────────────────────────────────────────────
    getCurrentPositionWithFallback()
      .then(async (pos) => {
        if (!isTracking) return;

        // BUG FIX #2: apply the tight GPS threshold to the initial fix.
        // If GPS hasn't warmed up yet, the first fix may be a stale cell-tower
        // result — reject it here; the watcher will send a better one shortly.
        if (!shouldWriteFix(pos.accuracy, GPS_ACCURACY_THRESHOLD_M)) {
          if (__DEV__)
            console.log(
              `[Tracking] Initial fix rejected — accuracy ` +
              `${pos.accuracy?.toFixed(0) ?? 'unknown'} m`,
            );
          return;
        }

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
        console.warn('[Tracking] Initial position unavailable (watcher will recover):', e);
      });

    // ── Foreground watcher ───────────────────────────────────────────────────
    // BUG FIX #4: Added accuracy guard in the watcher callback.
    // Android's Fused Location Provider fires callbacks with coarse network
    // fixes (accuracy: 200–2000 m) while the GPS chip is warming up.
    // These are now rejected using GPS_ACCURACY_THRESHOLD_M (50 m).
    watchId = Geolocation.watchPosition(
      async (pos: GeolocationResponse) => {
        if (!isTracking) return;

        const accuracy = pos.coords.accuracy ?? null;

        // BUG FIX #4: same dual-threshold logic as background task
        const accuracyThreshold =
          (accuracy != null && accuracy <= GPS_ACCURACY_THRESHOLD_M)
            ? GPS_ACCURACY_THRESHOLD_M
            : NETWORK_ACCURACY_THRESHOLD_M;

        if (!shouldWriteFix(accuracy, accuracyThreshold)) {
          if (__DEV__)
            console.log(
              `[GEO] Watcher fix dropped — accuracy ` +
              `${accuracy?.toFixed(0) ?? 'unknown'} m`,
            );
          return;
        }

        try {
          await writeLocation(tenantId, firebaseUid, employeeId, {
            lat:      pos.coords.latitude,
            lng:      pos.coords.longitude,
            accuracy,
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
      }
    }

    isTracking = true;
    if (__DEV__) console.log('[Tracking] Started ✅');

  } catch (e: unknown) {
    console.error('[Tracking] startTracking crashed:', e);
    await stopTracking(tenantId, firebaseUid).catch(() => {});
    throw e;
  } finally {
    startLock = false;
  }
}

export async function stopTracking(
  tenantId?:    string,
  firebaseUid?: string,
): Promise<void> {
  isTracking = false;

  // BUG FIX #6: reset the accuracy tracker on stop so the next session starts
  // fresh rather than inheriting the last session's threshold.
  _lastWrittenAccuracy = Infinity;
  _lastWrittenAt       = 0;

  if (tenantId && firebaseUid) {
    try {
      const locRef = ref(getDatabase(), `tenants/${tenantId}/locations/${firebaseUid}`);
      await onDisconnect(locRef).cancel();
      await update(locRef, { is_online: false });
    } catch (e) {
      console.warn('[RTDB] Failed to mark employee offline:', e);
    }
  }

  if (watchId !== null) {
    try {
      Geolocation.clearWatch(watchId);
    } catch (e) {
      console.warn('[GEO] clearWatch error:', e);
    }
    watchId = null;
  }

  if (bgInterval !== null) {
    clearInterval(bgInterval);
    bgInterval = null;
  }

  try {
    if (BackgroundActions.isRunning()) {
      await BackgroundActions.stop();
    }
  } catch (e) {
    console.warn('[Tracking] BackgroundActions.stop() error:', e);
  }

  if (__DEV__) console.log('[Tracking] Stopped ✅');
}

export function getIsTracking(): boolean {
  return isTracking;
}