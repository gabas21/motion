import { create } from 'zustand';
import API from '../lib/api';

export interface MoodleExcuseLetter {
  id: string;
  userId: string;
  nama: string;
  nim: string;
  prodi: string;
  kelompok: string;
  courseId: string;
  courseName: string;
  hariTanggal: string;
  alasan: string;
  tanggalSurat: string;
  signatureBase64: string;
  createdAt: string;
  updatedAt: string;
}

interface ExcuseLettersState {
  excuses: MoodleExcuseLetter[];
  isLoading: boolean;
  error: string | null;
  fetchExcuses: () => Promise<void>;
  createExcuse: (payload: {
    nama: string;
    nim: string;
    prodi: string;
    kelompok: string;
    courseId: string;
    courseName: string;
    hariTanggal: string;
    alasan: string;
    tanggalSurat: string;
    signatureBase64: string;
  }) => Promise<{ success: boolean; pdfUrl?: string; error?: string }>;
  deleteExcuse: (id: string) => Promise<boolean>;
  clearError: () => void;
}

export const useExcuseLetters = create<ExcuseLettersState>((set, get) => ({
  excuses: [],
  isLoading: false,
  error: null,

  fetchExcuses: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.get('/moodle/excuse-letters');
      if (response.data?.success) {
        set({ excuses: response.data.data || [], isLoading: false });
      } else {
        set({ excuses: [], isLoading: false });
      }
    } catch (err: any) {
      set({
        error: err.response?.data?.error || 'Gagal memuat riwayat surat izin.',
        isLoading: false,
      });
    }
  },

  createExcuse: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.post('/moodle/excuse-letters', payload);
      if (response.data?.success) {
        // Refresh list
        await get().fetchExcuses();
        set({ isLoading: false });
        return { success: true, pdfUrl: response.data.data.pdfUrl };
      }
      set({ isLoading: false });
      return { success: false, error: 'Respons server tidak valid' };
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Gagal membuat surat izin praktikum.';
      set({ error: errMsg, isLoading: false });
      return { success: false, error: errMsg };
    }
  },

  deleteExcuse: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.delete(`/moodle/excuse-letters/${id}`);
      if (response.data?.success) {
        set((state) => ({
          excuses: state.excuses.filter((item) => item.id !== id),
          isLoading: false,
        }));
        return true;
      }
      set({ isLoading: false });
      return false;
    } catch (err: any) {
      set({
        error: err.response?.data?.error || 'Gagal menghapus surat izin.',
        isLoading: false,
      });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
