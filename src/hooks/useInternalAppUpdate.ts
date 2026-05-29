// src/hooks/useInternalAppUpdate.ts
import { useEffect, useState, useCallback, useRef } from 'react';
import { Alert, Linking, AppState, AppStateStatus } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { apiGet } from '../services/api';

interface VersionResponse {
  latestVersion: string;
  minSupportedVersion?: string | null;
  apkUrl: string;
  notes?: string | null;
}

interface UpdateState {
  needsUpdate: boolean;
  force: boolean;
  latestVersion?: string;
  notes?: string | null;
  apkUrl?: string;
}

function cmpSemver(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10));
  const pb = b.split('.').map(n => parseInt(n, 10));

  for (let i = 0; i < 3; i += 1) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

export function useInternalAppUpdate() {
  const [checking, setChecking] = useState(false);
  const [update, setUpdate] = useState<UpdateState | null>(null);

  const inFlightRef = useRef(false);
  const lastCheckAtRef = useRef(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const checkForUpdate = useCallback(async (opts?: { force?: boolean }) => {
    const force = opts?.force === true;
    const now = Date.now();

    if (inFlightRef.current) return;

    // Prevent accidental spam: skip if checked within last 60s unless forced
    if (!force && now - lastCheckAtRef.current < 60_000) {
      return;
    }

    inFlightRef.current = true;
    setChecking(true);

    try {
      const currentVersion = DeviceInfo.getVersion();
      const res = await apiGet<VersionResponse>('/ota/app/version');

      lastCheckAtRef.current = Date.now();

      if (!res?.latestVersion || !res?.apkUrl) {
        setUpdate(null);
        return;
      }

      const needsUpdate = cmpSemver(res.latestVersion, currentVersion) > 0;

      let forceUpdate = false;
      if (res.minSupportedVersion) {
        forceUpdate = cmpSemver(currentVersion, res.minSupportedVersion) < 0;
      }

      if (needsUpdate) {
        setUpdate({
          needsUpdate: true,
          force: forceUpdate,
          latestVersion: res.latestVersion,
          notes: res.notes ?? null,
          apkUrl: res.apkUrl,
        });
      } else {
        setUpdate({ needsUpdate: false, force: false });
      }
    } catch (e) {
      console.warn('useInternalAppUpdate: failed to check', e);
    } finally {
      inFlightRef.current = false;
      setChecking(false);
    }
  }, []);

  const openDownload = useCallback(() => {
    if (!update?.apkUrl) {
      Alert.alert('Update', 'Download link not available.');
      return;
    }

    const url = update.apkUrl;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      Alert.alert('Update', 'Invalid download URL.');
      return;
    }

    Linking.openURL(url);
  }, [update]);

  useEffect(() => {
    checkForUpdate({ force: true });

    const sub = AppState.addEventListener('change', (nextState) => {
      const wasBackground =
        appStateRef.current === 'background' || appStateRef.current === 'inactive';

      if (wasBackground && nextState === 'active') {
        checkForUpdate({ force: false });
      }

      appStateRef.current = nextState;
    });

    return () => sub.remove();
  }, [checkForUpdate]);

  return { checking, update, checkForUpdate, openDownload };
}