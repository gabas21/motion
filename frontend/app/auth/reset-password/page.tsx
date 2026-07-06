'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Lock, Loader, CheckCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import API from '../../../lib/api';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Token reset tidak ditemukan. Silakan request ulang link reset password.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || isLoading) return;

    if (password !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    if (password.length < 8) {
      setError('Kata sandi harus minimal 8 karakter.');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await API.post('/auth/reset-password', {
        token,
        new_password: password,
      });
      setMessage(res.data?.data?.message || 'Password berhasil disetel ulang.');
      setTimeout(() => router.push('/auth/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Gagal mereset password. Link mungkin sudah kedaluwarsa.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white border-3 border-black shadow-neo-lg rounded-3xl p-8 relative z-10">
      {/* Header */}
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-neoYellow border-2 border-black flex items-center justify-center shadow-neo-sm transform -rotate-3">
            <Sparkles className="w-4.5 h-4.5 text-black" />
          </div>
          <span className="font-heading text-xl font-black tracking-tight text-black">Motion</span>
        </Link>
        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-black mb-2 leading-none">Reset Password</h2>
        <p className="text-sm font-bold text-black/60 mt-1">Masukkan kata sandi baru untuk akun Motion kamu</p>
      </div>

      {/* Kotak Sukses */}
      {message && (
        <div className="bg-neoMint border-2 border-black text-black text-xs font-bold rounded-xl p-4 mb-6 shadow-neo-sm text-left flex items-start gap-2.5">
          <CheckCircle className="w-5 h-5 shrink-0 text-black" />
          <div className="space-y-1">
            <p>{message}</p>
            <p className="text-[10px] opacity-70">Mengalihkan kamu ke halaman login...</p>
          </div>
        </div>
      )}

      {/* Kotak Error */}
      {error && (
        <div className="bg-neoOrange border-2 border-black text-white text-xs font-bold rounded-xl p-4 mb-6 shadow-neo-sm text-left">
          ⚠️ {error}
        </div>
      )}

      {!message && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Kata Sandi Baru */}
          <div className="space-y-2 text-left">
            <label className="text-xs font-black text-black uppercase tracking-wider ml-1">Kata Sandi Baru</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
                className="w-full neo-input py-3.5 pl-11 pr-11 text-sm"
                disabled={isLoading || !token}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-black hover:text-black/60 focus:outline-none flex items-center justify-center cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>

          {/* Konfirmasi Kata Sandi */}
          <div className="space-y-2 text-left">
            <label className="text-xs font-black text-black uppercase tracking-wider ml-1">Konfirmasi Kata Sandi</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi kata sandi"
                className="w-full neo-input py-3.5 pl-11 pr-11 text-sm"
                disabled={isLoading || !token}
              />
            </div>
          </div>

          {/* Tombol Submit */}
          <button
            type="submit"
            disabled={isLoading || !token}
            className="w-full neo-btn bg-neoViolet text-black py-3.5 text-sm font-bold shadow-neo hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm active:translate-x-[3px] active:translate-y-[3px] active:shadow-none flex items-center justify-center gap-2 mt-8 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" /> Menyimpan...
              </>
            ) : (
              <>
                Simpan Kata Sandi <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      <p className="text-center text-xs text-black font-bold mt-8">
        Kembali ke{' '}
        <Link href="/auth/login" className="text-black font-extrabold hover:underline decoration-neoOrange decoration-2">
          Halaman Masuk
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
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
        <ResetPasswordContent />
      </Suspense>
    </div>
  );
}
