import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import Config from '../Config';

const PLATFORM    = Platform.OS;
const BUNDLE_DIR  = RNFS.DocumentDirectoryPath + '/ota';
const BUNDLE_FILE = BUNDLE_DIR + '/index.android.bundle';
const META_FILE   = BUNDLE_DIR + '/meta.json';

async function getCurrentVersion(): Promise<string> {
  try {
    const raw = await RNFS.readFile(META_FILE, 'utf8');
    return JSON.parse(raw).version ?? '0';
  } catch {
    return Config.OTA_VERSION ?? '0';
  }
}

async function checkAndDownload(): Promise<void> {
  try {
    const currentVersion = await getCurrentVersion();
    const url = `${Config.API_URL}/ota/check?platform=${PLATFORM}&current_version=${currentVersion}`;

    const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) return;
    const data = await res.json();

    if (!data.update_available) {
      console.log('[OTA] Already up to date:', currentVersion);
      return;
    }

    console.log(`[OTA] New bundle available: v${data.latest_version}`);

    // Ensure OTA directory exists
    const dirExists = await RNFS.exists(BUNDLE_DIR);
    if (!dirExists) await RNFS.mkdir(BUNDLE_DIR);

    // Download bundle
    const downloadResult = await RNFS.downloadFile({
      fromUrl: `${Config.API_URL}${data.bundle_url}`,
      toFile:  BUNDLE_FILE,
      background: true,
      discretionary: true,
    }).promise;

    if (downloadResult.statusCode !== 200) {
      console.warn('[OTA] Download failed, status:', downloadResult.statusCode);
      return;
    }

    // Verify MD5 hash
    const hash = await RNFS.hash(BUNDLE_FILE, 'md5');
    if (hash !== data.hash) {
      console.warn('[OTA] Hash mismatch — discarding bundle');
      await RNFS.unlink(BUNDLE_FILE);
      return;
    }

    // Save metadata
    await RNFS.writeFile(
      META_FILE,
      JSON.stringify({ version: data.latest_version, hash }),
      'utf8',
    );

    console.log(`[OTA] ✅ Bundle v${data.latest_version} ready — applies on next launch`);

  } catch (err) {
    console.warn('[OTA] Update check failed:', err);
  }
}

export function useOtaUpdate(): void {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    checkAndDownload();

    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        checkAndDownload();
      }
      appState.current = next;
    });

    return () => sub.remove();
  }, []);
}