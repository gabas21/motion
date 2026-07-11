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
	isLoading: boolean;
	isSyncing: boolean;
	error: string | null;
	fetchGrades: () => Promise<void>;
	connect: (nim: string, password: string) => Promise<boolean>;
	syncNow: () => Promise<boolean>;
	disconnect: () => Promise<boolean>;
	clearError: () => void;
}

export const useSiak = create<SiakState>((set, get) => ({
	status: null,
	isLoading: false,
	isSyncing: false,
	error: null,

	fetchGrades: async () => {
		set({ isLoading: true, error: null });
		try {
			const response = await API.get('/siak/grades');
			if (response.data?.success) {
				set({ status: response.data.data, isLoading: false });
			}
		} catch (err: any) {
			if (err?.response?.status === 401 || err?.response?.status === 403) {
				set({ status: { isConnected: false, summary: null, grades: [] }, isLoading: false });
			} else {
				set({ error: err.response?.data?.message || 'Gagal memuat data nilai SIAK', isLoading: false });
			}
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
						grades,
					},
					isLoading: false,
				});
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
						grades,
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
