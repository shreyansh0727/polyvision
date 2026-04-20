// src/hooks/useInternalAppUpdate.ts
import { useEffect, useState, useCallback } from 'react';
import { Alert, Linking } from 'react-native';
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
  const [update, setUpdate]     = useState<UpdateState | null>(null);

  const checkForUpdate = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    try {
      const currentVersion = DeviceInfo.getVersion(); // e.g. "1.0.0"

      // NOTE: leading slash so it hits /ota/app/version on your API
      const res = await apiGet<VersionResponse>('/ota/app/version');

      if (!res?.latestVersion || !res?.apkUrl) {
        setUpdate(null);
        return;
      }

      const needsUpdate = cmpSemver(res.latestVersion, currentVersion) > 0;

      let force = false;
      if (res.minSupportedVersion) {
        // force update if current < minSupportedVersion
        force = cmpSemver(currentVersion, res.minSupportedVersion) < 0;
      }

      if (needsUpdate) {
        setUpdate({
          needsUpdate: true,
          force,
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
      setChecking(false);
    }
  }, [checking]);

  const openDownload = useCallback(() => {
    if (!update?.apkUrl) {
      Alert.alert('Update', 'Download link not available.');
      return;
    }
    // Basic guard to avoid weird schemes
    const url = update.apkUrl;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      Alert.alert('Update', 'Invalid download URL.');
      return;
    }
    Linking.openURL(url);
  }, [update]);

  useEffect(() => {
    checkForUpdate();
  }, [checkForUpdate]);

  return { checking, update, checkForUpdate, openDownload };
}