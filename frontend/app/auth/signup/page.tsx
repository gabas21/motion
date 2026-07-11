'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles, Mail, Lock, User, ArrowRight, Loader, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { AuthPageSkeleton } from '../../../components/ui/Skeleton';


export default function SignupPage() {
  const router = useRouter();
  const { signup, isAuthenticated, isInitialized, isLoading, error, clearError } = useAuth();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Bersihkan pesan error saat pertama masuk halaman
  useEffect(() => {
    clearError();
  }, [clearError]);

  // Jika sudah terotentikasi (dan token tervalidasi), alihkan ke dashboard
  useEffect(() => {
    if (isInitialized && isAuthenticated) {
      setIsRedirecting(true);
      router.push('/dashboard');
    }
  }, [isInitialized, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || isLoading || isRedirecting) return;
    
    setIsRedirecting(true);
    const success = await signup(name, email, password);
    if (success) {
      router.push('/dashboard');
    } else {
      setIsRedirecting(false);
    }
  };

  if (!isInitialized || isLoading || isRedirecting || isAuthenticated) {
    return <AuthPageSkeleton />;
  }


  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative py-12 bg-transparent">
      {/* Dekorasi Bentuk Geometris Neobrutalisme di Latar Belakang */}
      <div className="absolute top-12 left-12 w-32 h-32 bg-neoPink border-3 border-black shadow-neo rounded-2xl transform -rotate-12 hidden md:block"></div>
      <div className="absolute bottom-12 right-12 w-36 h-36 bg-neoYellow border-3 border-black shadow-neo rounded-full transform rotate-12 hidden md:block"></div>
      <div className="absolute top-1/4 right-20 w-16 h-16 bg-neoMint border-3 border-black shadow-neo rounded-xl transform rotate-45 hidden md:block"></div>

      <div className="w-full max-w-md bg-white border-3 border-black shadow-neo-lg rounded-3xl p-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-neoYellow border-2 border-black flex items-center justify-center shadow-neo-sm transform -rotate-3">
              <Sparkles className="w-4.5 h-4.5 text-black" />
            </div>
            <span className="font-heading text-xl font-black tracking-tight text-black">Motion</span>
          </Link>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-black mb-2 leading-none">Buat Akun Baru</h2>
          <p className="text-sm font-bold text-black/60 mt-1">Daftar hari ini dan nikmati kemudahan alokasi AI</p>
        </div>

        {/* Kotak Peringatan Error */}
        {error && (
          <div className="bg-neoOrange border-2 border-black text-white text-xs font-bold rounded-xl p-4 mb-6 shadow-neo-sm text-left">
            ⚠️ {error === 'Registration failed.' ? 'Pendaftaran gagal. Silakan coba lagi.' : error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Kolom Nama Lengkap */}
          <div className="space-y-2 text-left">
            <label className="text-xs font-black text-black uppercase tracking-wider ml-1">Nama Lengkap</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full neo-input py-3.5 pl-11 pr-4 text-sm"
                disabled={isLoading}
              />
            </div>
          </div>

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

          {/* Kolom Sandi */}
          <div className="space-y-2 text-left">
            <label className="text-xs font-black text-black uppercase tracking-wider ml-1">Kata Sandi</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full neo-input py-3.5 pl-11 pr-12 text-sm"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-black hover:text-black/60 focus:outline-none flex items-center justify-center cursor-pointer z-10 p-1"
                aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Tombol Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full neo-btn bg-neoMint text-black py-3.5 text-sm font-bold shadow-neo hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm active:translate-x-[3px] active:translate-y-[3px] active:shadow-none flex items-center justify-center gap-2 mt-8 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" /> Mendaftar Akun...
              </>
            ) : (
              <>
                Daftar Sekarang <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-black font-bold mt-8">
          Sudah memiliki akun?{' '}
          <Link href="/auth/login" className="text-black font-extrabold hover:underline decoration-neoViolet decoration-2">
            Masuk Sesi
          </Link>
        </p>
      </div>
    </div>
  );
}
