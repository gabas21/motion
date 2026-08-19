'use client';

import React from 'react';
import Link from 'next/link';
import { FileText, ArrowLeft, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#FAF9F5] text-black p-6 md:p-12 text-left">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-black rounded-xl text-xs font-black shadow-neo hover:-translate-y-0.5 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Dasbor
        </Link>

        {/* Header Banner */}
        <div className="bg-white border-3 border-black rounded-3xl p-6 md:p-8 shadow-[8px_8px_0px_0px_#000] relative overflow-hidden">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-neoMint border-2 border-black rounded-2xl shadow-neo-sm">
              <FileText className="w-6 h-6 text-black" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-black/60 px-2 py-0.5 bg-neoYellow rounded border border-black">
                Syarat Penggunaan
              </span>
              <h1 className="text-2xl md:text-3xl font-black text-black mt-1">Ketentuan Layanan (Terms of Service)</h1>
            </div>
          </div>
          <p className="text-xs md:text-sm text-slate-600 font-bold mt-2">
            Terakhir diperbarui: 13 Agustus 2026 • Motion AI Application
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white border-3 border-black rounded-3xl p-6 md:p-8 shadow-neo space-y-6 text-xs md:text-sm leading-relaxed font-medium">
          <section className="space-y-2">
            <h2 className="text-base font-black text-black flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> 1. Ketentuan Umum
            </h2>
            <p className="text-slate-700">
              Dengan membuat akun atau menggunakan layanan Motion, Anda menyetujui untuk mematuhi seluruh ketentuan penggunaan ini. Motion merupakan platform manajemen tugas dan kalender AI untuk membantu efisiensi perkuliahan mahasiswa.
            </p>
          </section>

          <section className="space-y-2 border-t border-black/10 pt-4">
            <h2 className="text-base font-black text-black flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600" /> 2. Penggunaan Layanan & Akun AI
            </h2>
            <p className="text-slate-700">
              Pengguna bertanggung jawab menjaga kerahasiaan kata sandi dan API Key pribadi (BYOK) yang digunakan. Pengguna dilarang menyalahgunakan layanan untuk tindakan ilegal, spaming, atau perusakan sistem.
            </p>
          </section>

          <section className="space-y-2 border-t border-black/10 pt-4">
            <h2 className="text-base font-black text-black flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" /> 3. Pembatasan Tanggung Jawab
            </h2>
            <p className="text-slate-700">
              Motion berusaha memberikan rekomendasi jadwal dan sinkronisasi tugas seakurat mungkin, namun pengguna tetap disarankan memeriksa tenggat resmi pada portal SIAK dan Moodle masing-masing kampus.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
