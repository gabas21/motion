'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Sparkles, Mail, Loader, CheckCircle, ArrowRight } from 'lucide-react';
import API from '../../../lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isLoading) return;

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await API.post('/auth/request-password-reset', { email });
      setMessage(res.data?.data?.message || 'Instruksi reset password telah dikirim ke email Anda.');
      setEmail('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Gagal mengirim email reset password. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative py-12 bg-transparent">
      {/* Dekorasi Bentuk Geometris Neobrutalisme */}
      <div className="absolute top-12 left-12 w-32 h-32 bg-neoYellow border-3 border-black shadow-neo rounded-2xl transform -rotate-12 hidden md:block"></div>
      <div className="absolute bottom-12 right-12 w-36 h-36 bg-neoMint border-3 border-black shadow-neo rounded-full transform rotate-12 hidden md:block"></div>
      <div className="absolute top-1/4 right-20 w-16 h-16 bg-neoPink border-3 border-black shadow-neo rounded-xl transform rotate-45 hidden md:block"></div>

      <div className="w-full max-w-md bg-white border-3 border-black shadow-neo-lg rounded-3xl p-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-neoYellow border-2 border-black flex items-center justify-center shadow-neo-sm transform -rotate-3">
              <Sparkles className="w-4.5 h-4.5 text-black" />
            </div>
            <span className="font-heading text-xl font-black tracking-tight text-black">Motion</span>
          </Link>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-black mb-2 leading-none">Lupa Password?</h2>
          <p className="text-sm font-bold text-black/60 mt-1">Masukkan alamat email terdaftar untuk menerima link reset password</p>
        </div>

        {/* Kotak Sukses */}
        {message && (
          <div className="bg-neoMint border-2 border-black text-black text-xs font-bold rounded-xl p-4 mb-6 shadow-neo-sm text-left flex items-start gap-2.5">
            <CheckCircle className="w-5 h-5 shrink-0 text-black" />
            <span>{message}</span>
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
            {/* Kolom Email */}
            <div className="space-y-2 text-left">
              <label className="text-xs font-black text-black uppercase tracking-wider ml-1">Alamat Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full neo-input py-3.5 pl-11 pr-4 text-sm"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Tombol Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full neo-btn bg-neoViolet text-black py-3.5 text-sm font-bold shadow-neo hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm active:translate-x-[3px] active:translate-y-[3px] active:shadow-none flex items-center justify-center gap-2 mt-8 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" /> Mengirim link...
                </>
              ) : (
                <>
                  Kirim Link Reset <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-black font-bold mt-8">
          Sudah ingat password?{' '}
          <Link href="/auth/login" className="text-black font-extrabold hover:underline decoration-neoOrange decoration-2">
            Masuk kembali
          </Link>
        </p>
      </div>
    </div>
  );
}
