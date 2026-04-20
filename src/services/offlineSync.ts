import { useOfflineStore } from '../store/offlineStore';
import { apiPost, apiPut, apiPatch, apiDelete } from './api';

const MAX_RETRIES = 3;

/**
 * Called automatically when the device comes back online.
 * Replays queued requests in order. Removes successes, increments retry count on failure.
 */
export async function syncOfflineQueue(): Promise<void> {
  const { queue, removeFromQueue, setSyncing, isSyncing } = useOfflineStore.getState();

  if (isSyncing || queue.length === 0) return;

  setSyncing(true);
  console.log(`[Offline] Syncing ${queue.length} queued request(s)...`);

  for (const req of [...queue]) {
    try {
      switch (req.method) {
        case 'POST':   await apiPost(req.endpoint, req.body);  break;
        case 'PUT':    await apiPut(req.endpoint, req.body);   break;
        case 'PATCH':  await apiPatch(req.endpoint, req.body); break;
        case 'DELETE': await apiDelete(req.endpoint);          break;
      }
      removeFromQueue(req.id);
      console.log(`[Offline] ✅ Synced: ${req.method} ${req.endpoint}`);
    } catch (err) {
      console.warn(`[Offline] ❌ Failed: ${req.method} ${req.endpoint}`, err);
      // Increment retry count — drop permanently after MAX_RETRIES
      useOfflineStore.setState((state) => ({
        queue: state.queue.map((r) =>
          r.id === req.id ? { ...r, retries: r.retries + 1 } : r
        ).filter((r) => r.retries < MAX_RETRIES),
      }));
    }
  }

  setSyncing(false);
  console.log('[Offline] Sync complete');
}
