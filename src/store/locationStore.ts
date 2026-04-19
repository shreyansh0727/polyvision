// src/store/locationStore.ts
import { create } from 'zustand';
import { apiGet } from '../services/api';
import { LiveEmployee } from '../types';


const STALE_MS = 5 * 60 * 1_000;   // 5 min — matches backend INTERVAL '5 minutes'


// ── Shared staleness check ─────────────────────────────────────────
// Single source of truth — used by updateEmployee + all derived helpers
function isStale(emp: LiveEmployee): boolean {
  if (emp.is_online !== undefined) return !emp.is_online;
  return Date.now() - new Date(emp.recorded_at).getTime() >= STALE_MS;
}


interface LocationStore {
  liveEmployees: Record<string, LiveEmployee>;
  lastUpdated:   string | null;
  seeding:       boolean;           // ✅ loading state for initial API seed

  // Actions
  seedFromApi:          () => Promise<void>;    // ✅ load GET /admin/employees/live
  updateEmployee:       (data: Partial<LiveEmployee> & { employee_id: string }) => void;
  updateEmployeeStatus: (employee_id: string, is_online: boolean) => void;
  removeEmployee:       (employee_id: string) => void;
  clearAll:             () => void;

  // Derived helpers (use inside useMemo in components)
  getActiveEmployees: () => LiveEmployee[];
  getStaleEmployees:  () => LiveEmployee[];
  getEmployeeById:    (id: string) => LiveEmployee | undefined;
  getOnlineCount:     () => number;    // ✅ for dashboard KPI
  getTotalCount:      () => number;    // ✅ for dashboard KPI
}


export const useLocationStore = create<LocationStore>((set, get) => ({
  liveEmployees: {},
  lastUpdated:   null,
  seeding:       false,


  // ── Seed from REST on connect ──────────────────────────────────
  // Called once when WebSocket connects or admin screen mounts.
  // Populates the store before real-time WS deltas start flowing in.
  seedFromApi: async () => {
    set({ seeding: true });
    try {
      const employees = await apiGet<LiveEmployee[]>('/admin/employees/live');
      const map: Record<string, LiveEmployee> = {};
      for (const emp of employees) map[emp.employee_id] = emp;
      set({ liveEmployees: map, lastUpdated: new Date().toISOString() });
    } catch (e) {
      console.warn('[LocationStore] Seed failed:', e);
    } finally {
      set({ seeding: false });
    }
  },


  // ── Update or insert a live employee record ────────────────────
  // Accepts full LiveEmployee OR a partial delta from WS location_update
  updateEmployee: (data) =>
    set((state) => {
      const existing  = state.liveEmployees[data.employee_id] ?? {};
      const recorded_at = data.recorded_at ?? new Date().toISOString();

      const merged = { ...existing, ...data, recorded_at } as LiveEmployee;

      // Derive is_online from recorded_at only if backend didn't send it
      if (data.is_online === undefined) {
        merged.is_online = !isStale(merged);
      }

      return {
        liveEmployees: { ...state.liveEmployees, [data.employee_id]: merged },
        lastUpdated:   new Date().toISOString(),
      };
    }),


  // ── Handle status_change WS event ─────────────────────────────
  // Only flips is_online — does NOT overwrite location data
  updateEmployeeStatus: (employee_id, is_online) =>
    set((state) => {
      const existing = state.liveEmployees[employee_id];
      if (!existing) return state;   // not yet seeded — ignore
      return {
        liveEmployees: {
          ...state.liveEmployees,
          [employee_id]: { ...existing, is_online },
        },
        lastUpdated: new Date().toISOString(),
      };
    }),


  // ── Remove a specific employee ─────────────────────────────────
  removeEmployee: (employee_id) =>
    set((state) => {
      const updated = { ...state.liveEmployees };
      delete updated[employee_id];
      return { liveEmployees: updated };
    }),


  // ── Clear all (admin logout) ───────────────────────────────────
  clearAll: () => set({ liveEmployees: {}, lastUpdated: null }),


  // ── Derived helpers ────────────────────────────────────────────
  getActiveEmployees: () => Object.values(get().liveEmployees).filter((e) => !isStale(e)),
  getStaleEmployees:  () => Object.values(get().liveEmployees).filter(isStale),
  getEmployeeById:    (id) => get().liveEmployees[id],
  getOnlineCount:     () => Object.values(get().liveEmployees).filter((e) => !isStale(e)).length,
  getTotalCount:      () => Object.keys(get().liveEmployees).length,
}));
