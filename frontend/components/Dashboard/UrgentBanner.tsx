'use client';

import React from 'react';
import { AlertTriangle, ExternalLink, Clock } from 'lucide-react';

interface AssignmentItem {
  id: string | number;
  name: string;
  dueDate?: string | null;
  courseName?: string;
  link?: string;
}

interface UrgentBannerProps {
  assignments: AssignmentItem[];
  onAskAsep?: () => void;
}

export default function UrgentBanner({ assignments, onAskAsep }: UrgentBannerProps) {
  if (!assignments || assignments.length === 0) return null;

  const urgentItems = assignments
    .filter(a => {
      if (!a.dueDate) return false;
      const hoursLeft = (new Date(a.dueDate).getTime() - Date.now()) / (1000 * 60 * 60);
      return hoursLeft > 0 && hoursLeft <= 48;
    })
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 3);

  if (urgentItems.length === 0) return null;

  return (
    <div className="mb-6 border-3 border-black rounded-2xl overflow-hidden shadow-neo bg-white">
      {/* Red Header Bar */}
      <div className="bg-red-500 px-4 py-2.5 flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-white shrink-0 animate-pulse" />
          <span className="font-heading font-black text-xs tracking-wider uppercase">
            🔴 URGENT — Deadline Mendekat!
          </span>
        </div>
        <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-md">
          {urgentItems.length} tugas perlukan perhatian
        </span>
      </div>

      {/* Assignment Items List */}
      <div className="divide-y-2 divide-black/10">
        {urgentItems.map((item) => {
          const hoursLeft = Math.max(1, Math.round((new Date(item.dueDate!).getTime() - Date.now()) / (1000 * 60 * 60)));
          return (
            <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-red-50/30 hover:bg-red-50/60 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 border border-red-300 text-red-800 text-[10px] font-black">
                    <Clock className="w-3 h-3" />
                    {hoursLeft} jam lagi
                  </span>
                  {item.courseName && (
                    <span className="text-[10px] font-bold text-gray-500 truncate">
                      {item.courseName}
                    </span>
                  )}
                </div>
                <h4 className="font-heading font-black text-sm text-black truncate">
                  {item.name}
                </h4>
              </div>

              {item.link && (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border-2 border-black font-black text-xs text-black shadow-neo-sm hover:bg-neoYellow transition-all shrink-0 self-start sm:self-center"
                >
                  <span>Kerjakan</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
