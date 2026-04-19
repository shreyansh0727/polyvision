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
async function writeLocation(
  employeeId: string,
  payload: { lat: number; lng: number; accuracy?: number | null; battery?: number | null },
): Promise<void> {
  const recorded_at = new Date().toISOString();

  try {
    const locRef = ref(getDatabase(), `live_locations/${employeeId}`);
    await update(locRef, {
      lat:         payload.lat,
      lng:         payload.lng,
      accuracy:    payload.accuracy ?? null,
      battery:     payload.battery  ?? null,
      recorded_at,
      is_online:   true,
    });
  } catch (e) {
    console.warn('[RTDB] writeLocation failed:', e);
  }

  await writeLocationToBackend(payload);
}

// ── Background Task ───────────────────────────────────────────────
const backgroundTask = async (taskData: any): Promise<void> => {
  const { employeeId } = taskData ?? {};
  if (!employeeId) {
    console.error('[BG] Missing employeeId in taskData');
    return;
  }

  await new Promise<void>(() => {
    bgInterval = setInterval(() => {
      Geolocation.getCurrentPosition(
        async (pos: GeolocationResponse) => {
          await writeLocation(employeeId, {
            lat:      pos.coords.latitude,
            lng:      pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            battery:  await getBattery(),
          });
        },
        (err: GeolocationError) => console.warn('[BG] GPS error:', err.message),
        { enableHighAccuracy: false, timeout: 10_000 },
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
export async function startTracking(employeeId: string): Promise<void> {
  if (isTracking) {
    console.warn('[Tracking] Already running — ignoring duplicate start');
    return;
  }

  try {
    const granted = await requestLocationPermissions();
    if (!granted) return;

    const locRef = ref(getDatabase(), `live_locations/${employeeId}`);
    await onDisconnect(locRef).update({ is_online: false });
    await update(locRef, { is_online: true });

    watchId = Geolocation.watchPosition(
      async (pos: GeolocationResponse) => {
        await writeLocation(employeeId, {
          lat:      pos.coords.latitude,
          lng:      pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          battery:  await getBattery(),
        });
      },
      (err: GeolocationError) => console.warn('[GEO]', err.message),
      {
        enableHighAccuracy: true,
        distanceFilter:     15,
        interval:           10_000,
        fastestInterval:    5_000,
      },
    );

    if (!BackgroundActions.isRunning()) {
      await BackgroundActions.start(backgroundTask, {
        ...backgroundOptions,
        parameters: { employeeId },
      });
    }

    isTracking = true;
    console.log('[Tracking] Started ✅');
  } catch (e: any) {
    console.error('[Tracking] startTracking crashed:', e);
    await stopTracking(employeeId);
    throw e;
  }
}

// ── Stop Tracking ─────────────────────────────────────────────────
export async function stopTracking(employeeId?: string): Promise<void> {
  isTracking = false;

  if (employeeId) {
    try {
      const locRef = ref(getDatabase(), `live_locations/${employeeId}`);
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