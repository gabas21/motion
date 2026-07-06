import { create } from 'zustand';
import API from '../lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  timezone: string;
  plan: string;
  role?: string;
}

interface AuthState {
  user: User | null;
  // token tidak disimpan di JS state — auth dikelola oleh HTTP-only cookie backend
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  clearError: () => void;
  updateProfile: (data: { name: string; timezone: string; plan?: string; currentPassword?: string; newPassword?: string }) => Promise<boolean>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.post('/auth/login', { email, password });
      const { user } = response.data.data;
      // Token JWT dikelola oleh HTTP-only cookie yang di-set backend — tidak disimpan di JS
      localStorage.setItem('motion_user', JSON.stringify(user));
      set({ user, isAuthenticated: true, isLoading: false, isInitialized: true });
      return true;
    } catch (error: any) {
      const errMsg = error.response?.data?.error || 'Login failed. Please check your credentials.';
      set({ error: errMsg, isLoading: false });
      return false;
    }
  },

  signup: async (name, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.post('/auth/register', { name, email, password });
      const { user } = response.data.data;
      // Token JWT dikelola oleh HTTP-only cookie yang di-set backend — tidak disimpan di JS
      localStorage.setItem('motion_user', JSON.stringify(user));
      set({ user, isAuthenticated: true, isLoading: false, isInitialized: true });
      return true;
    } catch (error: any) {
      const errMsg = error.response?.data?.error || 'Registration failed.';
      set({ error: errMsg, isLoading: false });
      return false;
    }
  },

  logout: () => {
    // Panggil backend logout agar HTTP-only cookie dihapus dari browser
    API.post('/auth/logout').catch((err) => console.error('Failed to log out from backend:', err));
    localStorage.removeItem('motion_user');
    set({ user: null, isAuthenticated: false, error: null, isInitialized: true });
  },

  fetchMe: async () => {
    try {
      const response = await API.get('/auth/me');
      const user = response.data.data;
      localStorage.setItem('motion_user', JSON.stringify(user));
      set({ user, isAuthenticated: true, isLoading: false, isInitialized: true });
    } catch (error) {
      localStorage.removeItem('motion_user');
      set({ user: null, isAuthenticated: false, isLoading: false, isInitialized: true });
    }
  },

  initializeAuth: async () => {
    if (typeof window === 'undefined') return;

    // Coba tampilkan data user dari cache lokal terlebih dahulu agar UI tidak blank
    const userStr = localStorage.getItem('motion_user');
    let cachedUser = null;
    try {
      cachedUser = userStr ? JSON.parse(userStr) : null;
    } catch (_) {}

    if (cachedUser) {
      set({ user: cachedUser, isAuthenticated: true });
    }

    // Validasi sesi ke backend via HTTP-only cookie (bukan localStorage token)
    try {
      const response = await API.get('/auth/me');
      const user = response.data.data;
      localStorage.setItem('motion_user', JSON.stringify(user));
      set({ user, isAuthenticated: true, isLoading: false, isInitialized: true });
    } catch (error: any) {
      // Cookie tidak valid, expired, backend timeout, atau network error —
      // tetap set isInitialized: true agar skeleton login hilang dan form tampil.
      // Jika ada cache lokal tapi validasi gagal, bersihkan state untuk keamanan.
      localStorage.removeItem('motion_user');
      const isTimeout = error?.code === 'ECONNABORTED' || error?.message?.includes('timeout');
      const isNetworkErr = !error?.response;
      if (isTimeout || isNetworkErr) {
        // Backend belum siap — tampilkan form login dengan pesan informatif
        // tapi jangan set isAuthenticated agar user bisa login ulang
        set({ user: null, isAuthenticated: false, isLoading: false, isInitialized: true });
      } else {
        // HTTP error (401, 403, dll) — sesi tidak valid
        set({ user: null, isAuthenticated: false, isLoading: false, isInitialized: true });
      }
    }
  },

  clearError: () => set({ error: null }),

  updateProfile: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.put('/auth/me', data);
      const user = response.data.data;
      localStorage.setItem('motion_user', JSON.stringify(user));
      set({ user, isLoading: false });
      return true;
    } catch (error: any) {
      let errMsg = 'Gagal memperbarui profil.';

      if (error.response?.status === 401) {
        errMsg = 'Sesi login tidak valid atau telah kedaluwarsa. Silakan login ulang.';
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errMsg = 'Koneksi ke server timeout. Periksa apakah backend sudah berjalan.';
      } else if (!error.response) {
        // Network error — backend mati atau tidak dapat dijangkau
        errMsg = 'Tidak dapat menghubungi server. Periksa koneksi internet atau backend.';
      } else if (error.response?.data?.error) {
        errMsg = error.response.data.error;
      }

      set({ error: errMsg, isLoading: false });
      return false;
    }
  },
}));
