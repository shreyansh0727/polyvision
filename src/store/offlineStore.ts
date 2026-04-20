import { create } from 'zustand';
import { NetInfo } from '@react-native-community/netinfo';

interface QueuedRequest {
  id:        string;
  endpoint:  string;
  method:    'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?:     unknown;
  createdAt: string;
  retries:   number;
}

interface OfflineStore {
  isOnline:      boolean;
  queue:         QueuedRequest[];
  isSyncing:     boolean;

  setOnline:     (online: boolean) => void;
  enqueue:       (req: Omit<QueuedRequest, 'id' | 'createdAt' | 'retries'>) => void;
  removeFromQueue: (id: string) => void;
  clearQueue:    () => void;
  setSyncing:    (v: boolean) => void;
}

export const useOfflineStore = create<OfflineStore>((set, get) => ({
  isOnline:  true,
  queue:     [],
  isSyncing: false,

  setOnline: (isOnline) => set({ isOnline }),

  enqueue: (req) => set((state) => ({
    queue: [
      ...state.queue,
      {
        ...req,
        id:        `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        createdAt: new Date().toISOString(),
        retries:   0,
      },
    ],
  })),

  removeFromQueue: (id) =>
    set((state) => ({ queue: state.queue.filter((r) => r.id !== id) })),

  clearQueue: () => set({ queue: [] }),

  setSyncing: (isSyncing) => set({ isSyncing }),
}));
