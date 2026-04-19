// src/store/authStore.ts
import { create } from 'zustand';
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

function resetState() {
  return {
    employee:        null as Employee | null,
    isAuthenticated: false,
    loading:         false,
    error:           null as string | null,
  };
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  ...resetState(),

  clearError: () => set({ error: null }),

  initAuthListener: () => {
    setLogoutHandler(async () => {
      clearTokenCache();
      set(resetState());
      try { await signOut(getAuth()); } catch (_) {}
    });

    return onAuthStateChanged(getAuth(), (firebaseUser) => {
      if (!firebaseUser && get().isAuthenticated) {
        clearTokenCache();
        set(resetState());
      }
    });
  },

  loadStoredAuth: async () => {
    set({ loading: true });
    try {
      const firebaseUser = getAuth().currentUser;
      if (!firebaseUser) { set(resetState()); return; }

      const employee = await apiGet('/auth/me') as Employee

      const currentUser = getAuth().currentUser;
      if (!currentUser || currentUser.uid !== firebaseUser.uid) {
        set(resetState()); return;
      }
      set({ employee, isAuthenticated: true });
    } catch (_) {
      clearTokenCache();
      set(resetState());
      try { await signOut(getAuth()); } catch (_) {}
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
    } catch (e: any) {
      const message = mapFirebaseError(e?.code) ?? e?.message ?? 'Login failed';
      clearTokenCache();
      set({ ...resetState(), error: message });
      throw new Error(message);
    } finally {
      set({ loading: false });
    }
  },

  // ── Change password ─────────────────────────────────────────────
  // Backend revokes all refresh tokens after update, so we force
  // a full logout — the employee must re-authenticate.
  changePassword: async (newPassword: string) => {
    set({ loading: true, error: null });
    try {
      await apiPost('/auth/change-password', { new_password: newPassword });
      // Force logout — existing token is now invalid
      clearTokenCache();
      set(resetState());
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