'use client';

import React, { useEffect } from 'react';
import { Command } from 'cmdk';
import { 
  Search, Calendar, CheckSquare, BarChart2, BookOpen, 
  User, Settings, Sparkles, RefreshCw, FileText, GraduationCap, X
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  onSyncWeLearn?: () => void;
  onSyncCalendar?: () => void;
  onOpenAsepAI?: () => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  onNavigate,
  onSyncWeLearn,
  onSyncCalendar,
  onOpenAsepAI,
}: CommandPaletteProps) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          window.dispatchEvent(new CustomEvent('open-command-palette'));
        }
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelect = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-16 md:pt-28 px-4 animate-in fade-in-0 duration-150">
      <div className="w-full max-w-xl bg-white border-3 border-black rounded-2xl shadow-[6px_6px_0px_#000] overflow-hidden">
        <Command className="w-full font-body">
          {/* Header Input */}
          <div className="flex items-center border-b-2 border-black px-4 bg-[#FAF9F5]">
            <Search className="w-5 h-5 text-black shrink-0 font-black mr-2" />
            <Command.Input
              autoFocus
              placeholder="Ketik perintah atau cari modul (⌘K)..."
              className="w-full py-4 text-sm font-bold text-black placeholder:text-gray-400 bg-transparent outline-none border-none shadow-none focus:ring-0"
            />
            <button
              onClick={onClose}
              className="p-1 rounded-lg border border-black hover:bg-neoOrange transition-colors text-black font-black"
            >
              <X size={14} />
            </button>
          </div>

          {/* List Content */}
          <Command.List className="max-h-[340px] overflow-y-auto p-2 divide-y divide-black/5 custom-scrollbar">
            <Command.Empty className="py-6 text-center text-xs font-bold text-gray-500 font-mono">
              Tidak ada hasil yang cocok dengan pencarian Anda.
            </Command.Empty>

            {/* Group: Navigasi Modul */}
            <Command.Group heading="MODUL UTAMA" className="py-1.5 px-2 text-[10px] font-black text-black/50 font-mono uppercase tracking-wider">
              <Command.Item
                onSelect={() => handleSelect(() => onNavigate('overview'))}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-black hover:bg-neoYellow hover:border border-black transition-colors cursor-pointer select-none"
              >
                <BarChart2 size={16} className="text-black shrink-0" />
                <span>Beranda & Analitik</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect(() => onNavigate('list'))}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-black hover:bg-neoYellow hover:border border-black transition-colors cursor-pointer select-none"
              >
                <CheckSquare size={16} className="text-black shrink-0" />
                <span>Misi Utama / Daftar Tugas</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect(() => onNavigate('calendar'))}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-black hover:bg-neoYellow hover:border border-black transition-colors cursor-pointer select-none"
              >
                <Calendar size={16} className="text-black shrink-0" />
                <span>Agenda Kalender</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect(() => onNavigate('welearn'))}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-black hover:bg-neoYellow hover:border border-black transition-colors cursor-pointer select-none"
              >
                <GraduationCap size={16} className="text-black shrink-0" />
                <span>WeLearn Academic Portal</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect(() => onNavigate('siak'))}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-black hover:bg-neoYellow hover:border border-black transition-colors cursor-pointer select-none"
              >
                <BookOpen size={16} className="text-black shrink-0" />
                <span>SIAK Wicida</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect(() => onNavigate('excuse-letter'))}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-black hover:bg-neoYellow hover:border border-black transition-colors cursor-pointer select-none"
              >
                <FileText size={16} className="text-black shrink-0" />
                <span>Surat Izin Praktikum</span>
              </Command.Item>
            </Command.Group>

            {/* Group: Aksi Cepat */}
            <Command.Group heading="AKSI KILAT" className="py-1.5 px-2 text-[10px] font-black text-black/50 font-mono uppercase tracking-wider">
              {onOpenAsepAI && (
                <Command.Item
                  onSelect={() => handleSelect(onOpenAsepAI)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-black hover:bg-neoMint hover:border border-black transition-colors cursor-pointer select-none"
                >
                  <Sparkles size={16} className="text-black shrink-0" />
                  <span>Tanya Asep AI Assistant</span>
                </Command.Item>
              )}

              {onSyncWeLearn && (
                <Command.Item
                  onSelect={() => handleSelect(onSyncWeLearn)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-black hover:bg-neoMint hover:border border-black transition-colors cursor-pointer select-none"
                >
                  <RefreshCw size={16} className="text-black shrink-0" />
                  <span>Sinkronkan WeLearn Sekarang</span>
                </Command.Item>
              )}
            </Command.Group>

            {/* Group: Pengaturan */}
            <Command.Group heading="AKUN & PENGATURAN" className="py-1.5 px-2 text-[10px] font-black text-black/50 font-mono uppercase tracking-wider">
              <Command.Item
                onSelect={() => handleSelect(() => onNavigate('profile'))}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-black hover:bg-[#C084FC] hover:border border-black transition-colors cursor-pointer select-none"
              >
                <User size={16} className="text-black shrink-0" />
                <span>Profil Pengguna</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect(() => onNavigate('integrations'))}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-black hover:bg-[#C084FC] hover:border border-black transition-colors cursor-pointer select-none"
              >
                <Settings size={16} className="text-black shrink-0" />
                <span>Integrasi Layanan & Settings</span>
              </Command.Item>
            </Command.Group>

          </Command.List>

          {/* Footer Shortcuts Info */}
          <div className="px-4 py-2 bg-[#FAF9F5] border-t-2 border-black flex items-center justify-between text-[10px] font-mono font-bold text-gray-600">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-white border border-black rounded shadow-[1px_1px_0px_#000]">↑↓</span>
              <span>Navigasi</span>
              <span className="px-1.5 py-0.5 bg-white border border-black rounded shadow-[1px_1px_0px_#000] ml-2">↵</span>
              <span>Pilih</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 bg-white border border-black rounded shadow-[1px_1px_0px_#000]">ESC</span>
              <span>Tutup</span>
            </div>
          </div>
        </Command>
      </div>
    </div>
  );
}
