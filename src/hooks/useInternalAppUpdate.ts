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
  minSupportedVersion?: string | null;
  notes?: string | null;
  apkUrl?: string;
}

function normalizeVersion(version?: string | null): string {
  if (!version) return '0.0.0';

  const cleaned = String(version)
    .trim()
    .replace(/^v/i, '')
    .split('-')[0]
    .split('+')[0];

  return cleaned || '0.0.0';
}

function cmpSemver(a: string, b: string): number {
  const pa = normalizeVersion(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = normalizeVersion(b).split('.').map(n => parseInt(n, 10) || 0);

  const maxLen = Math.max(pa.length, pb.length, 3);

  for (let i = 0; i < maxLen; i += 1) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }

  return 0;
}

function isValidHttpUrl(url?: string | null): url is string {
  if (!url) return false;
  return /^https?:\/\//i.test(url.trim());
}

export function useInternalAppUpdate() {
  const [checking, setChecking] = useState(false);
  const [update, setUpdate] = useState<UpdateState | null>(null);

  const inFlightRef = useRef(false);
  const lastCheckAtRef = useRef(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const checkForUpdate = useCallback(async (opts?: { force?: boolean }) => {
    const force = opts?.force === true;
    const now = Date.now();

    if (inFlightRef.current) return;

    if (!force && now - lastCheckAtRef.current < 60_000) {
      return;
    }

    const requestId = ++requestIdRef.current;
    inFlightRef.current = true;

    if (mountedRef.current) {
      setChecking(true);
    }

    try {
      const currentVersion = normalizeVersion(DeviceInfo.getVersion());
      const res = await apiGet<VersionResponse>('/ota/app/version');

      if (requestId !== requestIdRef.current || !mountedRef.current) {
        return;
      }

      lastCheckAtRef.current = Date.now();

      const latestVersion = normalizeVersion(res?.latestVersion);
      const minSupportedVersion = res?.minSupportedVersion
        ? normalizeVersion(res.minSupportedVersion)
        : null;
      const apkUrl = res?.apkUrl?.trim();

      if (!latestVersion || latestVersion === '0.0.0' || !isValidHttpUrl(apkUrl)) {
        setUpdate(null);
        return;
      }

      const needsUpdate = cmpSemver(latestVersion, currentVersion) > 0;
      const forceUpdate =
        !!minSupportedVersion && cmpSemver(currentVersion, minSupportedVersion) < 0;

      if (needsUpdate) {
        setUpdate({
          needsUpdate: true,
          force: forceUpdate,
          latestVersion,
          minSupportedVersion,
          notes: res?.notes ?? null,
          apkUrl,
        });
      } else {
        setUpdate({
          needsUpdate: false,
          force: false,
          latestVersion,
          minSupportedVersion,
          notes: res?.notes ?? null,
          apkUrl,
        });
      }
    } catch (e) {
      if (__DEV__) {
        console.warn('useInternalAppUpdate: failed to check', e);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        inFlightRef.current = false;
        if (mountedRef.current) {
          setChecking(false);
        }
      }
    }
  }, []);

  const openDownload = useCallback(async () => {
    const url = update?.apkUrl?.trim();

    if (!isValidHttpUrl(url)) {
      Alert.alert('Update', 'Download link not available.');
      return;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Update', 'Cannot open download link on this device.');
        return;
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert('Update', 'Failed to open download link.');
    }
  }, [update?.apkUrl]);

  useEffect(() => {
    mountedRef.current = true;
    checkForUpdate({ force: true });

    const sub = AppState.addEventListener('change', nextState => {
      const wasBackground =
        appStateRef.current === 'background' || appStateRef.current === 'inactive';

      if (wasBackground && nextState === 'active') {
        checkForUpdate({ force: false });
      }

      appStateRef.current = nextState;
    });

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      inFlightRef.current = false;
      sub.remove();
    };
  }, [checkForUpdate]);

  return { checking, update, checkForUpdate, openDownload };
}