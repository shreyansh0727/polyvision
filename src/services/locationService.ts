// src/services/locationService.ts
import Geolocation, {
  GeolocationResponse,
  GeolocationError,
}                        from '@react-native-community/geolocation';
import BackgroundActions from 'react-native-background-actions';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import DeviceInfo        from 'react-native-device-info';
import {
  getDatabase,
  ref,
  update,
  onDisconnect,
}                        from '@react-native-firebase/database';
import { apiPost }       from './api';

let watchId:    number | null                         = null;
let bgInterval: ReturnType<typeof setInterval> | null = null;
let isTracking  = false;

// ── Accuracy constants ────────────────────────────────────────────
//
// FIX #1 — maximumAge 0: forces a fresh hardware fix instead of reading the
// shared OS location cache. The cache is written by every app (Maps, WhatsApp,
// system services) so a 10-second-old cached fix can be 70-80 km stale on a
// moving vehicle.
const GPS_MAX_AGE_MS = 0;

// FIX #2 — GPS fixes (enableHighAccuracy: true) must be ≤ 50 m.
// Android fires the watcher with a coarse network fix (200-2000 m) while the
// GPS chip is still warming up. These early callbacks go to RTDB unfiltered
// in the original code and place the dot kilometres away.
const GPS_ACCURACY_THRESHOLD_M = 50;

// FIX #2b — Network/cell fixes (enableHighAccuracy: false, used in BG task)
// must be ≤ 500 m. Indian cell towers report 1000-15000 m accuracy when GPS
// is unavailable; anything coarser than 500 m is meaningless on a map.
const NETWORK_ACCURACY_THRESHOLD_M = 500;

// FIX #6 — Regression guard: don't let a degraded network fix overwrite a
// precise GPS fix. Relaxes after 60 s so the dot doesn't freeze permanently.
let _lastWrittenAccuracy                  = Infinity;
let _lastWrittenAt                        = 0;
const MAX_ACCURACY_REGRESSION_AGE_MS      = 60_000;

function shouldWriteFix(accuracy: number | null | undefined, threshold: number): boolean {
  if (accuracy == null || !isFinite(accuracy)) return false;
  if (accuracy > threshold) return false;

  const ageMs = Date.now() - _lastWrittenAt;
  if (
    _lastWrittenAccuracy !== Infinity &&
    accuracy > _lastWrittenAccuracy * 2 &&
    ageMs < MAX_ACCURACY_REGRESSION_AGE_MS
  ) {
    return false;
  }
  return true;
}

// ── Battery throttle ──────────────────────────────────────────────
let _lastBattery   = 0;
let _lastBatteryAt = 0;
async function getBattery(): Promise<number> {
  if (Date.now() - _lastBatteryAt > 60_000) {
    _lastBattery   = Math.round((await DeviceInfo.getBatteryLevel()) * 100);
    _lastBatteryAt = Date.now();
  }
  return _lastBattery;
}

// ── Permission Request ────────────────────────────────────────────
export async function requestLocationPermissions(): Promise<boolean> {
  if (Platform.OS === 'ios') return true;

  const foreground = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title:          'Location Permission',
      message:        'Employee Tracker needs your location for shift tracking.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    },
  );

  if (foreground !== PermissionsAndroid.RESULTS.GRANTED) {
    Alert.alert(
      'Permission Required',
      'Location permission is required for shift tracking. Please enable it in Settings.',
    );
    return false;
  }

  if (Number(Platform.Version) >= 29) {
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
      console.warn('[Permissions] Background location denied — foreground-only mode');
    }
  }

  return true;
}

// ── Write to backend ──────────────────────────────────────────────
async function writeLocationToBackend(
  payload: { lat: number; lng: number; accuracy?: number | null; battery?: number | null },
): Promise<void> {
  try {
    await apiPost('/location/ping', {
      lat:      payload.lat,
      lng:      payload.lng,
      accuracy: payload.accuracy ?? null,
      battery:  payload.battery  ?? null,
    });
  } catch (e) {
    console.warn('[API] /location/ping failed:', e);
  }
}

// ── Write to Firebase RTDB + backend ─────────────────────────────
// CHANGED: accepts tenantId + firebaseUid; path is now
//   tenants/{tenantId}/locations/{firebaseUid}
// employee_id and firebase_uid are stored as fields inside the node.
async function writeLocation(
  tenantId:    string,
  firebaseUid: string,
  employeeId:  string,
  payload: { lat: number; lng: number; accuracy?: number | null; battery?: number | null },
): Promise<void> {
  const recorded_at = new Date().toISOString();

  try {
    // CHANGED: DB ref path
    const locRef = ref(getDatabase(), `tenants/${tenantId}/locations/${firebaseUid}`);
    await update(locRef, {
      employee_id:  employeeId,   // DB record ID stored as a field
      firebase_uid: firebaseUid,  // mirrors the path key for easy reads
      lat:          payload.lat,
      lng:          payload.lng,
      accuracy:     payload.accuracy ?? null,
      battery:      payload.battery  ?? null,
      recorded_at,
      is_online:    true,
    });

    // FIX #6: record accuracy of the successful write for the regression guard
    _lastWrittenAccuracy = payload.accuracy ?? Infinity;
    _lastWrittenAt       = Date.now();
  } catch (e) {
    console.warn('[RTDB] writeLocation failed:', e);
  }

  await writeLocationToBackend(payload);
}

// ── Background Task ───────────────────────────────────────────────
// CHANGED: taskData now carries tenantId + firebaseUid alongside employeeId.
// FIX #3: accuracy guard added before writeLocation so coarse cell-tower
//         fixes (accuracy > 500 m) are dropped while the phone is asleep.
const backgroundTask = async (taskData: any): Promise<void> => {
  const { tenantId, employeeId, firebaseUid } = taskData ?? {};
  if (!tenantId || !employeeId || !firebaseUid) {
    console.error('[BG] Missing tenantId / employeeId / firebaseUid in taskData');
    return;
  }

  await new Promise<void>(() => {
    bgInterval = setInterval(() => {
      Geolocation.getCurrentPosition(
        async (pos: GeolocationResponse) => {
          const accuracy = pos.coords.accuracy ?? null;

          // FIX #3: BG task uses enableHighAccuracy:false (network/cell).
          // Use the tighter GPS threshold if the fix happens to be GPS-quality,
          // otherwise apply the network ceiling.
          const threshold =
            accuracy != null && accuracy <= GPS_ACCURACY_THRESHOLD_M
              ? GPS_ACCURACY_THRESHOLD_M
              : NETWORK_ACCURACY_THRESHOLD_M;

          if (!shouldWriteFix(accuracy, threshold)) {
            console.warn(`[BG] Fix dropped — accuracy ${accuracy?.toFixed(0) ?? 'unknown'} m`);
            return;
          }

          await writeLocation(tenantId, firebaseUid, employeeId, {
            lat:      pos.coords.latitude,
            lng:      pos.coords.longitude,
            accuracy,
            battery:  await getBattery(),
          });
        },
        (err: GeolocationError) => console.warn('[BG] GPS error:', err.message),
        // FIX #1: maximumAge 0 — no stale OS-cache fix
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: GPS_MAX_AGE_MS },
      );
    }, 30_000);
  });
};

// ── Android foreground service config ────────────────────────────
const backgroundOptions = {
  taskName:              'LocationTracking',
  taskTitle:             'Shift Tracking Active',
  taskDesc:              'Your location is being shared with your team.',
  taskIcon:              { name: 'ic_launcher', type: 'mipmap' },
  color:                 '#01696f',
  linkingURI:            'employeetracker://tracking',
  foregroundServiceType: ['location'] as ['location'],
  parameters:            {} as any,
};

// ── Start Tracking ────────────────────────────────────────────────
// CHANGED: signature now accepts tenantId + firebaseUid for the RTDB path.
export async function startTracking(
  tenantId:    string,
  employeeId:  string,
  firebaseUid: string,
): Promise<void> {
  if (isTracking) {
    console.warn('[Tracking] Already running — ignoring duplicate start');
    return;
  }

  try {
    const granted = await requestLocationPermissions();
    if (!granted) return;

    // CHANGED: DB ref path
    const locRef = ref(getDatabase(), `tenants/${tenantId}/locations/${firebaseUid}`);
    await onDisconnect(locRef).update({ is_online: false });
    await update(locRef, { is_online: true });

    // FIX #4: accuracy guard in the watcher callback.
    // The Fused Location Provider emits a coarse network fix (200-2000 m)
    // before the GPS chip has a lock. shouldWriteFix() drops these so they
    // never overwrite a previously-good position in RTDB.
    watchId = Geolocation.watchPosition(
      async (pos: GeolocationResponse) => {
        const accuracy = pos.coords.accuracy ?? null;

        const threshold =
          accuracy != null && accuracy <= GPS_ACCURACY_THRESHOLD_M
            ? GPS_ACCURACY_THRESHOLD_M
            : NETWORK_ACCURACY_THRESHOLD_M;

        if (!shouldWriteFix(accuracy, threshold)) {
          console.warn(`[GEO] Fix dropped — accuracy ${accuracy?.toFixed(0) ?? 'unknown'} m`);
          return;
        }

        await writeLocation(tenantId, firebaseUid, employeeId, {
          lat:      pos.coords.latitude,
          lng:      pos.coords.longitude,
          accuracy,
          battery:  await getBattery(),
        });
      },
      (err: GeolocationError) => console.warn('[GEO]', err.message),
      {
        enableHighAccuracy: true,
        distanceFilter:     15,
        interval:           10_000,
        fastestInterval:    5_000,
        // FIX #1: no stale OS-cache fix in the watcher either
        maximumAge:         GPS_MAX_AGE_MS,
      },
    );

    if (!BackgroundActions.isRunning()) {
      await BackgroundActions.start(backgroundTask, {
        ...backgroundOptions,
        // CHANGED: pass tenantId + firebaseUid so the BG task has the full path
        parameters: { tenantId, employeeId, firebaseUid },
      });
    }

    isTracking = true;
    console.log('[Tracking] Started ✅');
  } catch (e: any) {
    console.error('[Tracking] startTracking crashed:', e);
    await stopTracking(tenantId, firebaseUid);
    throw e;
  }
}

// ── Stop Tracking ─────────────────────────────────────────────────
// CHANGED: parameter is now firebaseUid (the RTDB path key) not employeeId.
export async function stopTracking(
  tenantId?:    string,
  firebaseUid?: string,
): Promise<void> {
  isTracking = false;

  // FIX #6: reset accuracy state so next session starts clean
  _lastWrittenAccuracy = Infinity;
  _lastWrittenAt       = 0;

  if (tenantId && firebaseUid) {
    try {
      // CHANGED: DB ref path
      const locRef = ref(getDatabase(), `tenants/${tenantId}/locations/${firebaseUid}`);
      await onDisconnect(locRef).cancel();
      await update(locRef, { is_online: false });
    } catch (e) {
      console.warn('[RTDB] Failed to mark offline:', e);
    }
  }

  if (watchId !== null) {
    Geolocation.clearWatch(watchId);
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

  console.log('[Tracking] Stopped ✅');
}

export function getIsTracking(): boolean {
  return isTracking;
}