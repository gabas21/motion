'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
	GraduationCap, RefreshCw, Unlink, Lock, User, 
	BookOpen, Award, CheckCircle2, ChevronRight,
	AlertTriangle, ShieldCheck, Sparkles, BookMarked,
	Download, FileText, CalendarDays, Calculator, Target, TrendingUp, Sliders
} from 'lucide-react';
import { useSiak } from '../../hooks/useSiak';
import { toast } from '../../hooks/useToast';
import { Skeleton } from '../ui/Skeleton';
import API from '../../lib/api';

export default function SiakTab() {
	const { 
		status, schedule, exams, isLoading, isSyncing, error, 
		fetchGrades, fetchSchedule, fetchExams, connect, syncNow, 
		syncSchedule, syncExams, disconnect, clearError 
	} = useSiak();
	
	const [nim, setNim] = useState('');
	const [password, setPassword] = useState('');
	const [activeSemester, setActiveSemester] = useState<string>('all');
	const [subTab, setSubTab] = useState<'grades' | 'schedule' | 'exams'>('grades');
	
	// IPK Target Simulator state
	const [showSimulator, setShowSimulator] = useState(false);
	const [targetOverrides, setTargetOverrides] = useState<Record<string, string>>({});

	const safeSchedule = Array.isArray(schedule) ? schedule : [];
	const safeExams = Array.isArray(exams) ? exams : [];
	const safeGrades = Array.isArray(status?.grades) ? status.grades : [];

	const letterToPoint: Record<string, number> = {
		'A': 4.0, 'A-': 3.75, 'B+': 3.5, 'B': 3.0, 'B-': 2.75,
		'C+': 2.5, 'C': 2.0, 'D': 1.0, 'E': 0.0
	};

	const projectedSummary = useMemo(() => {
		if (safeGrades.length === 0) return { ipk: 0, totalSks: 0, diff: 0 };
		let totalSks = 0;
		let totalMutu = 0;

		safeGrades.forEach(g => {
			const letter = targetOverrides[g.id] || g.nilaiHuruf || 'B';
			const point = letterToPoint[letter.toUpperCase().trim()] ?? (g.nilaiAngka || 3.0);
			const sks = g.sks || 0;
			totalSks += sks;
			totalMutu += sks * point;
		});

		const ipk = totalSks > 0 ? totalMutu / totalSks : 0;
		const baseIpk = status?.summary?.ipk || 0;
		const diff = ipk - baseIpk;
		return { ipk, totalSks, diff };
	}, [safeGrades, targetOverrides, status?.summary?.ipk]);

	// Muat data saat halaman dibuka pertama kali
	useEffect(() => {
		fetchGrades();
		fetchSchedule();
		fetchExams();
	}, [fetchGrades, fetchSchedule, fetchExams]);

	// Tampilkan error jika ada
	useEffect(() => {
		if (error) {
			toast.error(error);
			clearError();
		}
	}, [error, clearError]);

	const handleConnect = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!nim || !password) {
			toast.warning('NIM dan password wajib diisi!');
			return;
		}

		const success = await connect(nim, password);
		if (success) {
			toast.success('Akun SIAK berhasil terhubung.');
			setPassword('');
		}
	};

	const handleSync = async () => {
		if (subTab === 'grades') {
			const success = await syncNow();
			if (success) toast.success('Data nilai SIAK terbaru berhasil dimuat.');
		} else if (subTab === 'schedule') {
			const success = await syncSchedule();
			if (success) toast.success('Jadwal kuliah SIAK berhasil disinkronkan.');
		} else if (subTab === 'exams') {
			const success = await syncExams();
			if (success) toast.success('Jadwal ujian SIAK berhasil disinkronkan.');
		}
	};

	const handleDisconnect = async () => {
		if (confirm('Apakah Anda yakin ingin memutuskan hubungan akun SIAK dan menghapus semua cache nilai, jadwal, & ujian dari sistem?')) {
			const success = await disconnect();
			if (success) {
				toast.info('Akun SIAK berhasil diputus dan cache dihapus.');
				setNim('');
			}
		}
	};

	const handleExportPDF = async () => {
		try {
			const response = await API.get('/siak/export/transcript.pdf', { responseType: 'blob' });
			const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
			const link = document.createElement('a');
			link.href = url;
			link.setAttribute('download', `Transkrip_SIAK_${status?.summary?.nim || 'Nilai'}.pdf`);
			document.body.appendChild(link);
			link.click();
			link.remove();
			toast.success('Transkrip Nilai PDF berhasil diunduh!');
		} catch (err: any) {
			toast.error('Gagal mengunduh PDF transkrip.');
		}
	};

	const handleExportICS = async () => {
		try {
			const response = await API.get('/siak/export/schedule.ics', { responseType: 'blob' });
			const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/calendar' }));
			const link = document.createElement('a');
			link.href = url;
			link.setAttribute('download', 'Jadwal_Kuliah_SIAK.ics');
			document.body.appendChild(link);
			link.click();
			link.remove();
			toast.success('Jadwal iCal (.ics) berhasil diunduh!');
		} catch (err: any) {
			toast.error('Gagal mengunduh iCal jadwal.');
		}
	};

	// Dapatkan semua daftar semester unik untuk filter
	const semesters = safeGrades.length > 0 
		? ['all', ...Array.from(new Set(safeGrades.map(g => g.semester))).sort()]
		: ['all'];

	// Filter grades berdasarkan semester terpilih
	const filteredGrades = safeGrades.length > 0
		? activeSemester === 'all'
			? safeGrades
			: safeGrades.filter(g => g.semester === activeSemester)
		: [];

	// Hitung summary dinamis untuk semester yang aktif
	const activeSks = filteredGrades.reduce((sum, g) => sum + (g.sks || 0), 0);
	const activeMutu = filteredGrades.reduce((sum, g) => sum + (g.mutu || 0), 0);
	const activeIpk = activeSks > 0 ? activeMutu / activeSks : 0.0;

	// Render Loading state
	if (isLoading && !status) {
		return (
			<div className="space-y-6">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
					<Skeleton className="h-32 w-full rounded-2xl border-2 border-black" />
					<Skeleton className="h-32 w-full rounded-2xl border-2 border-black" />
					<Skeleton className="h-32 w-full rounded-2xl border-2 border-black" />
				</div>
				<Skeleton className="h-96 w-full rounded-3xl border-2 border-black" />
			</div>
		);
	}

	// TAMPILAN 1: Form hubungkan jika belum terhubung
	if (!status?.isConnected) {
		return (
			<div className="max-w-2xl mx-auto py-6">
				<div className="bg-[#FAF9F6] border-4 border-black shadow-[8px_8px_0px_#000] rounded-[24px] p-8 relative overflow-hidden">
					{/* Background decorative stripes */}
					<div className="absolute top-0 right-0 w-36 h-36 bg-neoYellow border-l-4 border-b-4 border-black rotate-12 translate-x-12 -translate-y-12 opacity-80"></div>
					
					<div className="flex items-start gap-5 mb-8 relative z-10">
						<span className="p-4 bg-[#A3E635] border-3 border-black rounded-[18px] shadow-[4px_4px_0px_#000] flex-shrink-0">
							<GraduationCap className="w-10 h-10 text-black stroke-[2.5]" />
						</span>
						<div>
							<div className="inline-flex items-center gap-1.5 px-3 py-1 bg-neoYellow border-2 border-black rounded-full text-[9px] font-black uppercase tracking-wider mb-2 shadow-[2px_2px_0px_#000]">
								<Sparkles className="w-3.5 h-3.5 text-black" /> Integrasi Akademik
							</div>
							<h3 className="text-2xl font-black text-black font-heading tracking-wide uppercase leading-tight">Hubungkan SIAK Wicida</h3>
							<p className="text-xs font-bold text-black/60 mt-1">Pantau rekapitulasi nilai IPK, jadwal kuliah, dan jadwal ujian Anda secara otomatis.</p>
						</div>
					</div>

					<div className="bg-[#FFE4E6] border-3 border-black rounded-[20px] p-5 mb-8 flex gap-4 text-xs font-bold text-black leading-relaxed shadow-[4px_4px_0px_#000] relative z-10">
						<div className="p-2 bg-[#F43F5E] border-2 border-black rounded-xl text-white shrink-0 self-start shadow-[2px_2px_0px_#000]">
							<ShieldCheck className="w-6 h-6 stroke-[2.5]" />
						</div>
						<div>
							<p className="font-black text-black uppercase text-sm mb-1">Keamanan & Privasi Terjamin</p>
							Password SIAK Anda dienkripsi menggunakan algoritma **AES-256 (Enkripsi Simetris tingkat perbankan)**. Sistem kami hanya bertindak sebagai jembatan pembaca (*scraper*) untuk mengunduh rekap nilai, jadwal, dan ujian.
						</div>
					</div>

					<form onSubmit={handleConnect} className="space-y-6 relative z-10">
						<div className="space-y-2.5">
							<label className="text-xs font-black text-black uppercase tracking-wider block">NIM Mahasiswa</label>
							<div className="relative">
								<User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black stroke-[2.5]" />
								<input
									type="text"
									value={nim}
									onChange={(e) => setNim(e.target.value)}
									placeholder="Contoh: 2343092"
									className="w-full pl-12 pr-4 py-4 bg-white border-3 border-black rounded-[18px] text-sm font-black text-black placeholder:text-black/35 focus:outline-none focus:ring-0 focus:translate-x-[1px] focus:translate-y-[1px] focus:shadow-[6px_6px_0px_#000] transition-all shadow-[4px_4px_0px_#000]"
									required
								/>
							</div>
						</div>

						<div className="space-y-2.5">
							<label className="text-xs font-black text-black uppercase tracking-wider block">Password SIAK</label>
							<div className="relative">
								<Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black stroke-[2.5]" />
								<input
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder="Masukkan password portal SIAK Anda"
									className="w-full pl-12 pr-4 py-4 bg-white border-3 border-black rounded-[18px] text-sm font-black text-black placeholder:text-black/35 focus:outline-none focus:ring-0 focus:translate-x-[1px] focus:translate-y-[1px] focus:shadow-[6px_6px_0px_#000] transition-all shadow-[4px_4px_0px_#000]"
									required
								/>
							</div>
						</div>

						<button
							type="submit"
							disabled={isLoading}
							className="w-full py-4.5 bg-neoYellow hover:bg-yellow-400 border-3 border-black rounded-[18px] text-sm font-black text-black uppercase tracking-wider shadow-[6px_6px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[4px_4px_0px_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
						>
							{isLoading ? (
								<>
									<RefreshCw className="w-5 h-5 animate-spin text-black" /> Memproses Data SIAK...
								</>
							) : (
								<>
									<GraduationCap className="w-5 h-5" /> Mulai Hubungkan SIAK <ChevronRight className="w-5 h-5" />
								</>
							)}
						</button>
					</form>
				</div>
			</div>
		);
	}

	const summary = status.summary;
	const daysOrder = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

	return (
		<div className="space-y-6">
			{/* Sub-Tab Selector Navigation */}
			<div className="flex flex-wrap items-center justify-between gap-4 bg-[#FAF9F5] border-3 border-black p-3 rounded-[22px] shadow-[4px_4px_0px_#000]">
				<div className="flex flex-wrap items-center gap-2">
					<button
						onClick={() => setSubTab('grades')}
						className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all border-2 border-black flex items-center gap-2 cursor-pointer shadow-[2px_2px_0px_#000] ${
							subTab === 'grades' ? 'bg-black text-white shadow-none translate-x-[1px] translate-y-[1px]' : 'bg-white text-black hover:bg-slate-50'
						}`}
					>
						<GraduationCap className="w-4 h-4" /> Nilai &amp; IPK
					</button>

					<button
						onClick={() => { setSubTab('schedule'); if (safeSchedule.length === 0) fetchSchedule(); }}
						className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all border-2 border-black flex items-center gap-2 cursor-pointer shadow-[2px_2px_0px_#000] ${
							subTab === 'schedule' ? 'bg-black text-white shadow-none translate-x-[1px] translate-y-[1px]' : 'bg-white text-black hover:bg-slate-50'
						}`}
					>
						<BookMarked className="w-4 h-4" /> Jadwal Kuliah ({safeSchedule.length})
					</button>

					<button
						onClick={() => { setSubTab('exams'); if (safeExams.length === 0) fetchExams(); }}
						className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all border-2 border-black flex items-center gap-2 cursor-pointer shadow-[2px_2px_0px_#000] ${
							subTab === 'exams' ? 'bg-black text-white shadow-none translate-x-[1px] translate-y-[1px]' : 'bg-white text-black hover:bg-slate-50'
						}`}
					>
						<Award className="w-4 h-4" /> Jadwal Ujian ({safeExams.length})
					</button>
				</div>

				<div className="flex items-center gap-3">
					{subTab === 'grades' && (
						<button
							onClick={handleExportPDF}
							className="px-3.5 py-2 bg-[#60A5FA] border-2 border-black rounded-xl text-xs font-black text-black shadow-[2px_2px_0px_#000] hover:translate-x-[0.5px] hover:translate-y-[0.5px] active:translate-x-[1.5px] active:translate-y-[1.5px] flex items-center gap-1.5 cursor-pointer"
							title="Cetak PDF Transkrip Nilai"
						>
							<FileText className="w-3.5 h-3.5" /> PDF
						</button>
					)}

					{subTab === 'schedule' && (
						<button
							onClick={handleExportICS}
							className="px-3.5 py-2 bg-[#38E5FF] border-2 border-black rounded-xl text-xs font-black text-black shadow-[2px_2px_0px_#000] hover:translate-x-[0.5px] hover:translate-y-[0.5px] active:translate-x-[1.5px] active:translate-y-[1.5px] flex items-center gap-1.5 cursor-pointer"
							title="Export Jadwal Kuliah ke File iCal (.ics)"
						>
							<CalendarDays className="w-3.5 h-3.5" /> Export .ics
						</button>
					)}

					<button
						onClick={handleSync}
						disabled={isSyncing}
						className="px-3.5 py-2 bg-neoYellow border-2 border-black rounded-xl text-xs font-black text-black shadow-[2px_2px_0px_#000] hover:translate-x-[0.5px] hover:translate-y-[0.5px] active:translate-x-[1.5px] active:translate-y-[1.5px] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
					>
						<RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
						<span>{isSyncing ? 'Menyingkronkan...' : 'Sync Data'}</span>
					</button>

					<button
						onClick={handleDisconnect}
						className="px-3 py-2 bg-[#FFE4E6] text-[#E11D48] border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-[#FECDD3] flex items-center gap-1 cursor-pointer"
						title="Putuskan Hubungan SIAK"
					>
						<Unlink className="w-3.5 h-3.5" /> Putus
					</button>
				</div>
			</div>

			{/* SUB-TAB 1: NILAI & IPK */}
			{subTab === 'grades' && (
				<div className="space-y-8">
					{/* Summary Cards */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						{/* IPK Card */}
						<div className="bg-[#4ADE80] border-3 border-black shadow-[6px_6px_0px_#000] rounded-[22px] p-6 flex items-center justify-between relative overflow-hidden">
							<div className="space-y-1 z-10">
								<span className="text-[10px] font-black uppercase text-black/60 font-mono tracking-wider block">IPK AKUMULATIF</span>
								<h2 className="text-5xl font-black text-black font-heading leading-none">
									{summary?.ipk ? summary.ipk.toFixed(2) : '0.00'}
								</h2>
								<div className="flex items-center gap-1.5 mt-2 bg-white/40 border border-black/20 rounded-full px-2.5 py-0.5 w-max">
									<span className="w-2 h-2 rounded-full bg-black"></span>
									<p className="text-[9px] font-black text-black/80">Skala Kumulatif 4.00</p>
								</div>
							</div>
							<span className="p-4.5 bg-white border-3 border-black rounded-[18px] shadow-[3px_3px_0px_#000] shrink-0 z-10">
								<Award className="w-8 h-8 text-black stroke-[2.5]" />
							</span>
						</div>

						{/* Total SKS Card */}
						<div className="bg-[#FACC15] border-3 border-black shadow-[6px_6px_0px_#000] rounded-[22px] p-6 flex items-center justify-between relative overflow-hidden">
							<div className="space-y-1 z-10">
								<span className="text-[10px] font-black uppercase text-black/60 font-mono tracking-wider block">TOTAL KREDIT (SKS)</span>
								<h2 className="text-5xl font-black text-black font-heading leading-none">
									{summary?.totalSks || 0}
								</h2>
								<div className="flex items-center gap-1.5 mt-2 bg-white/40 border border-black/20 rounded-full px-2.5 py-0.5 w-max">
									<span className="w-2 h-2 rounded-full bg-black"></span>
									<p className="text-[9px] font-black text-black/80">Total {safeGrades.length} Mata Kuliah</p>
								</div>
							</div>
							<span className="p-4.5 bg-white border-3 border-black rounded-[18px] shadow-[3px_3px_0px_#000] shrink-0 z-10">
								<BookOpen className="w-8 h-8 text-black stroke-[2.5]" />
							</span>
						</div>

						{/* Simulator Toggle & Info Card */}
						<div className="bg-[#38E5FF] border-3 border-black shadow-[6px_6px_0px_#000] rounded-[22px] p-6 flex items-center justify-between relative overflow-hidden">
							<div className="space-y-1 z-10">
								<span className="text-[10px] font-black uppercase text-black/60 font-mono tracking-wider block">SIMULATOR TARGET IPK</span>
								<h2 className="text-2xl font-black text-black font-heading leading-tight">
									{showSimulator ? `Proyeksi: ${projectedSummary.ipk.toFixed(2)}` : 'Simulasikan Nilai'}
								</h2>
								<button
									onClick={() => setShowSimulator(!showSimulator)}
									className="mt-2 px-3 py-1.5 bg-black text-white border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#fff] flex items-center gap-1.5 cursor-pointer hover:bg-slate-800"
								>
									<Calculator className="w-3.5 h-3.5" />
									<span>{showSimulator ? 'Tutup Simulator' : 'Buka Simulator Target'}</span>
								</button>
							</div>
							<span className="p-4.5 bg-white border-3 border-black rounded-[18px] shadow-[3px_3px_0px_#000] shrink-0 z-10">
								<Target className="w-8 h-8 text-black stroke-[2.5]" />
							</span>
						</div>
					</div>

					{/* SIMULATOR PANEL */}
					{showSimulator && (
						<div className="bg-[#FAF9F5] border-3 border-black rounded-[24px] p-6 shadow-[6px_6px_0px_#000] space-y-4">
							<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-black/10 pb-4">
								<div className="flex items-center gap-3">
									<span className="p-2.5 bg-neoYellow border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]">
										<Target className="w-5 h-5 text-black stroke-[2.5]" />
									</span>
									<div>
										<h4 className="font-heading font-black text-black text-base uppercase">Simulator Target IPK Kumulatif</h4>
										<p className="text-xs font-bold text-black/60">Ubah perkiraan nilai huruf mata kuliah untuk melihat proyeksi IPK saat wisuda.</p>
									</div>
								</div>

								<div className="flex items-center gap-4 bg-white border-2 border-black rounded-xl px-4 py-2 shadow-[2px_2px_0px_#000]">
									<div>
										<span className="text-[9px] font-black text-black/40 uppercase block">IPK PROYEKSI</span>
										<span className="font-black text-2xl text-black">{projectedSummary.ipk.toFixed(2)}</span>
									</div>
									<div className="w-[1.5px] bg-black/15 self-stretch"></div>
									<div>
										<span className="text-[9px] font-black text-black/40 uppercase block">SELISIH</span>
										<span className={`font-black text-sm ${projectedSummary.diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
											{projectedSummary.diff >= 0 ? `+${projectedSummary.diff.toFixed(2)}` : projectedSummary.diff.toFixed(2)}
										</span>
									</div>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
								{safeGrades.slice(0, 9).map(g => {
									const currentLetter = targetOverrides[g.id] || g.nilaiHuruf || 'B';
									return (
										<div key={g.id} className="bg-white border-2 border-black rounded-xl p-3 shadow-[2px_2px_0px_#000] flex items-center justify-between gap-2">
											<div className="truncate">
												<p className="font-black text-xs text-black truncate">{g.namaMatkul}</p>
												<span className="text-[9px] font-mono text-black/50">{g.sks} SKS · Kode: {g.kodeMatkul}</span>
											</div>
											<select
												value={currentLetter}
												onChange={(e) => setTargetOverrides(prev => ({ ...prev, [g.id]: e.target.value }))}
												className="bg-[#FAF9F5] border-2 border-black rounded-lg px-2 py-1 text-xs font-black text-black focus:outline-none cursor-pointer"
											>
												{['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D', 'E'].map(l => (
													<option key={l} value={l}>Nilai {l}</option>
												))}
											</select>
										</div>
									);
								})}
							</div>
						</div>
					)}

					{/* Transkrip Nilai Table */}
					<div className="bg-white border-3 border-black shadow-[8px_8px_0px_#000] rounded-[24px] p-6">
						<div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 pb-6 border-b-2 border-black/10">
							<div className="flex items-center gap-3">
								<span className="p-2.5 bg-[#38E5FF] border-2 border-black rounded-xl shadow-[2.5px_2.5px_0px_#000]">
									<BookMarked className="w-6 h-6 text-black stroke-[2.5]" />
								</span>
								<div>
									<h4 className="font-heading font-black text-black text-lg uppercase tracking-wide">Rincian Transkrip Nilai</h4>
									<p className="text-[10px] font-bold text-black/50">Daftar perolehan nilai mata kuliah yang ter-scrape dari SIAK.</p>
								</div>
							</div>
							
							{activeSemester !== 'all' && (
								<div className="flex gap-4 bg-[#FAF9F5] border-2 border-black rounded-xl px-4 py-2 text-xs font-bold text-black shadow-[2.5px_2.5px_0px_#000]">
									<div>
										<span className="text-[8px] font-black text-black/40 uppercase block">IP SEMESTER</span>
										<span className="font-black text-neoOrange text-sm">{activeIpk.toFixed(2)}</span>
									</div>
									<div className="w-[1.5px] bg-black/10 self-stretch"></div>
									<div>
										<span className="text-[8px] font-black text-black/40 uppercase block">BEBAN SKS</span>
										<span className="font-black text-black text-sm">{activeSks} SKS</span>
									</div>
								</div>
							)}
						</div>

						{/* Filter Semester */}
						<div className="my-6">
							<span className="text-[10px] font-black text-black/40 uppercase font-mono tracking-wider block mb-2.5">PILIH SEMESTER</span>
							<div className="flex flex-wrap gap-2.5">
								{semesters.map((sem) => {
									const isSelected = activeSemester === sem;
									return (
										<button
											key={sem}
											onClick={() => setActiveSemester(sem)}
											className={`px-4 py-2 rounded-xl text-xs font-black transition-all border-2 border-black cursor-pointer shadow-[2px_2px_0px_#000] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-[1.5px_1.5px_0px_#000] active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-none ${
												isSelected 
													? 'bg-black text-white shadow-none translate-x-[1.5px] translate-y-[1.5px]' 
													: 'bg-[#FAF9F5] text-black hover:bg-slate-50'
											}`}
										>
											{sem === 'all' ? '🎓 Semua Nilai' : sem}
										</button>
									);
								})}
							</div>
						</div>

						{/* Grades Container (Hybrid: Mobile Cards + Desktop Table) */}
						{filteredGrades.length === 0 ? (
							<div className="text-center py-16 border-3 border-dashed border-black/10 rounded-2xl bg-[#FAF9F5]">
								<AlertTriangle className="w-14 h-14 text-[#FF7A00] mx-auto mb-3 animate-bounce" />
								<p className="font-black text-black text-sm uppercase">TIDAK ADA DATA NILAI</p>
								<p className="text-xs text-black/40 font-bold mt-1">Data nilai tidak tersedia untuk filter semester ini.</p>
							</div>
						) : (
							<>
								{/* 1. MOBILE CARD LIST (Zero Horizontal Scroll - Mobile First) */}
								<div className="block md:hidden space-y-3">
									{filteredGrades.map((grade, index) => {
										const huruf = (grade.nilaiHuruf || '-').trim();
										let badgeColor = 'bg-slate-100 text-slate-800';
										if (huruf.startsWith('A')) badgeColor = 'bg-[#4ADE80] text-black';
										else if (huruf.startsWith('B')) badgeColor = 'bg-[#60A5FA] text-black';
										else if (huruf.startsWith('C')) badgeColor = 'bg-[#FACC15] text-black';
										else if (huruf.startsWith('D')) badgeColor = 'bg-[#FB923C] text-black';
										else if (huruf.startsWith('E')) badgeColor = 'bg-[#F87171] text-black';

										return (
											<div 
												key={grade.id || index} 
												className="bg-white border-3 border-black rounded-2xl p-4 shadow-[4px_4px_0px_#000] space-y-2.5 transition-all"
											>
												{/* Header Card: Semester / Code & Grade Badge */}
												<div className="flex items-center justify-between gap-2">
													<div className="flex items-center gap-1.5 flex-wrap">
														<span className="text-[9px] font-black font-mono bg-neoYellow border border-black px-2 py-0.5 rounded shadow-[1px_1px_0px_#000]">
															{grade.semester || 'SEM'}
														</span>
														<span className="text-[10px] font-mono font-bold text-black/60">
															{grade.kodeMatkul}
														</span>
													</div>
													<span className={`px-3 py-1 rounded-xl font-heading font-black text-sm border-2 border-black shadow-[1.5px_1.5px_0px_#000] ${badgeColor}`}>
														NILAI {huruf}
													</span>
												</div>

												{/* Course Name */}
												<h4 className="font-heading font-black text-sm text-black leading-snug">
													{grade.namaMatkul}
												</h4>

												{/* Metadata Footer Strip */}
												<div className="bg-[#FAF9F5] border-2 border-black/15 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono font-bold text-black/75">
													<div className="flex items-center gap-1">
														<span className="text-black">📘</span>
														<span>{grade.sks} SKS</span>
													</div>
													<div className="flex items-center gap-1">
														<span>Indeks:</span>
														<span className="font-black text-black">{(grade.nilaiAngka || 0).toFixed(2)}</span>
													</div>
													<div className="flex items-center gap-1">
														<span>Mutu:</span>
														<span className="font-black text-black">{(grade.mutu || 0).toFixed(2)}</span>
													</div>
												</div>
											</div>
										);
									})}
								</div>

								{/* 2. DESKTOP TABLE (Hidden on Mobile, Displayed on Desktop md+) */}
								<div className="hidden md:block overflow-x-auto border-3 border-black rounded-[20px] shadow-[4px_4px_0px_#000] bg-white">
									<table className="w-full border-collapse text-left">
										<thead>
											<tr className="bg-[#FAF9F5] border-b-3 border-black text-[9px] font-black text-black uppercase font-mono">
												<th className="px-4 py-4.5 text-center border-r-2 border-black w-14">No</th>
												<th className="px-4 py-4.5 border-r-2 border-black w-32">Kode</th>
												<th className="px-4 py-4.5 border-r-2 border-black">Mata Kuliah</th>
												<th className="px-4 py-4.5 text-center border-r-2 border-black w-20">SKS</th>
												<th className="px-4 py-4.5 text-center border-r-2 border-black w-24">Indeks</th>
												<th className="px-4 py-4.5 text-center border-r-2 border-black w-24">Bobot</th>
												<th className="px-4 py-4.5 text-center w-24">Mutu</th>
											</tr>
										</thead>
										<tbody className="divide-y-2 divide-black/15">
											{filteredGrades.map((grade, index) => {
												const huruf = (grade.nilaiHuruf || '-').trim();
												let badgeColor = 'bg-slate-100 text-slate-800';
												if (huruf.startsWith('A')) badgeColor = 'bg-[#4ADE80] text-black';
												else if (huruf.startsWith('B')) badgeColor = 'bg-[#60A5FA] text-black';
												else if (huruf.startsWith('C')) badgeColor = 'bg-[#FACC15] text-black';
												else if (huruf.startsWith('D')) badgeColor = 'bg-[#FB923C] text-black';
												else if (huruf.startsWith('E')) badgeColor = 'bg-[#F87171] text-black';

												return (
													<tr key={grade.id || index} className="text-xs font-bold text-black/85 hover:bg-slate-50/60 transition-colors">
														<td className="px-4 py-3.5 text-center border-r-2 border-black/10 font-mono text-[10px] text-black/55">{index + 1}</td>
														<td className="px-4 py-3.5 border-r-2 border-black/10 font-mono text-[10px] text-black/75">{grade.kodeMatkul}</td>
														<td className="px-4 py-3.5 border-r-2 border-black/10">
															<div className="space-y-0.5">
																<p className="font-black text-black leading-snug">{grade.namaMatkul}</p>
																{activeSemester === 'all' && (
																	<span className="inline-block text-[8px] font-black bg-[#FAF9F5] border border-black/15 rounded-md px-1.5 py-0.2 text-neoOrange uppercase font-mono">
																		{grade.semester}
																	</span>
																)}
															</div>
														</td>
														<td className="px-4 py-3.5 text-center border-r-2 border-black/10 font-mono">{grade.sks}</td>
														<td className="px-4 py-3.5 text-center border-r-2 border-black/10">
															<span className={`inline-block px-3 py-1.5 rounded-xl font-black text-xs border-2 border-black shadow-[1.5px_1.5px_0px_#000] w-10 text-center ${badgeColor}`}>
																{huruf}
															</span>
														</td>
														<td className="px-4 py-3.5 text-center border-r-2 border-black/10 font-mono text-black/60">
															{(grade.nilaiAngka || 0).toFixed(2)}
														</td>
														<td className="px-4 py-3.5 text-center font-mono text-black">
															{(grade.mutu || 0).toFixed(2)}
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							</>
						)}
					</div>
				</div>
			)}

			{/* SUB-TAB 2: JADWAL KULIAH */}
			{subTab === 'schedule' && (
				<div className="space-y-6">
					<div className="bg-[#A3E635]/20 border-3 border-black p-4 rounded-[20px] shadow-[4px_4px_0px_#000] flex items-center gap-3">
						<span className="p-2.5 bg-[#A3E635] border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] shrink-0">
							<Sparkles className="w-5 h-5 text-black" />
						</span>
						<div>
							<h4 className="text-xs font-black text-black uppercase">Auto-Sync ke AI Calendar Active</h4>
							<p className="text-xs text-black/70 font-bold">Jadwal kuliah Anda terhubung dengan Motion AI Calendar untuk memblokir slot belajar agar tidak terjadi bentrok.</p>
						</div>
					</div>

					{safeSchedule.length === 0 ? (
						<div className="text-center py-16 border-3 border-dashed border-black/15 rounded-2xl bg-[#FAF9F5]">
							<BookMarked className="w-14 h-14 text-black/30 mx-auto mb-3" />
							<p className="font-black text-black text-sm uppercase">BELUM ADA JADWAL KULIAH</p>
							<p className="text-xs text-black/50 font-bold mt-1 max-w-sm mx-auto">Klik tombol "Sync Data" di atas untuk memuat jadwal kuliah dari SIAK Wicida.</p>
						</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							{daysOrder.map((day) => {
								const daySchedules = safeSchedule.filter((s) => (s.hari || '').toLowerCase() === day.toLowerCase());
								if (daySchedules.length === 0) return null;

								return (
									<div key={day} className="bg-white border-3 border-black rounded-[20px] p-5 shadow-[4px_4px_0px_#000] space-y-3">
										<div className="flex items-center justify-between border-b-2 border-black pb-2">
											<span className="text-xs font-black uppercase text-black bg-[#FACC15] border border-black px-3 py-1 rounded-lg shadow-[1.5px_1.5px_0px_#000]">
												{day}
											</span>
											<span className="text-[10px] font-mono font-bold text-black/50">{daySchedules.length} Kelas</span>
										</div>

										<div className="space-y-3">
											{daySchedules.map((s) => (
												<div key={s.id} className="p-3.5 bg-[#FAF9F5] border-2 border-black rounded-xl space-y-2">
													<div className="flex justify-between items-start">
														<p className="font-black text-xs text-black leading-snug">{s.namaMatkul}</p>
														<span className="text-[9px] font-mono font-black bg-black text-white px-2 py-0.5 rounded shrink-0">
															{s.jamMulai} - {s.jamSelesai}
														</span>
													</div>
													<div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-black/65">
														{s.ruangan && <span className="bg-[#60A5FA]/20 border border-black/20 px-1.5 py-0.5 rounded">🏢 Ruang: {s.ruangan}</span>}
														{s.dosen && <span className="truncate max-w-[180px]">👨‍🏫 {s.dosen}</span>}
													</div>
												</div>
											))}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			)}

			{/* SUB-TAB 3: JADWAL UJIAN (UTS/UAS) */}
			{subTab === 'exams' && (
				<div className="space-y-6">
					{safeExams.length === 0 ? (
						<div className="text-center py-16 border-3 border-dashed border-black/15 rounded-2xl bg-[#FAF9F5]">
							<Award className="w-14 h-14 text-black/30 mx-auto mb-3" />
							<p className="font-black text-black text-sm uppercase">BELUM ADA JADWAL UJIAN</p>
							<p className="text-xs text-black/50 font-bold mt-1 max-w-sm mx-auto">Klik tombol "Sync Data" untuk menarik jadwal UTS / UAS dari SIAK Wicida.</p>
						</div>
					) : (
						<div className="space-y-4">
							{safeExams.map((exam) => {
								const isUTS = (exam.jenisUjian || '').toUpperCase().includes('UTS');
								const tgl = exam.tanggalUjian ? new Date(exam.tanggalUjian) : null;
								
								return (
									<div key={exam.id} className="bg-white border-3 border-black rounded-[20px] p-5 shadow-[4px_4px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-4">
										<div className="flex items-start gap-4">
											<span className={`px-3 py-1.5 rounded-xl border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] shrink-0 ${isUTS ? 'bg-[#FACC15] text-black' : 'bg-[#F87171] text-black'}`}>
												{exam.jenisUjian || 'UJIAN'}
											</span>
											<div>
												<h4 className="font-black text-sm text-black leading-snug">{exam.namaMatkul}</h4>
												<p className="text-xs font-mono text-black/60 mt-0.5">Kode: {exam.kodeMatkul}</p>
											</div>
										</div>

										<div className="flex items-center gap-4 border-t-2 md:border-t-0 border-black/10 pt-3 md:pt-0">
											<div className="text-left md:text-right">
												<p className="text-xs font-black text-black">
													📅 {tgl ? tgl.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }) : 'Tanggal Belum Ditetapkan'}
												</p>
												<p className="text-[11px] font-mono text-black/60">
													⏰ {exam.jamMulai || '-'} - {exam.jamSelesai || '-'} {exam.ruangan ? `(Ruang: ${exam.ruangan})` : ''}
												</p>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
