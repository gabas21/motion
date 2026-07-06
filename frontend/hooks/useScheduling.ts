import { create } from 'zustand';
import API from '../lib/api';

export interface SchedulingPreference {
  id: string;
  userId: string;
  workHoursStart: number;
  workHoursEnd: number;
  breakDurationMinutes: number;
  allowWeekendScheduling: boolean;
  preferredTaskTime: string;
}

interface SchedulingState {
  preferences: SchedulingPreference | null;
  isLoading: boolean;
  error: string | null;
  fetchPreferences: () => Promise<void>;
  updatePreferences: (data: Partial<SchedulingPreference>) => Promise<boolean>;
  triggerAutoSchedule: (taskId: string) => Promise<boolean>;
  clearError: () => void;
}

export const useScheduling = create<SchedulingState>((set, get) => ({
  preferences: null,
  isLoading: false,
  error: null,

  // Mengambil preferensi jam kerja dari backend
  fetchPreferences: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.get('/scheduling/preferences');
      set({ preferences: response.data.data, isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Gagal mengambil preferensi jam kerja.', isLoading: false });
    }
  },

  // Memperbarui preferensi jam kerja ke backend
  updatePreferences: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.patch('/scheduling/preferences', data);
      set({ preferences: response.data.data, isLoading: false });
      return true;
    } catch (err: any) {
      let errMsg = 'Gagal memperbarui preferensi jam kerja.';

      if (err.response?.status === 401) {
        errMsg = 'Sesi login tidak valid atau telah kedaluwarsa. Silakan login ulang.';
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errMsg = 'Koneksi ke server timeout. Periksa apakah backend sudah berjalan.';
      } else if (!err.response) {
        errMsg = 'Tidak dapat menghubungi server. Periksa koneksi internet atau backend.';
      } else if (err.response?.data?.error) {
        errMsg = err.response.data.error;
      }

      set({ error: errMsg, isLoading: false });
      return false;
    }
  },

  // Memicu penjadwalan otomatis AI secara manual untuk tugas tertentu
  triggerAutoSchedule: async (taskId) => {
    set({ isLoading: true, error: null });
    try {
      await API.post('/scheduling/auto-schedule', { taskId });
      set({ isLoading: false });
      return true;
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Gagal memicu penjadwalan otomatis AI.', isLoading: false });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
