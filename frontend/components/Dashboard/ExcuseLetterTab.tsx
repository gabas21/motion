'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, Plus, Trash2, Download, ExternalLink, 
  Calendar, User, Clipboard, Loader, AlertCircle, 
  History, ArrowLeft, PenTool, CheckCircle2, Award
} from 'lucide-react';
import { useExcuseLetters, MoodleExcuseLetter } from '../../hooks/useExcuseLetters';
import { useMoodle } from '../../hooks/useMoodle';
import { useAuth } from '../../hooks/useAuth';
import { toast } from '../../hooks/useToast';
import SignaturePad from './SignaturePad';
import { Skeleton } from '../ui/Skeleton';
import CustomSelect from '../ui/CustomSelect';

export default function ExcuseLetterTab() {
  const { user } = useAuth();
  const { courses, fetchCourses } = useMoodle();
  const { 
    excuses, isLoading, error, fetchExcuses, createExcuse, deleteExcuse, clearError 
  } = useExcuseLetters();

  // Navigation state: 'list' (riwayat) atau 'form' (buat baru)
  const [view, setView] = useState<'list' | 'form'>('list');

  // Form states
  const [nama, setNama] = useState(user?.name || '');
  const [nim, setNim] = useState('');
  const [prodi, setProdi] = useState('');
  const [kelompok, setKelompok] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedCourseName, setSelectedCourseName] = useState('');
  const [tanggalPraktikum, setTanggalPraktikum] = useState('');
  const [alasan, setAlasan] = useState('');
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null);

  // Success modal states
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState('');

  // Muat data riwayat dan daftar mata kuliah saat komponen dimuat
  useEffect(() => {
    fetchExcuses();
    fetchCourses();

    // Load NIM, Prodi, Kelompok yang tersimpan di localStorage agar memudahkan
    if (typeof window !== 'undefined') {
      setNim(localStorage.getItem('excuse_nim') || '');
      setProdi(localStorage.getItem('excuse_prodi') || '');
      setKelompok(localStorage.getItem('excuse_kelompok') || '');
    }
  }, [fetchExcuses, fetchCourses]);

  // Set default nama jika user terotentikasi dimuat belakangan
  useEffect(() => {
    if (user?.name && !nama) {
      setNama(user.name);
    }
  }, [user, nama]);

  // Format Tanggal Indonesia (contoh: Senin, 8 Juni 2026)
  const formatIndonesianDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Format Tanggal Hari Ini untuk Tanggal Surat (contoh: 8 Juni 2026)
  const formatIndonesianToday = () => {
    const date = new Date();
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const handleCourseChange = (courseId: string) => {
    setSelectedCourseId(courseId);
    const courseObj = courses.find(c => c.moodleCourseId === courseId);
    if (courseObj) {
      // Bersihkan nama mata kuliah dari prefix tahun akademik/kelas
      let cleaned = courseObj.name.replace(/^\d{4}\/\d{4}_\d+_[A-Z0-9]+_[A-Z]+_/, '');
      cleaned = cleaned.replace(/^\d{4}\/\d{4}_\d+_\w+_/, '');
      cleaned = cleaned.replace(/_/g, ' ').trim();
      setSelectedCourseName(cleaned);
    } else {
      setSelectedCourseName('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signatureBase64) {
      toast.warning('Tanda tangan wajib diisi pada Canvas Drawing Pad!');
      return;
    }

    const payload = {
      nama,
      nim,
      prodi,
      kelompok,
      courseId: selectedCourseId,
      courseName: selectedCourseName,
      hariTanggal: formatIndonesianDate(tanggalPraktikum),
      alasan,
      tanggalSurat: formatIndonesianToday(),
      signatureBase64: signatureBase64
    };

    // Simpan ke localStorage agar tidak perlu mengetik ulang
    if (typeof window !== 'undefined') {
      localStorage.setItem('excuse_nim', nim);
      localStorage.setItem('excuse_prodi', prodi);
      localStorage.setItem('excuse_kelompok', kelompok);
    }

    const result = await createExcuse(payload);

    if (result.success && result.pdfUrl) {
      // Tampilkan URL backend lengkap
      const apiURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
      const rawBaseURL = apiURL.replace('/api/v1', '');
      const fullPdfUrl = `${rawBaseURL}${result.pdfUrl}`;
      
      setGeneratedPdfUrl(fullPdfUrl);
      setShowSuccessModal(true);
      
      // Reset form dinamis
      setAlasan('');
      setTanggalPraktikum('');
      setSignatureBase64(null);
      
      // Kembali ke tampilan riwayat
      setView('list');
      
      // Auto-trigger download
      window.open(fullPdfUrl, '_blank');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus surat izin ini dari riwayat? Berkas PDF juga akan dihapus.')) {
      await deleteExcuse(id);
    }
  };

  const handleDownload = (id: string) => {
    const apiURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
    const rawBaseURL = apiURL.replace('/api/v1', '');
    const fullPdfUrl = `${rawBaseURL}/downloads/excuse_letters/excuse_letter_${id}.pdf`;
    window.open(fullPdfUrl, '_blank');
  };

  const excuseCourseOptions = [
    { value: '', label: '-- Pilih Mata Kuliah --' },
    ...courses.map((c) => ({
      value: c.moodleCourseId,
      label: c.name.replace(/^\d{4}\/\d{4}_\d+_\w+_(PA_)?/, '').replace(/_/g, ' ')
    }))
  ];

  return (
    <div className="space-y-6 text-left">
      {/* HEADER TAB */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-white p-5 rounded-2xl border-3 border-black shadow-[4px_4px_0px_#000]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-neoViolet rounded-2xl border-2 border-black text-black shrink-0 shadow-[2px_2px_0px_#000]">
            <FileText size={22} className="font-black text-white" />
          </div>
          <div>
            <h2 className="font-black text-lg text-black leading-tight font-heading">SURAT IZIN PRAKTIKUM</h2>
            <p className="text-xs text-gray-650 mt-1 font-semibold">
              Generate surat izin tidak mengikuti praktikum secara otomatis & kirim ke Google Form Labcom.
            </p>
          </div>
        </div>

        {view === 'list' ? (
          <button
            onClick={() => setView('form')}
            className="neo-btn bg-neoYellow text-black text-sm font-black rounded-xl px-5 py-2.5 flex items-center gap-2 shadow-[3px_3px_0px_#000] hover:bg-yellow-350 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#000] transition-all cursor-pointer"
          >
            <Plus size={14} className="stroke-[3]" /> BUAT SURAT IZIN
          </button>
        ) : (
          <button
            onClick={() => setView('list')}
            className="neo-btn bg-white text-black text-sm font-black rounded-xl px-5 py-2.5 flex items-center gap-2 border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neoCream active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#000] transition-all cursor-pointer"
          >
            <ArrowLeft size={14} className="stroke-[3]" /> KEMBALI
          </button>
        )}
      </div>

      {/* ERROR HANDLER */}
      {error && (
        <div className="flex items-center gap-2 p-3.5 bg-red-100 border-3 border-black rounded-2xl text-sm text-black shadow-[3px_3px_0px_#EF4444] font-bold">
          <AlertCircle size={16} className="shrink-0 text-red-600" />
          <span className="flex-1 font-black">{error}</span>
          <button 
            onClick={clearError} 
            className="text-black hover:text-red-600 font-black px-1.5 border border-black rounded bg-white shadow-[1px_1px_0px_#000] scale-90"
          >
            ✕
          </button>
        </div>
      )}

      {/* VIEW: DAFTAR RIWAYAT */}
      {view === 'list' && (
        <div className="bg-white border-3 border-black rounded-2xl p-6 shadow-[4px_4px_0px_#000] space-y-4">
          <h3 className="font-black text-sm text-black flex items-center gap-2 border-b-2 border-black pb-3">
            <History size={16} /> RIWAYAT PEMBUATAN SURAT
          </h3>

          {isLoading && excuses.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-4 p-4 bg-white border-2 border-black/8 rounded-2xl shadow-sm">
                  <div className="space-y-2 flex-grow">
                    <Skeleton className="w-1/2 h-4" />
                    <Skeleton className="w-1/3 h-3" />
                  </div>
                  <Skeleton className="w-24 h-4" />
                  <Skeleton className="w-32 h-4" />
                  <div className="flex gap-2">
                    <Skeleton className="w-16 h-8" rounded="lg" />
                    <Skeleton className="w-16 h-8" rounded="lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : excuses.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 bg-neoCream border-2 border-black rounded-xl flex items-center justify-center mx-auto shadow-neo-sm">
                <FileText size={20} className="text-slate-400" />
              </div>
              <p className="text-sm text-slate-500 font-extrabold">Belum ada riwayat surat izin praktikum.</p>
              <button
                onClick={() => setView('form')}
                className="text-xs font-black text-neoViolet hover:underline cursor-pointer"
              >
                Mulai buat surat izin pertama Anda →
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-black text-xs font-black text-slate-400 uppercase font-heading">
                    <th className="pb-3 pr-4">Mata Kuliah / Asisten</th>
                    <th className="pb-3 px-4">Tanggal Praktikum</th>
                    <th className="pb-3 px-4">Alasan</th>
                    <th className="pb-3 pl-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-black divide-slate-100 text-xs font-bold">
                  {excuses.map((exc) => (
                    <tr key={exc.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 pr-4 max-w-xs">
                        <p className="font-black text-black truncate">{exc.courseName}</p>
                        <span className="font-mono text-[10px] text-slate-400">Pemohon: {exc.nama} ({exc.nim})</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">{exc.hariTanggal}</td>
                      <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate" title={exc.alasan}>
                        {exc.alasan}
                      </td>
                      <td className="py-3.5 pl-4 text-right space-x-2 shrink-0 whitespace-nowrap">
                        <button
                          onClick={() => handleDownload(exc.id)}
                          className="p-1.5 rounded-lg border-2 border-black bg-neoMint hover:bg-emerald-300 shadow-neo-sm active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none transition-all cursor-pointer inline-flex items-center gap-1 font-black text-[10px]"
                          title="Unduh PDF"
                        >
                          <Download size={10} className="stroke-[2.5]" /> Unduh
                        </button>
                        <button
                          onClick={() => handleDelete(exc.id)}
                          className="p-1.5 rounded-lg border-2 border-black bg-neoOrange text-white hover:bg-red-500 shadow-neo-sm active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none transition-all cursor-pointer inline-flex items-center gap-1 font-black text-[10px]"
                          title="Hapus"
                        >
                          <Trash2 size={10} /> Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW: FORM PEMBUATAN BARU */}
      {view === 'form' && (
        <div className="bg-white border-3 border-black rounded-2xl p-6 shadow-[4px_4px_0px_#000] space-y-6">
          <h3 className="font-black text-sm text-black flex items-center gap-2 border-b-2 border-black pb-3">
            <Plus size={16} /> FORMULIR SURAT IZIN BARU
          </h3>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* GRID DATA DIRI */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-black uppercase tracking-wider">Nama Lengkap</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
                  <input
                    type="text"
                    required
                    placeholder="Masukkan nama lengkap"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    className="w-full neo-input rounded-xl pl-9 pr-4 py-3 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-black uppercase tracking-wider">NIM (Nomor Induk Mahasiswa)</label>
                <input
                  type="text"
                  required
                  placeholder="Masukkan NIM Anda"
                  value={nim}
                  onChange={(e) => setNim(e.target.value)}
                  className="w-full neo-input rounded-xl px-4 py-3 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-black uppercase tracking-wider">Program Studi</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Teknik Informatika / Sistem Informasi"
                  value={prodi}
                  onChange={(e) => setProdi(e.target.value)}
                  className="w-full neo-input rounded-xl px-4 py-3 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-black uppercase tracking-wider">Kelompok Praktikum</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: A1 / B2 / C"
                  value={kelompok}
                  onChange={(e) => setKelompok(e.target.value)}
                  className="w-full neo-input rounded-xl px-4 py-3 text-sm"
                />
              </div>
            </div>

            {/* MATA KULIAH & HARI TANGGAL */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-black uppercase tracking-wider">Mata Kuliah Praktikum</label>
                <CustomSelect
                  options={excuseCourseOptions}
                  value={selectedCourseId}
                  onChange={handleCourseChange}
                  icon={<Clipboard className="w-4 h-4 text-black shrink-0 font-extrabold" />}
                  placeholder="-- Pilih Mata Kuliah --"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-black uppercase tracking-wider">Tanggal Praktikum</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
                  <input
                    type="date"
                    required
                    value={tanggalPraktikum}
                    onChange={(e) => setTanggalPraktikum(e.target.value)}
                    className="w-full neo-select rounded-xl pl-9 pr-3 py-3.5 text-sm bg-white"
                  />
                </div>
              </div>
            </div>

            {/* ALASAN TIDAK MASUK */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-black uppercase tracking-wider">Alasan Tidak Mengikuti Praktikum</label>
              <textarea
                required
                placeholder="Tuliskan alasan lengkap (contoh: Sakit demam disertai surat keterangan dokter / Ada keperluan mendesak keluarga)"
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                className="w-full neo-input rounded-xl px-4 py-3 text-sm h-24 resize-none"
              />
            </div>

            {/* CANVAS DRAWING SIGNATURE PAD */}
            <div className="pt-2 border-t-2 border-black border-dashed">
              <SignaturePad onChange={setSignatureBase64} />
            </div>

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={isLoading || !signatureBase64}
              className={`w-full neo-btn text-black rounded-xl py-3.5 text-sm font-black shadow-neo hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm active:translate-x-[3px] active:translate-y-[3px] active:shadow-none flex items-center justify-center gap-2 mt-4 cursor-pointer ${
                signatureBase64 ? 'bg-neoYellow' : 'bg-slate-200 text-slate-400 border-dashed cursor-not-allowed shadow-none'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" /> Mengenerate PDF resmi...
                </>
              ) : (
                <>
                  <PenTool className="w-4 h-4" /> GENERATE & UNDUH PDF <SparklesIcon />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* POPUP MODAL SUKSES INTEGRASI LINKTREE */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border-3 border-black shadow-[8px_8px_0_0_#000] rounded-2xl max-w-md w-full p-6 text-center space-y-6 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-neoMint border-2 border-black rounded-full flex items-center justify-center mx-auto shadow-neo-sm scale-110">
              <CheckCircle2 size={32} className="text-black stroke-[2.5]" />
            </div>
            
            <div className="space-y-2">
              <h3 className="font-heading font-black text-xl text-black uppercase">SURAT IZIN BERHASIL DIGENERATE!</h3>
              <p className="text-xs text-gray-700 font-semibold leading-relaxed">
                Berkas PDF surat permohonan izin Anda telah berhasil dibuat dengan format resmi Labcom WICIDA beserta tanda tangan Anda.
              </p>
            </div>

            <div className="bg-neoCream border-2 border-black rounded-xl p-3 text-xs text-black font-mono font-bold flex items-center gap-2 text-left shadow-neo-sm">
              <Award size={16} className="text-neoViolet shrink-0" />
              <span>Surat telah tersimpan di riwayat. Anda dapat mengunduhnya ulang kapan pun dibutuhkan.</span>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => window.open(generatedPdfUrl, '_blank')}
                className="w-full neo-btn bg-neoYellow text-black py-3 rounded-xl border-2 border-black shadow-neo-sm font-black flex items-center justify-center gap-2 hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all cursor-pointer text-xs"
              >
                <Download size={14} className="stroke-[3]" /> UNDUH SURAT IZIN (PDF)
              </button>
              
              <a
                href="https://forms.gle/KfZWvujpS8KwuRmAA"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full neo-btn bg-neoViolet text-white py-3 rounded-xl border-2 border-black shadow-neo-sm font-black flex items-center justify-center gap-2 hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all cursor-pointer text-xs"
              >
                <ExternalLink size={14} className="stroke-[3]" /> KIRIM KE GOOGLE FORM LABCOM
              </a>

              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-2.5 rounded-xl border-2 border-black bg-white hover:bg-slate-50 transition-colors font-black text-xs cursor-pointer"
              >
                TUTUP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Small SparklesIcon for premium look
function SparklesIcon() {
  return (
    <svg className="w-4 h-4 text-black shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}
