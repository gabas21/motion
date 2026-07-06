import React from 'react';
import { Info, CheckCircle2, Edit3, XCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  isSubmittable: boolean;
}

export function StatusBadge({ status, isSubmittable }: StatusBadgeProps) {
  if (!isSubmittable) {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-black tracking-wider px-2 py-0.5 rounded-md font-mono bg-slate-200 text-black border-2 border-black shadow-[1.5px_1.5px_0px_#1D2A44]">
        <Info size={10} className="stroke-[3]" />
        <span>PENGINGAT</span>
      </span>
    );
  }

  const map: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    submitted: { 
      label: 'TERKUMPUL', 
      color: 'bg-emerald-300 text-black border-2 border-black shadow-[1.5px_1.5px_0px_#1D2A44]',
      icon: <CheckCircle2 size={10} className="stroke-[3]" />
    },
    draft:     { 
      label: 'DRAFT',     
      color: 'bg-amber-300 text-black border-2 border-black shadow-[1.5px_1.5px_0px_#1D2A44]',
      icon: <Edit3 size={10} className="stroke-[3]" />
    },
    new:       { 
      label: 'BELUM',     
      color: 'bg-red-300 text-black border-2 border-black shadow-[1.5px_1.5px_0px_#1D2A44]',
      icon: <XCircle size={10} className="stroke-[3]" />
    },
  };
  const cfg = map[status] || map['new'];
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-black tracking-wider px-2 py-0.5 rounded-md font-mono ${cfg.color}`}>
      {cfg.icon}
      <span>{cfg.label}</span>
    </span>
  );
}
