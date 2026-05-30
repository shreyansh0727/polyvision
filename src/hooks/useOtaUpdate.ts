import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import Config from '../Config';

const PLATFORM = Platform.OS;
const BUNDLE_DIR = `${RNFS.DocumentDirectoryPath}/ota`;
const BUNDLE_FILE =
  PLATFORM === 'ios'
    ? `${BUNDLE_DIR}/main.jsbundle`
    : `${BUNDLE_DIR}/index.android.bundle`;
const META_FILE = `${BUNDLE_DIR}/meta.json`;

type OtaCheckResponse = {
  update_available: boolean;
  current_version?: string;
  latest_version?: string;
  bundle_url?: string | null;
  hash?: string | null;
  released_at?: string | null;
};

async function getCurrentVersion(): Promise<string> {
  try {
    const raw = await RNFS.readFile(META_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.version ?? Config.OTA_VERSION ?? '0';
  } catch {
    return Config.OTA_VERSION ?? '0';
  }
}

async function ensureDir(): Promise<void> {
  const exists = await RNFS.exists(BUNDLE_DIR);
  if (!exists) {
    await RNFS.mkdir(BUNDLE_DIR);
  }
}

async function removeFileIfExists(path: string): Promise<void> {
  try {
    const exists = await RNFS.exists(path);
    if (exists) await RNFS.unlink(path);
  } catch {}
}

async function checkAndDownload(): Promise<void> {
  try {
    const currentVersion = await getCurrentVersion();
    const checkUrl = `${Config.API_URL}/ota/check?platform=${PLATFORM}&current_version=${encodeURIComponent(currentVersion)}`;

    const res = await fetch(checkUrl, {
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!res.ok) {
      console.warn('[OTA] Check failed with status:', res.status);
      return;
    }

    const data: OtaCheckResponse = await res.json();

    if (!data.update_available) {
      console.log('[OTA] Already up to date:', currentVersion);
      return;
    }

    if (!data.bundle_url || !data.latest_version || !data.hash) {
      console.warn('[OTA] Invalid update payload:', data);
      return;
    }

    console.log(`[OTA] New bundle available: v${data.latest_version}`);

    await ensureDir();
    await removeFileIfExists(BUNDLE_FILE);

    const downloadResult = await RNFS.downloadFile({
      fromUrl: data.bundle_url,
      toFile: BUNDLE_FILE,
      background: true,
      discretionary: true,
      cacheable: false,
    }).promise;

    if (downloadResult.statusCode !== 200) {
      console.warn('[OTA] Download failed, status:', downloadResult.statusCode);
      await removeFileIfExists(BUNDLE_FILE);
      return;
    }

    const hash = await RNFS.hash(BUNDLE_FILE, 'md5');
    if (hash !== data.hash) {
      console.warn('[OTA] Hash mismatch — discarding bundle');
      await removeFileIfExists(BUNDLE_FILE);
      return;
    }

    await RNFS.writeFile(
      META_FILE,
      JSON.stringify(
        {
          version: data.latest_version,
          hash,
          downloaded_at: new Date().toISOString(),
          released_at: data.released_at ?? null,
          platform: PLATFORM,
          bundle_path: BUNDLE_FILE,
        },
        null,
        2,
      ),
      'utf8',
    );

    console.log(`[OTA] ✅ Bundle v${data.latest_version} ready — applies on next launch`);
  } catch (err) {
    console.warn('[OTA] Update check failed:', err);
  }
}

export function useOtaUpdate(): void {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const runningRef = useRef(false);

  useEffect(() => {
    const runCheck = async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        await checkAndDownload();
      } finally {
        runningRef.current = false;
      }
    };

    runCheck();

    const sub = AppState.addEventListener('change', next => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        runCheck();
      }
      appState.current = next;
    });

    return () => sub.remove();
  }, []);
}