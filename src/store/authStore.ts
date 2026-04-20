// src/store/authStore.ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from '@react-native-firebase/auth';
import { apiGet, apiPost, setLogoutHandler, clearTokenCache } from '../services/api';
import { Employee } from '../types';

interface AuthStore {
  employee:        Employee | null;
  isAuthenticated: boolean;
  loading:         boolean;
  error:           string | null;
  login:           (email: string, password: string) => Promise<void>;
  logout:          () => Promise<void>;
  changePassword:  (newPassword: string) => Promise<void>;
  loadStoredAuth:  () => Promise<void>;
  initAuthListener: () => () => void;
  clearError:      () => void;
}

const STORAGE_KEY = 'auth.employee.v1';

function resetState() {
  return {
    employee:        null as Employee | null,
    isAuthenticated: false,
    loading:         false,
    error:           null as string | null,
  };
}

async function persistEmployee(employee: Employee | null) {
  try {
    if (employee) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(employee));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {
    console.warn('[Auth] Failed to persist employee:', e);
  }
}

async function readStoredEmployee(): Promise<Employee | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Employee;
  } catch (e) {
    console.warn('[Auth] Failed to read stored employee:', e);
    return null;
  }
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  ...resetState(),

  clearError: () => set({ error: null }),

  initAuthListener: () => {
    setLogoutHandler(async () => {
      clearTokenCache();
      set(resetState());
      await persistEmployee(null);
      try { await signOut(getAuth()); } catch (_) {}
    });

    return onAuthStateChanged(getAuth(), (firebaseUser) => {
      if (!firebaseUser && get().isAuthenticated) {
        clearTokenCache();
        set(resetState());
        persistEmployee(null);
      }
    });
  },

  loadStoredAuth: async () => {
    set({ loading: true });
    try {
      const firebaseUser = getAuth().currentUser;
      if (!firebaseUser) {
        // No Firebase user; maybe we only have cached employee (for UI hints)
        const cached = await readStoredEmployee();
        if (cached) {
          set({ employee: cached, isAuthenticated: false });
        } else {
          set(resetState());
        }
        return;
      }

      try {
        const employee = await apiGet('/auth/me') as Employee;

        const currentUser = getAuth().currentUser;
        if (!currentUser || currentUser.uid !== firebaseUser.uid) {
          set(resetState());
          await persistEmployee(null);
          return;
        }

        set({ employee, isAuthenticated: true });
        await persistEmployee(employee);
      } catch (e: any) {
        const netState = await NetInfo.fetch();
        const offline = netState.isConnected === false || netState.isInternetReachable === false;

        if (offline) {
          // Offline: fall back to cached employee if any
          const cached = await readStoredEmployee();
          if (cached) {
            set({ employee: cached, isAuthenticated: true });
            return;
          }
          set(resetState());
          return;
        }

        // Online but /auth/me failed → real auth error; clear everything
        clearTokenCache();
        set(resetState());
        await persistEmployee(null);
        try { await signOut(getAuth()); } catch (_) {}
      }
    } finally {
      set({ loading: false });
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      clearTokenCache();
      await signInWithEmailAndPassword(getAuth(), email, password);
      const employee = await apiGet('/auth/me') as Employee;
      set({ employee, isAuthenticated: true, error: null });
      await persistEmployee(employee);
    } catch (e: any) {
      const message = mapFirebaseError(e?.code) ?? e?.message ?? 'Login failed';
      clearTokenCache();
      set({ ...resetState(), error: message });
      await persistEmployee(null);
      throw new Error(message);
    } finally {
      set({ loading: false });
    }
  },

  changePassword: async (newPassword: string) => {
    set({ loading: true, error: null });
    try {
      await apiPost('/auth/change-password', { new_password: newPassword });
      clearTokenCache();
      set(resetState());
      await persistEmployee(null);
      try { await signOut(getAuth()); } catch (_) {}
    } catch (e: any) {
      const message = e?.message ?? 'Failed to change password';
      set({ error: message, loading: false });
      throw new Error(message);
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    clearTokenCache();
    set(resetState());
    await persistEmployee(null);
    try {
      await apiPost('/auth/logout').catch(() => {});
      await signOut(getAuth());
    } catch (e) {
      console.warn('[Auth] Logout error (non-fatal):', e);
    }
  },
}));

function mapFirebaseError(code?: string): string | null {
  switch (code) {
    case 'auth/invalid-email':          return 'Invalid email address.';
    case 'auth/user-not-found':         return 'No account found for this email.';
    case 'auth/wrong-password':         return 'Incorrect password.';
    case 'auth/invalid-credential':     return 'Incorrect email or password.';
    case 'auth/user-disabled':          return 'This account has been disabled.';
    case 'auth/too-many-requests':      return 'Too many attempts. Try again later.';
    case 'auth/network-request-failed': return 'Network error. Check your connection.';
    default:                            return null;
  }
}