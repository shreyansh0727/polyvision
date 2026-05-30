import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { unzip } from 'react-native-zip-archive';
import Config from '../Config';

const PLATFORM = Platform.OS;
const OTA_DIR = `${RNFS.DocumentDirectoryPath}/ota`;
const ZIP_FILE = `${OTA_DIR}/update.zip`;
const EXTRACT_DIR = `${OTA_DIR}/current`;
const BUNDLE_FILE =
  PLATFORM === 'ios'
    ? `${EXTRACT_DIR}/main.jsbundle`
    : `${EXTRACT_DIR}/index.android.bundle`;
const META_FILE = `${OTA_DIR}/meta.json`;

type OtaCheckResponse = {
  update_available: boolean;
  current_version?: string;
  latest_version?: string;
  bundle_url?: string | null;
  package_type?: 'zip' | 'bundle' | null;
  hash?: string | null;
  package_size?: number | null;
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

async function ensureDir(path: string): Promise<void> {
  const exists = await RNFS.exists(path);
  if (!exists) await RNFS.mkdir(path);
}

async function removeIfExists(path: string): Promise<void> {
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

    if (data.package_type && data.package_type !== 'zip') {
      console.warn('[OTA] Unsupported package_type:', data.package_type);
      return;
    }

    await ensureDir(OTA_DIR);
    await removeIfExists(ZIP_FILE);
    await removeIfExists(EXTRACT_DIR);

    const downloadResult = await RNFS.downloadFile({
      fromUrl: data.bundle_url,
      toFile: ZIP_FILE,
      background: true,
      discretionary: true,
      cacheable: false,
    }).promise;

    if (downloadResult.statusCode !== 200) {
      console.warn('[OTA] Download failed, status:', downloadResult.statusCode);
      await removeIfExists(ZIP_FILE);
      return;
    }

    const zipMd5 = await RNFS.hash(ZIP_FILE, 'md5');
    if (zipMd5 !== data.hash) {
      console.warn('[OTA] ZIP hash mismatch — discarding update');
      await removeIfExists(ZIP_FILE);
      return;
    }

    await ensureDir(EXTRACT_DIR);
    await unzip(ZIP_FILE, EXTRACT_DIR);
    await removeIfExists(ZIP_FILE);

    const bundleExists = await RNFS.exists(BUNDLE_FILE);
    if (!bundleExists) {
      console.warn('[OTA] Extracted update missing JS bundle:', BUNDLE_FILE);
      await removeIfExists(EXTRACT_DIR);
      return;
    }

    const bundleStat = await RNFS.stat(BUNDLE_FILE);

    await RNFS.writeFile(
      META_FILE,
      JSON.stringify(
        {
          version: data.latest_version,
          package_type: 'zip',
          package_md5: zipMd5,
          downloaded_at: new Date().toISOString(),
          released_at: data.released_at ?? null,
          platform: PLATFORM,
          bundle_path: BUNDLE_FILE,
          bundle_size: Number(bundleStat.size),
          extract_dir: EXTRACT_DIR,
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