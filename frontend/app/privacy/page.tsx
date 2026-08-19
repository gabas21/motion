'use client';

import React from 'react';
import Link from 'next/link';
import { Shield, ArrowLeft, Lock, CheckCircle, Eye, Database } from 'lucide-react';

export default function PrivacyPolicyPage() {
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
            <div className="p-3 bg-neoYellow border-2 border-black rounded-2xl shadow-neo-sm">
              <Shield className="w-6 h-6 text-black" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-black/60 px-2 py-0.5 bg-neoMint rounded border border-black">
                Legal & Kepatuhan
              </span>
              <h1 className="text-2xl md:text-3xl font-black text-black mt-1">Kebijakan Privasi (Privacy Policy)</h1>
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
              <Lock className="w-4 h-4 text-purple-600" /> 1. Pengumpulan Data Pengguna
            </h2>
            <p className="text-slate-700">
              Motion mengumpulkan informasi yang Anda berikan secara langsung saat mendaftar akun, seperti Nama Lengkap, Alamat Email, serta data integrasi akademik (SIAK Wicida & WeLearn Moodle) untuk keperluan sinkronisasi tugas dan jadwal otomatis.
            </p>
          </section>

          <section className="space-y-2 border-t border-black/10 pt-4">
            <h2 className="text-base font-black text-black flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-600" /> 2. Penggunaan Data & Keamanan Kunci AI (BYOK)
            </h2>
            <p className="text-slate-700">
              API Key pribadi (BYOK) yang Anda daftarkan disimpan dalam bentuk terenkripsi **AES-256-GCM** menggunakan salt unik per user. Kunci API Anda hanya digunakan untuk memproses percakapan dengan AI ASEP dan **tidak pernah dibagikan** kepada pihak ketiga mana pun.
            </p>
          </section>

          <section className="space-y-2 border-t border-black/10 pt-4">
            <h2 className="text-base font-black text-black flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" /> 3. Hak Pengguna & Penghapusan Akun
            </h2>
            <p className="text-slate-700">
              Anda berhak memperbarui, mengunduh, atau meminta penghapusan seluruh data pribadi Anda dari database Motion kapan saja melalui menu Pengaturan Profil atau dengan menghubungi tim support kami di <strong className="text-black">bagasa020@gmail.com</strong>.
            </p>
          </section>

          <div className="bg-neoMint/20 border-2 border-black rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-700 shrink-0" />
            <span className="text-xs font-bold text-slate-800">
              Motion berkomitmen penuh menjaga privasi dan keamanan data akademik Anda sesuai standar regulasi perlindungan data.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
