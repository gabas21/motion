import { create } from 'zustand';
import API from '../lib/api';

export interface MoodleAssignment {
  id: string;
  userId: string;
  moodleAssignId: string;
  courseId: string;
  courseName: string;
  name: string;
  dueDate: string | null; // ISO string format
  eventType: 'assign' | 'quiz' | 'forum' | 'other';
  submissionStatus: 'new' | 'draft' | 'submitted';
  sectionName?: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface MoodleCourse {
  id: string;
  userId: string;
  moodleCourseId: string;
  name: string;
  shortname?: string;
  totalAssignments: number;
  pendingAssignments: number;
  createdAt: string;
  updatedAt: string;
}

export interface MoodleStatus {
  isConnected: boolean;
  moodleUsername?: string;
  lastSyncAt?: string | null;
}

interface MoodleState {
  status: MoodleStatus | null;
  assignments: MoodleAssignment[];
  upcomingAssignments: MoodleAssignment[];
  courses: MoodleCourse[];
  courseAssignments: Record<string, MoodleAssignment[]>; // keyed by moodleCourseId
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  fetchStatus: () => Promise<void>;
  fetchAssignments: (filter?: 'upcoming' | 'overdue' | 'all') => Promise<void>;
  fetchCourses: () => Promise<void>;
  fetchCourseAssignments: (courseId: string) => Promise<void>;
  connect: (username: string, password: string) => Promise<boolean>;
  disconnect: () => Promise<boolean>;
  syncNow: () => Promise<boolean>;
  clearError: () => void;
}

export const useMoodle = create<MoodleState>((set, get) => ({
  status: null,
  assignments: [],
  upcomingAssignments: [],
  courses: [],
  courseAssignments: {},
  isLoading: false,
  isSyncing: false,
  error: null,

  fetchStatus: async () => {
    try {
      const response = await API.get('/moodle/status');
      if (response.data?.success) {
        set({ status: response.data.data });
      }
    } catch (err: any) {
      // Jangan reset status jika error jaringan (backend sedang restart)
      // Hanya reset jika server bilang 401/403 (unauthorized)
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        set({ status: { isConnected: false } });
      }
      // Biarkan status yang ada tetap ditampilkan jika backend tidak merespon
    }
  },

// GET assignments with optional page/limit (normalizes paginated/array structures to keep typescript compatibility)
  fetchAssignments: async (filter = 'all') => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.get(`/moodle/assignments?filter=${filter}`);
      if (response.data?.success) {
        const resData = response.data.data;
        const data = Array.isArray(resData) ? resData : (resData?.assignments || []);
        if (filter === 'upcoming') {
          set({ upcomingAssignments: data, isLoading: false });
        } else {
          set({ assignments: data, isLoading: false });
        }
      }
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Gagal memuat tugas WeLearn.', isLoading: false });
    }
  },

  fetchCourses: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.get('/moodle/courses');
      if (response.data?.success) {
        set({ courses: response.data.data || [], isLoading: false });
      }
    } catch (err: any) {
      console.warn('Gagal memuat daftar mata kuliah, mencoba kembali dalam 2 detik...', err);
      // Tunggu 2 detik dan coba lagi sekali
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        const response = await API.get('/moodle/courses');
        if (response.data?.success) {
          set({ courses: response.data.data || [], isLoading: false });
          return;
        }
      } catch (retryErr: any) {
        set({ error: retryErr.response?.data?.error || 'Gagal memuat daftar mata kuliah.', isLoading: false });
      }
    }
  },

  fetchCourseAssignments: async (courseId: string) => {
    try {
      const response = await API.get(`/moodle/courses/${courseId}/assignments`);
      if (response.data?.success) {
        set((state) => ({
          courseAssignments: {
            ...state.courseAssignments,
            [courseId]: response.data.data || [],
          },
        }));
      }
    } catch (err: any) {
      console.error('Gagal memuat tugas matkul:', err);
    }
  },

  connect: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      await API.post('/moodle/connect', { username, password });
      await get().fetchStatus();
      if (get().status?.isConnected) {
        await get().fetchCourses();
        await get().fetchAssignments('all');
        await get().fetchAssignments('upcoming');
      }
      set({ isLoading: false });
      return true;
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Gagal menghubungkan akun WeLearn.';
      set({ error: errMsg, isLoading: false });
      return false;
    }
  },

  disconnect: async () => {
    set({ isLoading: true, error: null });
    try {
      await API.post('/moodle/disconnect');
      set({
        status: { isConnected: false },
        assignments: [],
        upcomingAssignments: [],
        courses: [],
        courseAssignments: {},
        isLoading: false,
      });
      return true;
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Gagal memutuskan hubungan WeLearn.', isLoading: false });
      return false;
    }
  },

  syncNow: async () => {
    set({ isSyncing: true, error: null });
    try {
      // Batas waktu 60 detik khusus untuk proses sinkronisasi WeLearn yang berat
      await API.post('/moodle/sync', null, { timeout: 60000 });

      await get().fetchStatus();
      await get().fetchCourses();
      await get().fetchAssignments('all');
      await get().fetchAssignments('upcoming');
      set({ isSyncing: false });
      return true;
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Gagal menyelaraskan tugas WeLearn.', isSyncing: false });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
