import { useOfflineStore } from '../store/offlineStore';
import { cacheGet, cacheSet } from './cache';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from './api';

/**
 * GET with cache fallback.
 * When offline → returns cached data instead of throwing.
 */
export async function offlineGet<T>(
  endpoint: string,
  ttlMs?: number,
): Promise<{ data: T; fromCache: boolean }> {
  const { isOnline } = useOfflineStore.getState();

  if (isOnline) {
    try {
      const data = await apiGet<T>(endpoint);
      await cacheSet(endpoint, data, ttlMs);   // update cache on success
      return { data, fromCache: false };
    } catch (err) {
      // Network failed even though we thought we were online — try cache
      const cached = await cacheGet<T>(endpoint);
      if (cached) return { data: cached, fromCache: true };
      throw err;
    }
  }

  // Offline — serve from cache
  const cached = await cacheGet<T>(endpoint);
  if (cached) return { data: cached, fromCache: true };
  throw new Error('You are offline and no cached data is available.');
}

/**
 * POST/PUT/PATCH/DELETE with offline queue.
 * When offline → queues the request and resolves immediately.
 */
export async function offlinePost<T>(endpoint: string, body?: unknown): Promise<T | null> {
  return offlineMutate('POST', endpoint, body);
}

export async function offlinePut<T>(endpoint: string, body?: unknown): Promise<T | null> {
  return offlineMutate('PUT', endpoint, body);
}

export async function offlinePatch<T>(endpoint: string, body?: unknown): Promise<T | null> {
  return offlineMutate('PATCH', endpoint, body);
}

async function offlineMutate<T>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  endpoint: string,
  body?: unknown,
): Promise<T | null> {
  const { isOnline, enqueue } = useOfflineStore.getState();

  if (isOnline) {
    // Online — execute immediately
    switch (method) {
      case 'POST':  return apiPost<T>(endpoint, body);
      case 'PUT':   return apiPut<T>(endpoint, body);
      case 'PATCH': return apiPatch<T>(endpoint, body);
    }
  }

  // Offline — add to queue
  enqueue({ method, endpoint, body });
  console.log(`[Offline] Queued: ${method} ${endpoint}`);
  return null;
}
