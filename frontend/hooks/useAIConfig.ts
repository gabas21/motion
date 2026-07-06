import { create } from 'zustand';
import API from '../lib/api';

export interface AIConfigStatus {
  gemini_configured: boolean;
  groq_configured: boolean;
  openrouter_configured: boolean;
}

interface AIConfigState {
  status: AIConfigStatus | null;
  isLoading: boolean;
  error: string | null;
  successMessage: string | null;
  fetchStatus: () => Promise<void>;
  saveKeys: (keys: { gemini_key?: string; groq_key?: string; openrouter_key?: string }) => Promise<boolean>;
  clearError: () => void;
  clearSuccessMessage: () => void;
}

export const useAIConfig = create<AIConfigState>((set) => ({
  status: null,
  isLoading: false,
  error: null,
  successMessage: null,

  fetchStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.get('/ai/config');
      set({ status: response.data, isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Gagal memuat status konfigurasi API Key.', isLoading: false });
    }
  },

  saveKeys: async (keys) => {
    set({ isLoading: true, error: null, successMessage: null });
    try {
      const response = await API.put('/ai/config', keys);
      set({ successMessage: response.data.message || 'Konfigurasi API Key berhasil disimpan', isLoading: false });
      // Refresh status after saving
      const statusResponse = await API.get('/ai/config');
      set({ status: statusResponse.data });
      return true;
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Gagal menyimpan konfigurasi API Key.', isLoading: false });
      return false;
    }
  },

  clearError: () => set({ error: null }),
  clearSuccessMessage: () => set({ successMessage: null }),
}));
