'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, RefreshCw, Home } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('Frontend runtime error captured:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative py-12 bg-[#FAF9F5]">
      {/* Background Neo Shapes */}
      <div className="absolute top-12 left-12 w-28 h-28 bg-neoOrange border-3 border-black shadow-neo rounded-2xl transform -rotate-12 hidden md:block"></div>
      <div className="absolute bottom-12 right-12 w-32 h-32 bg-neoYellow border-3 border-black shadow-neo rounded-full transform rotate-6 hidden md:block"></div>

      <div className="w-full max-w-lg bg-white border-3 border-black shadow-[8px_8px_0px_0px_#000] rounded-3xl p-8 text-center relative z-10">
        <div className="w-20 h-20 bg-neoOrange border-3 border-black shadow-neo rounded-full flex items-center justify-center mx-auto mb-6 transform -rotate-3">
          <ShieldAlert className="w-10 h-10 text-white" />
        </div>

        <h1 className="text-3xl font-black text-black tracking-tight mb-2 uppercase">Waduh, Sistem Error!</h1>
        <p className="text-sm font-bold text-black/60 mb-6 max-w-sm mx-auto">
          Terjadi kesalahan yang tidak terduga dalam memuat antarmuka sistem Motion.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <div className="bg-black/5 border-2 border-black rounded-2xl p-4 text-left mb-6 font-mono text-xs overflow-auto max-h-40 shadow-inner">
            <span className="font-bold text-neoOrange">Error Message:</span> {error.message || 'Unknown error'}
            {error.digest && (
              <div className="mt-1">
                <span className="font-bold text-black/50">Digest:</span> {error.digest}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto neo-btn bg-neoYellow text-black px-6 py-3.5 text-sm font-black shadow-neo hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm active:translate-x-[3px] active:translate-y-[3px] active:shadow-none flex items-center justify-center gap-2 cursor-pointer border-2 border-black"
          >
            <RefreshCw className="w-4.5 h-4.5" /> Muat Ulang Halaman
          </button>
          
          <Link
            href="/"
            className="w-full sm:w-auto neo-btn bg-white text-black px-6 py-3.5 text-sm font-black shadow-neo hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm active:translate-x-[3px] active:translate-y-[3px] active:shadow-none flex items-center justify-center gap-2 border-2 border-black"
          >
            <Home className="w-4.5 h-4.5" /> Kembali Ke Awal
          </Link>
        </div>
      </div>
    </div>
  );
}
