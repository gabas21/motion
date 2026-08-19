import { create } from 'zustand';
import API from '../lib/api';

export interface ProviderInfo {
  configured: boolean;
  keyLast4?: string;
  isValid?: boolean;
  validatedAt?: string;
}

export interface AIConfigSummary {
  hasCustomKey: boolean;
  providers: {
    gemini: ProviderInfo;
    groq: ProviderInfo;
    openrouter: ProviderInfo;
  };
}

interface AIConfigState {
  summary: AIConfigSummary | null;
  isLoading: boolean;
  error: string | null;
  successMessage: string | null;
  fetchStatus: () => Promise<void>;
  saveKeys: (keys: { gemini_key?: string; groq_key?: string; openrouter_key?: string }) => Promise<boolean>;
  saveSingleKey: (provider: string, apiKey: string) => Promise<boolean>;
  deleteKey: (provider: string) => Promise<boolean>;
  clearError: () => void;
  clearSuccessMessage: () => void;
}

export const useAIConfig = create<AIConfigState>((set, get) => ({
  summary: null,
  isLoading: false,
  error: null,
  successMessage: null,

  fetchStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.get('/profile/ai-config');
      set({ summary: response.data, isLoading: false });
    } catch (err: any) {
      // Fallback try legacy endpoint
      try {
        const fallbackResp = await API.get('/ai/config');
        set({ summary: fallbackResp.data, isLoading: false });
      } catch (fallbackErr: any) {
        set({ error: err.response?.data?.error || 'Gagal memuat status konfigurasi API Key.', isLoading: false });
      }
    }
  },

  saveKeys: async (keys) => {
    set({ isLoading: true, error: null, successMessage: null });
    try {
      const response = await API.put('/ai/config', keys);
      set({ 
        successMessage: response.data.message || 'Konfigurasi API Key berhasil diverifikasi & disimpan!', 
        summary: response.data.summary || get().summary,
        isLoading: false 
      });
      await get().fetchStatus();
      return true;
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Gagal menyimpan konfigurasi API Key.', isLoading: false });
      return false;
    }
  },

  saveSingleKey: async (provider: string, apiKey: string) => {
    set({ isLoading: true, error: null, successMessage: null });
    try {
      const response = await API.put('/profile/ai-config', { provider, apiKey });
      set({
        successMessage: response.data.message || `API Key ${provider} berhasil diverifikasi & disimpan!`,
        summary: response.data.summary || get().summary,
        isLoading: false
      });
      await get().fetchStatus();
      return true;
    } catch (err: any) {
      set({ error: err.response?.data?.error || `Gagal memverifikasi API Key ${provider}.`, isLoading: false });
      return false;
    }
  },

  deleteKey: async (provider: string) => {
    set({ isLoading: true, error: null, successMessage: null });
    try {
      const response = await API.delete(`/profile/ai-config/${provider}`);
      set({
        successMessage: response.data.message || `API Key ${provider} berhasil dihapus.`,
        summary: response.data.summary || get().summary,
        isLoading: false
      });
      await get().fetchStatus();
      return true;
    } catch (err: any) {
      set({ error: err.response?.data?.error || `Gagal menghapus API Key ${provider}.`, isLoading: false });
      return false;
    }
  },

  clearError: () => set({ error: null }),
  clearSuccessMessage: () => set({ successMessage: null }),
}));
