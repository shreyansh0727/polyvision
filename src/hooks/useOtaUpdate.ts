/**
 * useOtaUpdate.ts
 * Drop this in src/hooks/ — call it once in App.tsx
 *
 * Flow:
 *   1. On app foreground → hit GET /ota/check
 *   2. If update_available  → download bundle in background
 *   3. Verify MD5 hash
 *   4. On next cold launch   → RN loads new bundle automatically
 *      (bundle is written to the same path RN reads from)
 *
 * NOTE: This is a lightweight self-hosted alternative to CodePush.
 * It does NOT hot-reload the current session — update applies on next launch.
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import Config from '../Config';

const PLATFORM    = Platform.OS;                     // "android"
const BUNDLE_DIR  = RNFS.DocumentDirectoryPath + '/ota';
const BUNDLE_FILE = BUNDLE_DIR + '/index.android.bundle';
const META_FILE   = BUNDLE_DIR + '/meta.json';

async function getCurrentVersion(): Promise<string> {
  try {
    const raw = await RNFS.readFile(META_FILE, 'utf8');
    return JSON.parse(raw).version ?? '0';
  } catch {
    return '0';
  }
}

async function checkAndDownload(): Promise<void> {
  try {
    const currentVersion = await getCurrentVersion();
    const url = `${Config.API_URL}/ota/check?platform=${PLATFORM}&current_version=${currentVersion}`;
    const res  = await fetch(url);
    const data = await res.json();

    if (!data.update_available) return;

    console.log(`[OTA] New bundle available: v${data.latest_version}`);

    // Download bundle
    await RNFS.mkdir(BUNDLE_DIR);
    const downloadResult = await RNFS.downloadFile({
      fromUrl: `${Config.API_URL}${data.bundle_url}`,
      toFile:  BUNDLE_FILE,
    }).promise;

    if (downloadResult.statusCode !== 200) {
      console.warn('[OTA] Download failed', downloadResult.statusCode);
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
      JSON.stringify({ version: data.latest_version, hash: data.hash }),
      'utf8',
    );

    console.log(`[OTA] Bundle v${data.latest_version} ready — applies on next launch`);
  } catch (err) {
    console.warn('[OTA] Update check failed', err);
  }
}

export function useOtaUpdate(): void {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // Check on mount
    checkAndDownload();

    // Check every time app comes to foreground
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        checkAndDownload();
      }
      appState.current = next;
    });

    return () => sub.remove();
  }, []);
}
