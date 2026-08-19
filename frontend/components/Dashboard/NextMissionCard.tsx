'use client';

import React from 'react';
import { Target, Clock, Calendar, Sparkles, Plus, CheckCircle2 } from 'lucide-react';

export interface Task {
  id: string;
  title: string;
  description: string;
  timeEstimateMinutes: number;
  dueDate: string | null;
  priority: number;
  status: string;
  category: string;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
}

interface NextMissionCardProps {
  tasks: Task[];
  onNavigateToList?: () => void;
  onAskAsep?: () => void;
}

function getDeadlineInfo(dueDate: string | null): { label: string; urgency: 'critical' | 'warning' | 'normal' | null } {
  if (!dueDate) return { label: '', urgency: null };
  const diffMs = new Date(dueDate).getTime() - Date.now();
  const hoursLeft = diffMs / (1000 * 60 * 60);

  if (diffMs < 0) return { label: 'Tenggat waktu terlewati!', urgency: 'critical' };
  if (hoursLeft < 24) return { label: `${Math.max(1, Math.round(hoursLeft))} jam lagi`, urgency: 'critical' };
  if (hoursLeft < 72) return { label: `${Math.round(hoursLeft / 24)} hari lagi`, urgency: 'warning' };
  
  const formattedDate = new Date(dueDate).toLocaleDateString('id-ID', { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
  return { label: formattedDate, urgency: 'normal' };
}

export default function NextMissionCard({ tasks, onNavigateToList, onAskAsep }: NextMissionCardProps) {
  const pendingTasks = tasks.filter(t => t.status === 'pending');

  const nextMission = pendingTasks.length > 0
    ? [...pendingTasks].sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return b.priority - a.priority;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        const diff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        if (diff !== 0) return diff;
        return b.priority - a.priority;
      })[0]
    : null;

  if (!nextMission) {
    return (
      <div className="bg-white border-3 border-black shadow-neo rounded-2xl p-6 text-center select-none mb-6">
        <div className="w-12 h-12 rounded-2xl bg-neoYellow border-2 border-black flex items-center justify-center mx-auto mb-3 shadow-neo-sm">
          <CheckCircle2 className="w-6 h-6 text-black" />
        </div>
        <h3 className="font-heading font-black text-lg text-black mb-1">Semua Misi Selesai! 🎉</h3>
        <p className="text-xs text-gray-600 mb-4 max-w-sm mx-auto">
          Tidak ada tugas tertunda saat ini. Kamu bisa menambah misi baru atau bersantai sejenak.
        </p>
        {onNavigateToList && (
          <button
            onClick={onNavigateToList}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neoYellow border-2 border-black font-black text-xs shadow-neo-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tambah Misi Baru</span>
          </button>
        )}
      </div>
    );
  }

  const deadline = getDeadlineInfo(nextMission.dueDate);

  return (
    <div className="bg-white border-4 border-black shadow-[6px_6px_0px_#000] rounded-3xl p-5 md:p-6 relative overflow-hidden mb-6 group transition-all duration-200">
      {/* Accent Background Glow */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-neoYellow/30 rounded-full blur-xl pointer-events-none group-hover:scale-110 transition-transform" />

      {/* Header Tag */}
      <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-neoYellow border-2 border-black text-[10px] font-black tracking-wider uppercase shadow-[2px_2px_0px_#000]">
          <Target className="w-3.5 h-3.5 text-black stroke-[2.5]" />
          <span>🎯 NEXT MISSION</span>
        </div>
        {nextMission.category && (
          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-neoMint/20 border-2 border-black text-black shadow-[1.5px_1.5px_0px_#000]">
            {nextMission.category}
          </span>
        )}
      </div>

      {/* Title & Description */}
      <div className="relative z-10">
        <h2 className="font-heading font-black text-xl md:text-2xl text-black leading-snug mb-1.5 uppercase">
          {nextMission.title}
        </h2>
        {nextMission.description && (
          <p className="text-xs text-black/70 line-clamp-2 mb-4 font-semibold leading-relaxed">
            {nextMission.description}
          </p>
        )}
      </div>

      {/* Metadata Badges */}
      <div className="flex flex-wrap items-center gap-2.5 mb-5 text-xs font-black relative z-10">
        {deadline.label && (
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border-2 border-black font-mono shadow-[2px_2px_0px_#000] ${
            deadline.urgency === 'critical'
              ? 'bg-[#FF6B6B] text-black animate-pulse'
              : deadline.urgency === 'warning'
              ? 'bg-neoYellow text-black'
              : 'bg-slate-100 text-black'
          }`}>
            <Calendar className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{deadline.label}</span>
          </div>
        )}

        {nextMission.timeEstimateMinutes > 0 && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-neoMint text-black border-2 border-black font-mono shadow-[2px_2px_0px_#000]">
            <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>± {nextMission.timeEstimateMinutes} MIN</span>
          </div>
        )}
      </div>

      {/* CTA Buttons */}
      <div className="flex flex-wrap items-center gap-3 pt-3 border-t-2 border-black/15 relative z-10">
        {onNavigateToList && (
          <button
            onClick={onNavigateToList}
            className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-neoYellow border-2 border-black font-black text-xs text-black shadow-[3px_3px_0px_#000] hover:bg-amber-300 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
          >
            <Target className="w-4 h-4 text-black stroke-[2.5]" />
            <span>MULAI FOKUS MISI 🚀</span>
          </button>
        )}

        {onAskAsep && (
          <button
            onClick={onAskAsep}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#C084FC] border-2 border-black font-black text-xs text-black shadow-[3px_3px_0px_#000] hover:bg-purple-300 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-black stroke-[2.5]" />
            <span>🤖 TANYA ASEP</span>
          </button>
        )}
      </div>
    </div>
  );
}
