'use client';

import React, { useState, useEffect } from 'react';
import { 
	GraduationCap, RefreshCw, Unlink, Lock, User, 
	Info, CheckCircle, AlertTriangle, BookOpen, 
	Award, Calendar, ArrowRight, ShieldAlert 
} from 'lucide-react';
import { useSiak, SiakGrade } from '../../hooks/useSiak';
import { toast } from '../../hooks/useToast';
import { Skeleton } from '../ui/Skeleton';

export default function SiakTab() {
	const { status, isLoading, isSyncing, error, fetchGrades, connect, syncNow, disconnect, clearError } = useSiak();
	
	const [nim, setNim] = useState('');
	const [password, setPassword] = useState('');
	const [activeSemester, setActiveSemester] = useState<string>('all');

	// Muat data saat halaman dibuka pertama kali
	useEffect(() => {
		fetchGrades();
	}, [fetchGrades]);

	// Tampilkan error jika ada
	useEffect(() => {
		if (error) {
			toast({
				title: 'Terjadi Kesalahan',
				description: error,
				variant: 'destructive',
			});
			clearError();
		}
	}, [error, clearError]);

	const handleConnect = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!nim || !password) {
			toast({
				title: 'Peringatan',
				description: 'NIM dan password wajib diisi!',
				variant: 'warning',
			});
			return;
		}

		const success = await connect(nim, password);
		if (success) {
			toast({
				title: 'Koneksi Sukses',
				description: 'Akun SIAK berhasil terhubung dan nilai berhasil disinkronkan.',
				variant: 'success',
			});
			setPassword('');
		}
	};

	const handleSync = async () => {
		const success = await syncNow();
		if (success) {
			toast({
				title: 'Sinkronisasi Sukses',
				description: 'Data nilai SIAK terbaru berhasil dimuat.',
				variant: 'success',
			});
		}
	};

	const handleDisconnect = async () => {
		if (confirm('Apakah Anda yakin ingin memutuskan hubungan akun SIAK dan menghapus semua cache nilai dari sistem?')) {
			const success = await disconnect();
			if (success) {
				toast({
					title: 'Koneksi Diputuskan',
					description: 'Akun SIAK berhasil diputus dan cache nilai dihapus.',
					variant: 'info',
				});
				setNim('');
			}
		}
	};

	// Dapatkan semua daftar semester unik untuk filter
	const semesters = status?.grades 
		? ['all', ...Array.from(new Set(status.grades.map(g => g.semester)))]
		: ['all'];

	// Filter grades berdasarkan semester terpilih
	const filteredGrades = status?.grades
		? activeSemester === 'all'
			? status.grades
			: status.grades.filter(g => g.semester === activeSemester)
		: [];

	// Render Loading state
	if (isLoading && !status) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-44 w-full rounded-3xl" />
				<Skeleton className="h-96 w-full rounded-3xl" />
			</div>
		);
	}

	// TAMPILAN 1: Form hubungkan jika belum terhubung
	if (!status?.isConnected) {
		return (
			<div className="max-w-2xl mx-auto py-8">
				<div className="bg-white border-3 border-black shadow-[8px_8px_0px_#000] rounded-3xl p-8 relative overflow-hidden">
					{/* Decorative shapes */}
					<div className="absolute top-0 right-0 w-24 h-24 bg-neoMint/10 rounded-full translate-x-8 -translate-y-8"></div>
					
					<div className="flex items-center gap-4 mb-6">
						<span className="p-3 bg-neoYellow border-2 border-black rounded-2xl shadow-[2.5px_2.5px_0px_#000]">
							<GraduationCap className="w-8 h-8 text-black" />
						</span>
						<div>
							<h3 className="text-xl font-black text-black font-heading tracking-wide uppercase">Hubungkan SIAK Wicida</h3>
							<p className="text-xs font-bold text-black/60">Integrasikan nilai mata kuliah & IPK akumulatif ke dalam dashboard.</p>
						</div>
					</div>

					<div className="bg-neoYellow/15 border-2 border-black rounded-2xl p-4 mb-6 flex gap-3 text-xs font-bold text-black/80 leading-relaxed">
						<Info className="w-5 h-5 text-neoOrange shrink-0 stroke-[3]" />
						<div>
							<p className="font-black text-black uppercase mb-0.5">Catatan Privasi:</p>
							Kami tidak menyimpan password plain-text Anda. Password Anda dienkripsi secara aman menggunakan enkripsi AES-256 tingkat militer di database Supabase kami. Kredensial ini hanya digunakan untuk scraping data nilai dari portal SIAK Wicida secara aman.
						</div>
					</div>

					<form onSubmit={handleConnect} className="space-y-5">
						<div className="space-y-2">
							<label className="text-xs font-black text-black uppercase tracking-wider block">NIM Mahasiswa</label>
							<div className="relative">
								<User className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-black/40" />
								<input
									type="text"
									value={nim}
									onChange={(e) => setNim(e.target.value)}
									placeholder="Masukkan NIM Anda (contoh: 210101032)"
									className="w-full pl-12 pr-4 py-3.5 bg-[#FAF9F5] border-2 border-black rounded-2xl text-sm font-bold text-black placeholder:text-black/30 focus:outline-none focus:bg-white transition-all shadow-[2px_2px_0px_#000] focus:shadow-[4px_4px_0px_#000]"
									required
								/>
							</div>
						</div>

						<div className="space-y-2">
							<label className="text-xs font-black text-black uppercase tracking-wider block">Password SIAK</label>
							<div className="relative">
								<Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-black/40" />
								<input
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder="Masukkan password portal SIAK Anda"
									className="w-full pl-12 pr-4 py-3.5 bg-[#FAF9F5] border-2 border-black rounded-2xl text-sm font-bold text-black placeholder:text-black/30 focus:outline-none focus:bg-white transition-all shadow-[2px_2px_0px_#000] focus:shadow-[4px_4px_0px_#000]"
									required
								/>
							</div>
						</div>

						<button
							type="submit"
							disabled={isLoading}
							className="w-full neo-btn bg-neoMint text-black py-4 rounded-2xl font-black text-sm uppercase shadow-neo hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm active:translate-x-[3px] active:translate-y-[3px] active:shadow-none flex items-center justify-center gap-2 cursor-pointer border-2 border-black disabled:opacity-50"
						>
							{isLoading ? (
								<>
									<RefreshCw className="w-4.5 h-4.5 animate-spin" /> Menghubungkan & Menarik Nilai...
								</>
							) : (
								<>
									<GraduationCap className="w-4.5 h-4.5" /> Hubungkan Akun SIAK <ArrowRight className="w-4 h-4" />
								</>
							)}
						</button>
					</form>
				</div>
			</div>
		);
	}

	const summary = status.summary;

	// TAMPILAN 2: Tampilan Dashboard Nilai & IPK jika sudah terhubung
	return (
		<div className="space-y-6">
			{/* Row 1: Summary Cards & Control Panel */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				{/* IPK Card */}
				<div className="bg-neoMint border-3 border-black shadow-[6px_6px_0px_#000] rounded-3xl p-5 flex items-center justify-between relative overflow-hidden">
					<div className="space-y-1">
						<span className="text-[10px] font-black uppercase text-black/60 font-mono tracking-wider">IPK AKUMULATIF</span>
						<h2 className="text-4xl font-black text-black font-heading leading-none">
							{summary?.ipk ? summary.ipk.toFixed(2) : '0.00'}
						</h2>
						<p className="text-[10px] font-bold text-black/60">Dari total {summary?.totalSks || 0} SKS lulus.</p>
					</div>
					<span className="p-4 bg-white border-2 border-black rounded-2xl shadow-[2px_2px_0px_#000] shrink-0">
						<Award className="w-8 h-8 text-black" />
					</span>
				</div>

				{/* Total SKS Card */}
				<div className="bg-neoYellow border-3 border-black shadow-[6px_6px_0px_#000] rounded-3xl p-5 flex items-center justify-between relative overflow-hidden">
					<div className="space-y-1">
						<span className="text-[10px] font-black uppercase text-black/60 font-mono tracking-wider">TOTAL KREDIT (SKS)</span>
						<h2 className="text-4xl font-black text-black font-heading leading-none">
							{summary?.totalSks || 0}
						</h2>
						<p className="text-[10px] font-bold text-black/60">SKS mata kuliah kumulatif.</p>
					</div>
					<span className="p-4 bg-white border-2 border-black rounded-2xl shadow-[2px_2px_0px_#000] shrink-0">
						<BookOpen className="w-8 h-8 text-black" />
					</span>
				</div>

				{/* Connection Control Panel */}
				<div className="bg-white border-3 border-black shadow-[6px_6px_0px_#000] rounded-3xl p-5 flex flex-col justify-between space-y-4">
					<div className="flex items-start justify-between min-w-0">
						<div className="min-w-0">
							<span className="text-[9px] font-black uppercase text-black/40 font-mono">STATUS KONEKSI</span>
							<p className="text-xs font-black text-black truncate uppercase">NIM: {summary?.nim}</p>
							{summary?.lastSyncAt && (
								<p className="text-[9px] font-bold text-black/50 mt-0.5">
									Update: {new Date(summary.lastSyncAt).toLocaleDateString('id-ID', {
										day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
									})}
								</p>
							)}
						</div>
						<span className="flex h-2.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border border-black animate-pulse shadow-sm shrink-0"></span>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<button
							onClick={handleSync}
							disabled={isSyncing}
							className="neo-btn bg-white text-black py-2.5 rounded-2xl font-black text-[10px] uppercase shadow-neo-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-neo-xs active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-1.5 border-2 border-black disabled:opacity-50 cursor-pointer"
						>
							<RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} /> Sync Ulang
						</button>
						<button
							onClick={handleDisconnect}
							className="neo-btn bg-[#FF7A00]/15 hover:bg-[#FF7A00]/25 text-neoOrange py-2.5 rounded-2xl font-black text-[10px] uppercase shadow-neo-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-neo-xs active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-1.5 border-2 border-[#FF7A00] cursor-pointer"
						>
							<Unlink className="w-3.5 h-3.5" /> Putus
						</button>
					</div>
				</div>
			</div>

			{/* Row 2: Filter Semester Bar & Table list */}
			<div className="bg-white border-3 border-black shadow-[8px_8px_0px_#000] rounded-3xl p-6">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
					<h4 className="font-heading font-black text-black text-sm uppercase tracking-wider flex items-center gap-2">
						<GraduationCap className="w-5 h-5 text-neoBlue" /> Rincian Nilai Akademik
					</h4>
					
					{/* Semester filter select */}
					<div className="flex items-center gap-2">
						<span className="text-[10px] font-black text-black/50 uppercase font-mono hidden sm:inline">Semester:</span>
						<select
							value={activeSemester}
							onChange={(e) => setActiveSemester(e.target.value)}
							className="bg-[#FAF9F5] border-2 border-black rounded-xl px-3 py-1.5 text-xs font-black text-black focus:outline-none cursor-pointer"
						>
							{semesters.map((sem) => (
								<option key={sem} value={sem}>
									{sem === 'all' ? 'Tampilkan Semua Semester' : sem}
								</option>
							))}
						</select>
					</div>
				</div>

				{/* Grades Table */}
				{filteredGrades.length === 0 ? (
					<div className="text-center py-12 border-2 border-dashed border-black/10 rounded-2xl">
						<Award className="w-12 h-12 text-black/15 mx-auto mb-2 animate-bounce" />
						<p className="font-black text-black/60 text-xs">TIDAK ADA DATA NILAI</p>
						<p className="text-[10px] text-black/40 font-bold mt-0.5">SIAK belum merilis data nilai untuk semester ini.</p>
					</div>
				) : (
					<div className="overflow-x-auto border-2 border-black rounded-2xl shadow-[3px_3px_0px_#000] bg-white">
						<table className="w-full border-collapse text-left">
							<thead>
								<tr className="bg-[#FAF9F5] border-b-2 border-black text-[9px] font-black text-black uppercase font-mono">
									<th className="px-4 py-3 text-center border-r-2 border-black w-12">No</th>
									<th className="px-4 py-3 border-r-2 border-black w-28">Kode</th>
									<th className="px-4 py-3 border-r-2 border-black">Mata Kuliah</th>
									<th className="px-4 py-3 text-center border-r-2 border-black w-16">SKS</th>
									<th className="px-4 py-3 text-center border-r-2 border-black w-24">Nilai</th>
									<th className="px-4 py-3 text-center border-r-2 border-black w-20">Bobot</th>
									<th className="px-4 py-3 text-center w-20">Mutu</th>
								</tr>
							</thead>
							<tbody className="divide-y-2 divide-black/10">
								{filteredGrades.map((grade, index) => (
									<tr key={grade.id || index} className="text-xs font-bold text-black/85 hover:bg-slate-50 transition-colors">
										<td className="px-4 py-3 text-center border-r-2 border-black/10 text-[10px] font-mono text-black/55">{index + 1}</td>
										<td className="px-4 py-3 border-r-2 border-black/10 font-mono text-[10px] text-black/75">{grade.kodeMatkul}</td>
										<td className="px-4 py-3 border-r-2 border-black/10">
											<div className="space-y-0.5">
												<p className="font-black text-black leading-snug">{grade.namaMatkul}</p>
												{activeSemester === 'all' && (
													<p className="text-[8px] font-mono font-black text-neoOrange uppercase">{grade.semester}</p>
												)}
											</div>
										</td>
										<td className="px-4 py-3 text-center border-r-2 border-black/10 font-mono">{grade.sks}</td>
										<td className="px-4 py-3 text-center border-r-2 border-black/10 font-mono">
											<span className={`inline-block px-2.5 py-0.5 rounded font-black text-[10px] border border-black shadow-[1px_1px_0px_#000] ${
												grade.nilaiHuruf.startsWith('A') 
													? 'bg-emerald-300' 
													: grade.nilaiHuruf.startsWith('B') 
													? 'bg-neoMint' 
													: grade.nilaiHuruf.startsWith('C') 
													? 'bg-neoYellow' 
													: 'bg-neoOrange/20 text-neoOrange'
											}`}>
												{grade.nilaiHuruf}
											</span>
										</td>
										<td className="px-4 py-3 text-center border-r-2 border-black/10 font-mono text-black/60">{grade.nilaiAngka.toFixed(1)}</td>
										<td className="px-4 py-3 text-center font-mono text-black">{grade.mutu.toFixed(1)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
