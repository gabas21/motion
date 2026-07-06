'use client';

import React from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-4 w-full max-w-[380px] pointer-events-none">
      {toasts.map((toast) => {
        let bgClass = 'bg-white';
        let title = 'PEMBERITAHUAN';
        let icon = <Info className="w-5 h-5 text-[#1D2A44] stroke-[2.5]" />;
        
        switch (toast.type) {
          case 'success':
            bgClass = 'bg-[#86EFAC]'; // neoMint
            title = 'SUKSES';
            icon = <CheckCircle2 className="w-5 h-5 text-[#1D2A44] stroke-[2.5]" />;
            break;
          case 'error':
            bgClass = 'bg-[#FF6B6B]'; // neoPink / red
            title = 'GAGAL';
            icon = <AlertCircle className="w-5 h-5 text-[#1D2A44] stroke-[2.5]" />;
            break;
          case 'warning':
            bgClass = 'bg-[#FFDE4D]'; // neoYellow
            title = 'PERINGATAN';
            icon = <AlertTriangle className="w-5 h-5 text-[#1D2A44] stroke-[2.5]" />;
            break;
          case 'info':
            bgClass = 'bg-[#C084FC]'; // neoViolet
            title = 'INFORMASI';
            icon = <Info className="w-5 h-5 text-[#1D2A44] stroke-[2.5]" />;
            break;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 border-3 border-[#1D2A44] shadow-neo rounded-2xl ${bgClass} transition-all duration-300 transform translate-x-0 animate-in slide-in-from-right-5 duration-200 text-left`}
          >
            <div className="shrink-0 mt-0.5 p-1.5 bg-white border-2 border-[#1D2A44] rounded-xl shadow-neo-sm">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black tracking-wider text-[#1D2A44] font-mono mb-0.5 uppercase">
                {title}
              </div>
              <div className="text-xs font-bold leading-relaxed break-words text-[#1D2A44] font-body">
                {toast.message}
              </div>
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 p-1.5 border-2 border-[#1D2A44] bg-white hover:bg-black/5 hover:rotate-90 rounded-xl transition-all cursor-pointer text-[#1D2A44] shadow-neo-sm active:translate-y-0.5 active:shadow-none"
              title="Tutup"
            >
              <X className="w-3.5 h-3.5 stroke-[3]" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
