// src/services/photoService.ts
import {
  launchCamera,
  CameraOptions,
  ImagePickerResponse,
} from 'react-native-image-picker';
import Geolocation, {
  GeolocationResponse,
  GeolocationError,
} from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  getStorage,
  ref,
  putFile,
  getDownloadURL,
} from '@react-native-firebase/storage';
import { getAuth } from '@react-native-firebase/auth';
import { apiPost } from './api';
import { useOfflineStore } from '../store/offlineStore';

export interface VisitRecord {
  visit_id: string;
  employee_id: string;
  lat: number;
  lng: number;
  photo_url: string;
  caption: string;
  visited_at: string;
  synced: boolean;
}

// ── Camera Permission ─────────────────────────────────────────────
async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') return true;

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.CAMERA,
    {
      title: 'Camera Permission',
      message: 'Employee Tracker needs camera access to log visit photos.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    },
  );

  return result === PermissionsAndroid.RESULTS.GRANTED;
}

// ── GPS with stale-cache fallback ─────────────────────────────────
function getCurrentPosition(): Promise<GeolocationResponse> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      resolve,
      () => {
        Geolocation.getCurrentPosition(
          resolve,
          (err: GeolocationError) => reject(new Error(err.message)),
          { enableHighAccuracy: false, timeout: 5_000, maximumAge: 60_000 },
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 },
    );
  });
}

// ── Main Upload Function ──────────────────────────────────────────
export async function captureAndUploadVisitPhoto(
  caption: string,
  onProgress?: (step: string) => void,
): Promise<VisitRecord | null> {
  onProgress?.('Checking permissions...');
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) {
    throw new Error('Camera permission denied. Enable it in Settings.');
  }

  onProgress?.('Opening camera...');
  const cameraOptions: CameraOptions = {
    mediaType: 'photo',
    quality: 0.7,
    saveToPhotos: false,
    includeBase64: false,
    cameraType: 'back',
  };

  const response: ImagePickerResponse = await new Promise(resolve => {
    launchCamera(cameraOptions, resolve);
  });

  if (response.didCancel) return null;
  if (response.errorCode) {
    throw new Error(response.errorMessage ?? 'Camera error');
  }

  const asset = response.assets?.[0];
  if (!asset?.uri) throw new Error('No image captured');

  const uri = asset.uri;
  const filename = asset.fileName ?? `visit_${Date.now()}.jpg`;

  onProgress?.('Getting your location...');
  let lat: number;
  let lng: number;

  try {
    const pos = await getCurrentPosition();
    lat = pos.coords.latitude;
    lng = pos.coords.longitude;
  } catch (e: any) {
    throw new Error(`Location unavailable: ${e.message}`);
  }

  const firebaseUid = getAuth().currentUser?.uid;
  if (!firebaseUid) throw new Error('Not authenticated');

  const { isOnline } = useOfflineStore.getState();

  // ── Offline: queue visit locally ────────────────────────────────
  if (!isOnline) {
    onProgress?.('Offline — visit saved locally, will sync when online');

    const localRecord: VisitRecord = {
      visit_id: `local-${Date.now()}`,
      employee_id: firebaseUid,
      lat,
      lng,
      photo_url: uri,
      caption,
      visited_at: new Date().toISOString(),
      synced: false,
    };

    useOfflineStore.getState().enqueue({
      endpoint: '/visits/photo/confirm',
      method: 'POST',
      body: {
        firebase_url: uri,
        lat,
        lng,
        caption,
        offline: true,
      },
    });

    console.log('[photoService] Offline — visit queued for sync');
    return localRecord;
  }

  // ── Online: upload to Firebase Storage ──────────────────────────
  onProgress?.('Uploading photo...');
  const storagePath = `visits/${firebaseUid}/${Date.now()}-${filename}`;
  const fileRef = ref(getStorage(), storagePath);

  try {
    const task = putFile(fileRef, uri, { contentType: 'image/jpeg' });

    task.on('state_changed', snapshot => {
      const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
      onProgress?.(`Uploading... ${pct}%`);
    });

    await task;
  } catch (e: any) {
    throw new Error(`Upload failed: ${e.message}`);
  }

  let photoUrl: string;
  try {
    photoUrl = await getDownloadURL(fileRef);
  } catch (e: any) {
    throw new Error(`Could not get download URL: ${e.message}`);
  }

  onProgress?.('Saving visit record...');
  try {
    const visit = await apiPost<any>('/visits/photo/confirm', {
      firebase_url: photoUrl,
      lat,
      lng,
      caption,
    });

    return {
      visit_id: visit.visit_id ?? visit.id ?? 'unknown',
      employee_id: visit.employee_id ?? firebaseUid,
      lat: visit.lat ?? lat,
      lng: visit.lng ?? lng,
      photo_url: visit.photo_url ?? photoUrl,
      caption: visit.caption ?? caption,
      visited_at: visit.visited_at ?? visit.uploaded_at ?? new Date().toISOString(),
      synced: true,
    };
  } catch (e: any) {
    console.warn('[photoService] /visits/photo/confirm failed — queuing retry');

    useOfflineStore.getState().enqueue({
      endpoint: '/visits/photo/confirm',
      method: 'POST',
      body: { firebase_url: photoUrl, lat, lng, caption },
    });

    return {
      visit_id: 'local',
      employee_id: firebaseUid,
      lat,
      lng,
      photo_url: photoUrl,
      caption,
      visited_at: new Date().toISOString(),
      synced: false,
    };
  }
}