'use client';

import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F0F6FC] gap-6 px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-neoYellow border-3 border-black shadow-neo mx-auto flex items-center justify-center">
        <WifiOff className="w-10 h-10 text-black" />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-black text-black tracking-tight">Kamu Sedang Offline 📶</h1>
        <p className="text-gray-600 max-w-sm text-sm font-semibold">
          Koneksi internet tidak tersedia. Data yang sudah tersimpan di cache masih dapat Anda lihat.
        </p>
      </div>
      <button 
        onClick={() => window.location.reload()}
        className="neo-btn px-6 py-3 text-sm font-black flex items-center gap-2 bg-white hover:bg-slate-50 text-black shadow-neo"
      >
        <RefreshCw className="w-4 h-4 text-black" /> Coba Lagi
      </button>
    </div>
  );
}
