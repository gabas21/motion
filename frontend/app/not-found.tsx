'use client';

import React from 'react';
import Link from 'next/link';
import { HelpCircle, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative py-12 bg-[#FAF9F5]">
      {/* Background Neo Shapes */}
      <div className="absolute top-12 left-12 w-28 h-28 bg-neoPink border-3 border-black shadow-neo rounded-2xl transform -rotate-12 hidden md:block"></div>
      <div className="absolute bottom-12 right-12 w-32 h-32 bg-neoMint border-3 border-black shadow-neo rounded-full transform rotate-6 hidden md:block"></div>

      <div className="w-full max-w-lg bg-white border-3 border-black shadow-[8px_8px_0px_0px_#000] rounded-3xl p-8 text-center relative z-10">
        <div className="w-20 h-20 bg-neoPink border-3 border-black shadow-neo rounded-full flex items-center justify-center mx-auto mb-6 transform rotate-3">
          <HelpCircle className="w-10 h-10 text-black" />
        </div>

        <h1 className="text-4xl font-black text-black tracking-tight mb-2 uppercase">Halaman 404</h1>
        <h2 className="text-xl font-black text-black/80 mb-3 leading-none">Rute Tidak Ditemukan!</h2>
        
        <p className="text-sm font-bold text-black/60 mb-8 max-w-sm mx-auto">
          Maaf, halaman atau rute jadwal yang kamu cari tidak terdaftar atau telah dipindahkan ke alokasi lain.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={() => window.history.back()}
            className="w-full sm:w-auto neo-btn bg-white text-black px-6 py-3.5 text-sm font-black shadow-neo hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm active:translate-x-[3px] active:translate-y-[3px] active:shadow-none flex items-center justify-center gap-2 cursor-pointer border-2 border-black"
          >
            <ArrowLeft className="w-4.5 h-4.5" /> Kembali
          </button>
          
          <Link
            href="/dashboard"
            className="w-full sm:w-auto neo-btn bg-neoYellow text-black px-6 py-3.5 text-sm font-black shadow-neo hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm active:translate-x-[3px] active:translate-y-[3px] active:shadow-none flex items-center justify-center gap-2 border-2 border-black"
          >
            <Home className="w-4.5 h-4.5" /> Ke Dasbor
          </Link>
        </div>
      </div>
    </div>
  );
}
