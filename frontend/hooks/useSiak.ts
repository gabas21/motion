import { create } from 'zustand';
import API from '../lib/api';

export interface SiakGrade {
	id: string;
	semester: string;
	kodeMatkul: string;
	namaMatkul: string;
	sks: number;
	nilaiHuruf: string;
	nilaiAngka: number;
	mutu: number;
}

export interface SiakSchedule {
	id: string;
	kodeMatkul: string;
	namaMatkul: string;
	hari: string;
	jamMulai: string;
	jamSelesai: string;
	ruangan: string;
	dosen: string;
	sks: number;
	semester?: string;
}

export interface SiakExam {
	id: string;
	kodeMatkul: string;
	namaMatkul: string;
	tanggalUjian: string | null;
	jamMulai: string;
	jamSelesai: string;
	ruangan: string;
	jenisUjian: string;
	semester?: string;
}

export interface SiakSummary {
	nim: string;
	ipk: number;
	totalSks: number;
	totalMutu: number;
	lastSyncAt: string | null;
}

export interface SiakStatus {
	isConnected: boolean;
	summary: SiakSummary | null;
	grades: SiakGrade[];
}

interface SiakState {
	status: SiakStatus | null;
	schedule: SiakSchedule[];
	exams: SiakExam[];
	isLoading: boolean;
	isSyncing: boolean;
	error: string | null;
	fetchGrades: () => Promise<void>;
	fetchSchedule: () => Promise<void>;
	fetchExams: () => Promise<void>;
	connect: (nim: string, password: string) => Promise<boolean>;
	syncNow: () => Promise<boolean>;
	syncSchedule: () => Promise<boolean>;
	syncExams: () => Promise<boolean>;
	disconnect: () => Promise<boolean>;
	clearError: () => void;
}

export const useSiak = create<SiakState>((set, get) => ({
	status: null,
	schedule: [],
	exams: [],
	isLoading: false,
	isSyncing: false,
	error: null,

	fetchGrades: async () => {
		set({ isLoading: true, error: null });
		try {
			const response = await API.get('/siak/grades');
			if (response.data?.success && response.data.data) {
				const data = response.data.data;
				set({
					status: {
						isConnected: data.isConnected,
						summary: data.summary || null,
						grades: data.grades || [],
					},
					isLoading: false,
				});
			}
		} catch (err: any) {
			if (err?.response?.status === 401 || err?.response?.status === 403) {
				set({ status: { isConnected: false, summary: null, grades: [] }, isLoading: false });
			} else {
				set({ error: err.response?.data?.message || 'Gagal memuat data nilai SIAK', isLoading: false });
			}
		}
	},

	fetchSchedule: async () => {
		try {
			const response = await API.get('/siak/schedule');
			if (response.data?.success) {
				set({ schedule: response.data.data || [] });
			}
		} catch (err: any) {
			console.error('Gagal fetch jadwal SIAK:', err);
			set({ schedule: [] });
		}
	},

	fetchExams: async () => {
		try {
			const response = await API.get('/siak/exams');
			if (response.data?.success) {
				set({ exams: response.data.data || [] });
			}
		} catch (err: any) {
			console.error('Gagal fetch ujian SIAK:', err);
			set({ exams: [] });
		}
	},

	connect: async (nim, password) => {
		set({ isLoading: true, error: null });
		try {
			const response = await API.post('/siak/connect', { nim, password });
			if (response.data?.success) {
				const { summary, grades } = response.data.data;
				set({
					status: {
						isConnected: true,
						summary,
						grades: grades || [],
					},
					isLoading: false,
				});
				get().fetchSchedule();
				get().fetchExams();
				return true;
			}
			return false;
		} catch (err: any) {
			set({ error: err.response?.data?.message || 'Gagal menghubungkan ke SIAK', isLoading: false });
			return false;
		}
	},

	syncNow: async () => {
		set({ isSyncing: true, error: null });
		try {
			const response = await API.post('/siak/sync');
			if (response.data?.success) {
				const { summary, grades } = response.data.data;
				set({
					status: {
						isConnected: true,
						summary,
						grades: grades || [],
					},
					isSyncing: false,
				});
				return true;
			}
			return false;
		} catch (err: any) {
			set({ error: err.response?.data?.message || 'Gagal sinkronisasi data SIAK', isSyncing: false });
			return false;
		}
	},

	syncSchedule: async () => {
		set({ isSyncing: true, error: null });
		try {
			const response = await API.post('/siak/sync-schedule');
			if (response.data?.success) {
				set({ schedule: response.data.data || [], isSyncing: false });
				return true;
			}
			return false;
		} catch (err: any) {
			set({ error: err.response?.data?.message || 'Gagal sinkronisasi jadwal', isSyncing: false });
			return false;
		}
	},

	syncExams: async () => {
		set({ isSyncing: true, error: null });
		try {
			const response = await API.post('/siak/sync-exams');
			if (response.data?.success) {
				set({ exams: response.data.data || [], isSyncing: false });
				return true;
			}
			return false;
		} catch (err: any) {
			set({ error: err.response?.data?.message || 'Gagal sinkronisasi ujian', isSyncing: false });
			return false;
		}
	},

	disconnect: async () => {
		set({ isLoading: true, error: null });
		try {
			const response = await API.delete('/siak/disconnect');
			if (response.data?.success) {
				set({
					status: {
						isConnected: false,
						summary: null,
						grades: [],
					},
					schedule: [],
					exams: [],
					isLoading: false,
				});
				return true;
			}
			return false;
		} catch (err: any) {
			set({ error: err.response?.data?.message || 'Gagal memutuskan koneksi SIAK', isLoading: false });
			return false;
		}
	},

	clearError: () => set({ error: null }),
}));
