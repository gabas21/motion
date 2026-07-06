'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Loader, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import API from '../../../lib/api';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Token verifikasi tidak ditemukan dalam tautan.');
      return;
    }

    API.get(`/auth/verify-email?token=${token}`)
      .then((res) => {
        setStatus('success');
        setMessage(res.data?.data?.message || 'Email berhasil diverifikasi!');
        setTimeout(() => router.push('/auth/login'), 3000);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.response?.data?.error || 'Verifikasi gagal. Token mungkin tidak valid atau sudah kedaluwarsa.');
      });
  }, [searchParams, router]);

  return (
    <div className="w-full max-w-md bg-white border-3 border-black shadow-neo-lg rounded-3xl p-8 relative z-10 text-center">
      {/* Header */}
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-neoYellow border-2 border-black flex items-center justify-center shadow-neo-sm transform -rotate-3">
            <Sparkles className="w-4.5 h-4.5 text-black" />
          </div>
          <span className="font-heading text-xl font-black tracking-tight text-black">Motion</span>
        </Link>
        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-black mb-2 leading-none">Verifikasi Email</h2>
      </div>

      {status === 'loading' && (
        <div className="space-y-4 py-6">
          <Loader className="w-12 h-12 text-neoViolet animate-spin mx-auto" />
          <p className="text-sm font-bold text-black/60">Sedang memverifikasi alamat email kamu...</p>
        </div>
      )}

      {status === 'success' && (
        <div className="space-y-6 py-4">
          <div className="w-16 h-16 rounded-full bg-neoMint border-3 border-black shadow-neo mx-auto flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-black" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-black text-black">Email Berhasil Diverifikasi!</h3>
            <p className="text-xs font-bold text-black/60">{message}</p>
          </div>
          <p className="text-[10px] font-bold text-black/40">Mengalihkan kamu ke halaman masuk dalam 3 detik...</p>
          <Link
            href="/auth/login"
            className="w-full neo-btn bg-neoMint text-black py-3.5 text-sm font-bold shadow-neo hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm active:translate-x-[3px] active:translate-y-[3px] active:shadow-none flex items-center justify-center gap-2"
          >
            Masuk Sekarang <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-6 py-4">
          <div className="w-16 h-16 rounded-full bg-neoOrange border-3 border-black shadow-neo mx-auto flex items-center justify-center">
            <XCircle className="w-8 h-8 text-white" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-black text-black">Verifikasi Email Gagal</h3>
            <p className="text-xs font-bold text-black/60">{message}</p>
          </div>
          <div className="flex flex-col gap-3">
            <Link
              href="/auth/login"
              className="w-full neo-btn bg-neoYellow text-black py-3.5 text-sm font-bold shadow-neo hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm active:translate-x-[3px] active:translate-y-[3px] active:shadow-none flex items-center justify-center gap-2"
            >
              Kembali ke Halaman Masuk
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative py-12 bg-transparent">
      {/* Dekorasi Bentuk Geometris Neobrutalisme */}
      <div className="absolute top-12 left-12 w-32 h-32 bg-neoYellow border-3 border-black shadow-neo rounded-2xl transform -rotate-12 hidden md:block"></div>
      <div className="absolute bottom-12 right-12 w-36 h-36 bg-neoMint border-3 border-black shadow-neo rounded-full transform rotate-12 hidden md:block"></div>
      <div className="absolute top-1/4 right-20 w-16 h-16 bg-neoPink border-3 border-black shadow-neo rounded-xl transform rotate-45 hidden md:block"></div>

      <Suspense fallback={
        <div className="w-full max-w-md bg-white border-3 border-black shadow-neo-lg rounded-3xl p-8 relative z-10 text-center space-y-4">
          <Loader className="w-10 h-10 text-neoViolet animate-spin mx-auto" />
          <p className="text-sm font-bold text-black/60">Memuat halaman...</p>
        </div>
      }>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
