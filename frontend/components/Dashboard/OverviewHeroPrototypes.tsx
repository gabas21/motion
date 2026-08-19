'use client';

import React, { useState } from 'react';
import { Sparkles, Trophy, Zap, ArrowRight, Flame, CheckCircle2 } from 'lucide-react';

interface HeroData {
  userName: string;
  userLevel: number;
  currentXp: number;
  nextLevelXp: number;
  completedTasks: number;
  totalTasks: number;
  streakDays: number;
}

const mockData: HeroData = {
  userName: 'Naufal',
  userLevel: 14,
  currentXp: 2850,
  nextLevelXp: 3500,
  completedTasks: 18,
  totalTasks: 22,
  streakDays: 7,
};

export default function OverviewHeroPrototypes() {
  const [variant, setVariant] = useState<'quiet' | 'editorial' | 'neobrutalist'>('quiet');

  const progressPercent = Math.round((mockData.currentXp / mockData.nextLevelXp) * 100);

  return (
    <div className="w-full max-w-5xl mx-auto p-4 space-y-6">
      {/* 🧪 PROTOTYPE SWITCHER HEADER */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 text-white shadow-xl">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
          <span className="font-semibold text-sm tracking-wide">PROTOTYPE PICKER (HERO CARD VARIANTS)</span>
        </div>
        <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setVariant('quiet')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              variant === 'quiet'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            1. Quiet Glass
          </button>
          <button
            onClick={() => setVariant('editorial')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              variant === 'editorial'
                ? 'bg-slate-100 text-slate-900 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            2. Editorial
          </button>
          <button
            onClick={() => setVariant('neobrutalist')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              variant === 'neobrutalist'
                ? 'bg-amber-400 text-black font-extrabold shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            3. Neobrutalist
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------------------- */}
      {/* VARIANT 1: QUIET MINIMALIST (Apple-inspired Glassmorphism) */}
      {/* -------------------------------------------------------------------------- */}
      {variant === 'quiet' && (
        <div className="relative overflow-hidden rounded-3xl p-8 bg-gradient-to-br from-slate-900/90 via-violet-950/40 to-slate-900/90 border border-white/10 backdrop-blur-2xl text-white shadow-2xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>{mockData.streakDays} Hari Streak Produktif</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-white">
                Selamat Datang Kembali, <span className="font-semibold">{mockData.userName}</span>
              </h2>
              <p className="text-sm text-slate-400 max-w-lg leading-relaxed">
                Fokus Anda hari ini sangat luar biasa. Selesaikan 4 tugas tersisa untuk mempertahankan bonus XP mingguan.
              </p>
            </div>

            <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-md min-w-[240px]">
              <div className="w-12 h-12 rounded-xl bg-violet-500/20 border border-violet-400/30 flex items-center justify-center text-violet-300 font-bold text-lg">
                L{mockData.userLevel}
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Level Progress</span>
                  <span className="font-mono text-violet-300">{progressPercent}%</span>
                </div>
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-violet-500 to-indigo-400 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400">{mockData.currentXp} / {mockData.nextLevelXp} XP</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------------- */}
      {/* VARIANT 2: EDITORIAL TYPOGRAPHY (High-Contrast Monochrome & Clean Grid) */}
      {/* -------------------------------------------------------------------------- */}
      {variant === 'editorial' && (
        <div className="rounded-none border-t-2 border-b-2 border-slate-900 py-10 px-4 sm:px-8 bg-amber-50/40 text-slate-900 space-y-8 transition-all duration-300">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-300 pb-8">
            <div className="space-y-2">
              <span className="text-xs font-mono tracking-widest uppercase text-slate-500">
                // MOTION ACADEMIC EDITION · ISS. 04
              </span>
              <h1 className="text-4xl sm:text-5xl font-serif tracking-tight text-slate-900 leading-none">
                Ringkasan Hari Ini, <br />
                <span className="italic font-normal">{mockData.userName}.</span>
              </h1>
            </div>

            <div className="text-left md:text-right space-y-1 font-mono">
              <div className="text-3xl font-extrabold text-slate-900">{mockData.completedTasks} / {mockData.totalTasks}</div>
              <div className="text-xs text-slate-500 tracking-wider">TUGAS DISERAHKAN</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-sans">
            <div className="p-4 border-l-2 border-slate-900 space-y-1">
              <span className="text-xs font-mono text-slate-500">STATUS LEVEL</span>
              <div className="text-2xl font-bold">Level {mockData.userLevel} Scholar</div>
              <p className="text-xs text-slate-600">Sisa {mockData.nextLevelXp - mockData.currentXp} XP untuk mencapai Level {mockData.userLevel + 1}.</p>
            </div>

            <div className="p-4 border-l-2 border-slate-900 space-y-1">
              <span className="text-xs font-mono text-slate-500">REKAP STREAK</span>
              <div className="text-2xl font-bold">{mockData.streakDays} Hari Berturut-turut</div>
              <p className="text-xs text-slate-600">Konsistensi belajar Anda berada di top 5% mahasiswa.</p>
            </div>

            <div className="p-4 border-l-2 border-slate-900 space-y-1 flex flex-col justify-between">
              <span className="text-xs font-mono text-slate-500">REKOMENDASI ASEP AI</span>
              <p className="text-xs font-medium text-slate-800">"Prioritaskan kuis Fisika Dasar sebelum jam 17.00 WIB."</p>
              <button className="self-start mt-2 inline-flex items-center gap-1 text-xs font-bold underline hover:text-violet-700">
                Buka AI Assistant <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------------- */}
      {/* VARIANT 3: NEOBRUTALIST GAMIFIED (Dynamic 3D Vivid Arcade) */}
      {/* -------------------------------------------------------------------------- */}
      {variant === 'neobrutalist' && (
        <div className="rounded-2xl p-6 sm:p-8 bg-amber-300 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-black transition-all duration-300 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-violet-600 border-3 border-black text-white flex items-center justify-center font-black text-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                L{mockData.userLevel}
              </div>
              <div>
                <div className="inline-block px-2 py-0.5 bg-black text-white font-mono text-[10px] uppercase font-bold tracking-wider rounded">
                  PLAYER STATUS: ACTIVE
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-wide uppercase">
                  HALO, {mockData.userName}! ⚡
                </h2>
              </div>
            </div>

            <div className="px-4 py-2 bg-white border-3 border-black rounded-xl font-mono text-sm font-bold shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500 fill-orange-500" />
              <span>{mockData.streakDays} DAYS STREAK!</span>
            </div>
          </div>

          {/* Progress Bar & Quest Card */}
          <div className="p-4 bg-white border-3 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-3">
            <div className="flex justify-between items-center font-bold text-xs font-mono">
              <span>XP PROGRESS TO LEVEL {mockData.userLevel + 1}</span>
              <span className="bg-amber-300 px-2 py-0.5 border-2 border-black rounded">{mockData.currentXp} / {mockData.nextLevelXp} XP</span>
            </div>
            
            <div className="h-5 w-full bg-slate-200 border-3 border-black rounded-lg overflow-hidden p-0.5">
              <div 
                className="h-full bg-emerald-400 border-r-2 border-black rounded-sm transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-2 font-mono text-xs font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-700" />
              <span>{mockData.completedTasks} dari {mockData.totalTasks} Mission Completed</span>
            </div>

            <button className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-sm uppercase tracking-wider border-3 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center gap-2">
              <span>Mulai Misi Hari Ini</span>
              <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
