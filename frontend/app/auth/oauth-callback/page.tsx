'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader, Sparkles, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { useCalendar } from '../../../hooks/useCalendar';
import Link from 'next/link';
import { Skeleton } from '../../../components/ui/Skeleton';

function OAuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connectCalendar, error, isLoading } = useCalendar();
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      const connect = async () => {
        // Hubungkan kalender tiruan atau real
        const isGoogleMock = code.startsWith('mock_google_oauth_code');
        const type = isGoogleMock ? 'google' : 'google'; 
        
        const ok = await connectCalendar(type, code);
        if (ok) {
          setSuccess(true);
          // Redirect ke dashboard setelah 2 detik
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
        }
      };
      connect();
    } else {
      router.push('/dashboard');
    }
  }, [searchParams, connectCalendar, router]);

  return (
    <div className="w-full max-w-md bg-white border-3 border-black shadow-neo-lg rounded-3xl p-8 relative z-10 text-center">
      
      {/* Tahap Otentikasi (Connecting) */}
      {isLoading && !success && !error && (
        <div className="space-y-6 py-6">
          <div className="w-16 h-16 rounded-2xl bg-neoYellow border-2 border-black flex items-center justify-center mx-auto text-black relative shadow-neo-sm transform -rotate-3">
            <Loader className="w-8 h-8 animate-spin" />
            <Sparkles className="w-4.5 h-4.5 text-black absolute -top-2 -right-2 animate-bounce" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-black tracking-tight">Otentikasi Akun...</h2>
            <p className="text-sm font-semibold text-black/60">Sedang memverifikasi hak akses otorisasi dan membangun jembatan sinkronisasi AI...</p>
          </div>
        </div>
      )}

      {/* Tahap Sukses Terhubung */}
      {success && (
        <div className="space-y-6 py-6">
          <div className="w-16 h-16 rounded-2xl bg-neoMint border-2 border-black flex items-center justify-center mx-auto text-black shadow-neo transform rotate-3">
            <CheckCircle className="w-8 h-8 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-black tracking-tight">Kalender Terhubung!</h2>
            <p className="text-sm font-semibold text-black/60">Integrasi kalender Anda telah aktif. Mulai sinkronisasi agenda saat ini...</p>
          </div>
          <p className="text-xxs font-mono font-black uppercase tracking-wider bg-neoCream border border-black inline-block px-2.5 py-0.5 rounded">Mengalihkan ke Dasbor...</p>
        </div>
      )}

      {/* Tahap Gagal Sinkronisasi */}
      {error && (
        <div className="space-y-6 py-6">
          <div className="w-16 h-16 rounded-2xl bg-neoOrange border-2 border-black flex items-center justify-center mx-auto text-white shadow-neo transform -rotate-6">
            <AlertCircle className="w-8 h-8 text-white" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-black tracking-tight">Sinkronisasi Gagal</h2>
            <p className="text-xs font-bold text-white bg-neoOrange border-2 border-black rounded-xl p-3 shadow-neo-sm">{error}</p>
          </div>
          <Link 
            href="/dashboard" 
            className="w-full neo-btn bg-neoYellow text-black py-3.5 text-sm font-bold shadow-neo hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm active:translate-x-[3px] active:translate-y-[3px] active:shadow-none flex items-center justify-center gap-2 mt-4"
          >
            Kembali ke Dasbor <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative py-12 bg-neoCream">
      {/* Dekorasi Bentuk Geometris Neobrutalisme di Latar Belakang */}
      <div className="absolute top-12 left-12 w-32 h-32 bg-neoYellow border-3 border-black shadow-neo rounded-2xl transform -rotate-12 hidden md:block"></div>
      <div className="absolute bottom-12 right-12 w-36 h-36 bg-neoMint border-3 border-black shadow-neo rounded-full transform rotate-12 hidden md:block"></div>

      <Suspense fallback={
        <div className="w-full max-w-md bg-white border-3 border-black shadow-neo-lg rounded-3xl p-8 relative z-10 space-y-6 text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 border-2 border-black/10 flex items-center justify-center mx-auto relative shadow-sm">
            <Skeleton className="w-8 h-8" rounded="md" />
          </div>
          <div className="space-y-3">
            <Skeleton className="w-3/4 h-5 mx-auto" />
            <Skeleton className="w-5/6 h-3.5 mx-auto" />
            <Skeleton className="w-4/5 h-3.5 mx-auto" />
          </div>
        </div>
      }>
        <OAuthCallbackInner />
      </Suspense>
    </div>
  );
}
