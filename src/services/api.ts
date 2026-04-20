// src/services/api.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import Config from '../Config';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { useOfflineStore } from '../store/offlineStore';

// ── Lazy logout ref ───────────────────────────────────────────────
type LogoutFn = () => void;
let _logoutHandler: LogoutFn | null = null;
export const setLogoutHandler = (fn: LogoutFn) => {
  _logoutHandler = fn;
};

// ── Token cache ───────────────────────────────────────────────────
let _cachedToken: string | null = null;
let _tokenExpiresAt = 0;
const TOKEN_REFRESH_BUFFER_MS = 60_000;

async function getFreshToken(forceRefresh = false): Promise<string | null> {
  const user = getAuth().currentUser;
  if (!user) return null;

  const now = Date.now();
  const needsRefresh = forceRefresh || !_cachedToken || now >= _tokenExpiresAt;
  if (!needsRefresh) return _cachedToken;

  try {
    const token = await user.getIdToken(forceRefresh);
    _cachedToken = token;
    _tokenExpiresAt = now + 3_540_000 - TOKEN_REFRESH_BUFFER_MS;
    return token;
  } catch (e) {
    console.warn('[API] Token fetch failed:', e);
    _cachedToken = null;
    _tokenExpiresAt = 0;
    return null;
  }
}

export function clearTokenCache() {
  _cachedToken = null;
  _tokenExpiresAt = 0;
}

// ── Axios instance ────────────────────────────────────────────────
const api = axios.create({
  baseURL: Config.API_URL ?? 'https://vns-track.de.r.appspot.com',
  timeout: 12_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ── Request interceptor — attach Firebase token ───────────────────
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getFreshToken();
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn('[API] No token available for:', config.url);
    }
    return config;
  },
  error => Promise.reject(error),
);

// ── Response interceptor — 401 refresh + logout + offline guard ──
let _isRefreshing = false;
let _refreshSubscribers: Array<(token: string) => void> = [];

function subscribeRefresh(cb: (token: string) => void) {
  _refreshSubscribers.push(cb);
}

function notifyRefreshSubscribers(token: string) {
  _refreshSubscribers.forEach(cb => cb(token));
  _refreshSubscribers = [];
}

api.interceptors.response.use(
  res => res,
  async (err: AxiosError<{ detail?: string }>) => {
    const status = err.response?.status;
    const url = err.config?.url;
    const origReq = err.config as InternalAxiosRequestConfig & { _retried?: boolean };

    if (!err.response && err.code !== 'ECONNABORTED') {
      useOfflineStore.getState().setOnline(false);
    }

    if (status === 401 && !origReq._retried) {
      origReq._retried = true;

      if (_isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeRefresh(async newToken => {
            try {
              origReq.headers = origReq.headers ?? {};
              origReq.headers.Authorization = `Bearer ${newToken}`;
              resolve(await api(origReq));
            } catch (e) {
              reject(e);
            }
          });
        });
      }

      _isRefreshing = true;
      try {
        const newToken = await getFreshToken(true);
        if (newToken) {
          notifyRefreshSubscribers(newToken);
          origReq.headers = origReq.headers ?? {};
          origReq.headers.Authorization = `Bearer ${newToken}`;
          _isRefreshing = false;
          return await api(origReq);
        }
      } catch (refreshErr) {
        console.warn('[API] Token refresh failed:', refreshErr);
      }

      _isRefreshing = false;
      console.warn(`[API] 401 after token refresh — logging out (${url})`);
      clearTokenCache();
      try {
        await signOut(getAuth());
      } catch (_) {}
      _logoutHandler?.();
      return Promise.reject(new Error('Session expired. Please log in again.'));
    }

    const serverMsg = err.response?.data?.detail;
    if (serverMsg) {
      console.warn(`[API] ${status ?? 'ERR'} ${url}:`, serverMsg);
      return Promise.reject(new Error(String(serverMsg)));
    }

    if (err.code === 'ECONNABORTED') {
      console.warn(`[API] Timeout: ${url}`);
      return Promise.reject(new Error('Request timed out. Check your connection.'));
    }

    if (!err.response) {
      console.warn(`[API] Network error: ${url}`);
      return Promise.reject(new Error('Server unreachable. Check your network.'));
    }

    console.warn(`[API] ${status} ${url}`);
    return Promise.reject(err);
  },
);

// ── Named helper exports ──────────────────────────────────────────
export async function apiGet<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
  const res = await api.get<T>(endpoint, { params });
  return res.data;
}

export async function apiPost<T>(endpoint: string, body?: unknown): Promise<T> {
  const res = await api.post<T>(endpoint, body);
  return res.data;
}

export async function apiPut<T>(endpoint: string, body?: unknown): Promise<T> {
  const res = await api.put<T>(endpoint, body);
  return res.data;
}

export async function apiPatch<T>(endpoint: string, body?: unknown): Promise<T> {
  const res = await api.patch<T>(endpoint, body);
  return res.data;
}

export async function apiDelete<T>(endpoint: string): Promise<T> {
  const res = await api.delete<T>(endpoint);
  return res.data;
}

export async function apiUpload<T>(endpoint: string, formData: FormData): Promise<T> {
  const res = await api.post<T>(endpoint, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export default api;