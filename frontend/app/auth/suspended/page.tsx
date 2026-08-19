'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Mail, Sparkles, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';

export default function SuspendedPage() {
  const router = useRouter();
  const { logout } = useAuth();

  useEffect(() => {
    // Pastikan data lokal user dibersihkan dari storage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('motion_user');
    }
  }, []);

  const handleGoToLogin = () => {
    logout();
    router.push('/auth/login');
  };

  const adminEmail = 'bagasa020@gmail.com';
  const mailToUrl = `mailto:${adminEmail}?subject=${encodeURIComponent('Permohonan Pembukaan Suspensi Akun Motion')}&body=${encodeURIComponent('Halo Administrator Motion,\n\nSaya ingin mengajukan permohonan peninjauan kembali status suspensi akun saya.\n\nDetail Akun:\nEmail: \nAlasan/Catatan Tambahan: \n\nTerima kasih.')}`;

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative py-12 bg-neoYellow/10">
      {/* Dekorasi Bentuk Geometris Neobrutalisme di Latar Belakang */}
      <div className="absolute top-12 left-12 w-32 h-32 bg-neoOrange border-3 border-black shadow-neo rounded-2xl transform -rotate-12 hidden md:block"></div>
      <div className="absolute bottom-12 right-12 w-36 h-36 bg-neoYellow border-3 border-black shadow-neo rounded-full transform rotate-12 hidden md:block"></div>
      <div className="absolute top-1/4 right-20 w-16 h-16 bg-neoPink border-3 border-black shadow-neo rounded-xl transform rotate-45 hidden md:block"></div>

      <div className="w-full max-w-lg bg-white border-3 border-black shadow-neo-lg rounded-3xl p-8 relative z-10 text-center">
        
        {/* Top Badge Icon */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-neoOrange border-3 border-black flex items-center justify-center shadow-neo transform -rotate-3 mb-6">
          <ShieldAlert className="w-10 h-10 text-white stroke-[2.5]" />
        </div>

        {/* Header */}
        <div className="inline-flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-md bg-neoYellow border-2 border-black flex items-center justify-center shadow-neo-sm">
            <Sparkles className="w-3.5 h-3.5 text-black" />
          </div>
          <span className="font-heading text-sm font-black tracking-tight text-black">Motion Safety System</span>
        </div>

        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-black mb-3 leading-tight">
          Akun Anda Dinonaktifkan
        </h1>

        <p className="text-sm font-bold text-black/70 mb-6 leading-relaxed">
          Akses Anda ke aplikasi Motion telah ditangguhkan oleh Administrator. Selama masa penangguhan, Anda tidak dapat mengakses kalender, tugas, dan fitur sistem lainnya.
        </p>

        {/* Detail Box */}
        <div className="bg-neoOrange/10 border-2 border-black rounded-2xl p-5 mb-8 text-left shadow-neo-sm space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-neoOrange shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-black">Status Penangguhan</h4>
              <p className="text-xs font-extrabold text-black/80 mt-0.5">
                Penangguhan Akun oleh Administrator (Suspended)
              </p>
            </div>
          </div>
          <div className="border-t border-black/20 pt-2.5 text-xs font-bold text-black/70">
            💡 Jika Anda merasa penangguhan ini terjadi karena kekeliruan atau ingin mengajukan banding, silakan hubungi tim Administrator melalui email.
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <a
            href={mailToUrl}
            className="w-full neo-button bg-neoMint hover:bg-neoMint/90 text-black font-black text-sm py-4 px-6 rounded-xl flex items-center justify-center gap-2 border-2 border-black shadow-neo transition-all"
          >
            <Mail className="w-4 h-4 stroke-[2.5]" />
            Hubungi Administrator
          </a>

          <button
            onClick={handleGoToLogin}
            className="w-full neo-button bg-white hover:bg-black/5 text-black font-black text-sm py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 border-2 border-black shadow-neo-sm transition-all"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            Kembali ke Halaman Login
          </button>
        </div>

        <div className="mt-8 text-[11px] font-extrabold text-black/40">
          Motion AI System &bull; Email Dukungan: {adminEmail}
        </div>
      </div>
    </div>
  );
}
