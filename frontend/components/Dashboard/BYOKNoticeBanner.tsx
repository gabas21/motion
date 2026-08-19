import React, { useState, useEffect } from 'react';
import { Key, ShieldAlert, Sparkles, ArrowRight, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAIConfig } from '../../hooks/useAIConfig';
import BYOKGuideModal from '../ui/BYOKGuideModal';

interface BYOKNoticeBannerProps {
  onOpenSettings?: () => void;
}

export default function BYOKNoticeBanner({ onOpenSettings }: BYOKNoticeBannerProps) {
  const { user } = useAuth();
  const { summary, fetchStatus } = useAIConfig();
  const [dismissed, setDismissed] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  useEffect(() => {
    fetchStatus();
    if (typeof window !== 'undefined') {
      const isDismissed = localStorage.getItem('byok_notice_dismissed');
      if (isDismissed === 'true') {
        setDismissed(true);
      }
    }
  }, [fetchStatus]);

  // Don't show if user is admin or if BYOK key is already registered or dismissed
  if (user?.role === 'admin' || summary?.hasCustomKey || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('byok_notice_dismissed', 'true');
    }
  };

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-neoMint/30 bg-gradient-to-r from-emerald-950/40 via-darkNav/90 to-darkNav backdrop-blur-md p-4 md:p-5 shadow-xl transition-all">
      {/* Decorative Glow */}
      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-neoMint/10 blur-2xl pointer-events-none" />
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
        <div className="flex items-start gap-3.5">
          <div className="flex-shrink-0 p-2.5 rounded-xl bg-neoMint/10 border border-neoMint/30 text-neoMint">
            <Key className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-neoMint px-2 py-0.5 rounded-full bg-neoMint/10 border border-neoMint/20">
                Kebijakan API Key AI (BYOK)
              </span>
              <span className="flex items-center text-xs text-slate-400">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 mr-1" /> Wajib untuk AI Chat
              </span>
            </div>
            <h4 className="text-sm md:text-base font-bold text-white mt-1">
              Daftarkan API Key Pribadi Anda untuk Menggunakan AI ASEP 🔑
            </h4>
            <p className="text-xs md:text-sm text-slate-300 mt-0.5 max-w-2xl leading-relaxed">
              Untuk mengobrol dengan Asisten AI ASEP, daftarkan API Key pribadi Anda (Google Gemini, Groq, atau OpenRouter - <strong className="text-neoMint">Gratis</strong>). Penggunaan API Key default sistem kini dikhususkan untuk akun Admin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-shrink-0">
          <button
            onClick={() => setIsGuideOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-neoYellow text-black font-bold text-xs md:text-sm hover:bg-neoYellow/90 transition-all shadow-md cursor-pointer border border-black"
          >
            <Sparkles className="w-4 h-4 text-black" />
            <span>Cara Ambil Key 📖</span>
          </button>

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neoMint text-darkNav font-bold text-xs md:text-sm hover:bg-neoMint/90 transition-all shadow-md shadow-neoMint/20 hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              <span>Pengaturan API Key</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Tutup pemberitahuan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <BYOKGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
}
