'use client';

import React, { useState } from 'react';
import { 
  X, Key, ExternalLink, CheckCircle, Sparkles, ShieldCheck, 
  ArrowRight, Copy, Check, Loader, Info, HelpCircle
} from 'lucide-react';
import { useAIConfig } from '../../hooks/useAIConfig';
import { toast } from '../../hooks/useToast';

interface BYOKGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type ProviderType = 'gemini' | 'groq' | 'openrouter';

const PROVIDER_GUIDES: Record<ProviderType, {
  name: string;
  badge: string;
  badgeBg: string;
  url: string;
  urlLabel: string;
  keyPrefix: string;
  placeholder: string;
  steps: string[];
  note: string;
}> = {
  gemini: {
    name: 'Google Gemini',
    badge: 'Rekomendasi (Gratis)',
    badgeBg: 'bg-emerald-400 text-black',
    url: 'https://aistudio.google.com/app/apikey',
    urlLabel: 'aistudio.google.com',
    keyPrefix: 'AIzaSy...',
    placeholder: 'Tempelkan API Key Gemini di sini (AIzaSy...)',
    steps: [
      'Klik tombol "Buka Google AI Studio" di bawah ini.',
      'Login menggunakan akun Google / Gmail Anda.',
      'Klik tombol biru "+ Create API key" di pojok kanan atas.',
      'Pilih project Google Cloud Anda, lalu klik "Create API key in existing project".',
      'Salin kode API Key yang muncul (diawali dengan "AIzaSy..."), lalu tempelkan pada kolom di bawah.'
    ],
    note: 'Gratis 100% dari Google hingga 15 request per menit (Sangat cukup untuk kuliah & tugas).'
  },
  groq: {
    name: 'Groq AI',
    badge: 'Super Kencang',
    badgeBg: 'bg-amber-400 text-black',
    url: 'https://console.groq.com/keys',
    urlLabel: 'console.groq.com/keys',
    keyPrefix: 'gsk_...',
    placeholder: 'Tempelkan API Key Groq di sini (gsk_...)',
    steps: [
      'Klik tombol "Buka Groq Console" di bawah ini.',
      'Daftar atau login akun gratis Groq.',
      'Klik tombol "+ Create API Key".',
      'Beri nama kunci (contoh: "Motion ASEP"), lalu salin kunci yang diberikan (diawali "gsk_...").',
      'Tempelkan kunci tersebut pada kolom di bawah.'
    ],
    note: 'Sangat kencang dengan respon kurang dari 1 detik (Llama 3.3 70B).'
  },
  openrouter: {
    name: 'OpenRouter',
    badge: 'Multi-Model',
    badgeBg: 'bg-cyan-400 text-black',
    url: 'https://openrouter.ai/keys',
    urlLabel: 'openrouter.ai/keys',
    keyPrefix: 'sk-or-...',
    placeholder: 'Tempelkan API Key OpenRouter di sini (sk-or-...)',
    steps: [
      'Klik tombol "Buka OpenRouter Dashboard" di bawah ini.',
      'Sign in menggunakan akun Google atau GitHub Anda.',
      'Klik tombol "Create Key", beri nama (contoh: "Motion App").',
      'Salin kunci API Key yang dibuat (diawali "sk-or-...").',
      'Tempelkan kunci tersebut pada kolom di bawah.'
    ],
    note: 'Akses ratusan model AI (Claude 3.5, GPT-4o, DeepSeek R1) dari 1 API Key.'
  }
};

export default function BYOKGuideModal({ isOpen, onClose, onSuccess }: BYOKGuideModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>('gemini');
  const [inputKey, setInputKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { saveSingleKey, fetchStatus } = useAIConfig();

  if (!isOpen) return null;

  const currentGuide = PROVIDER_GUIDES[selectedProvider];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      toast.error('Silakan masukkan kode API Key terlebih dahulu!');
      return;
    }

    setIsSubmitting(true);
    try {
      await saveSingleKey(selectedProvider, inputKey.trim());
      toast.success(`API Key ${currentGuide.name} berhasil diverifikasi & disimpan! 🎉`);
      await fetchStatus();
      setInputKey('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Verifikasi API Key gagal. Pastikan key aktif.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white border-3 border-black shadow-[10px_10px_0px_0px_#000] rounded-3xl p-6 overflow-hidden text-left max-h-[90vh] flex flex-col">
        {/* Background Accent */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-neoYellow rounded-full border-3 border-black opacity-30 pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b-3 border-dashed border-black/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-neoYellow border-2 border-black flex items-center justify-center shadow-neo-sm">
              <Key className="w-6 h-6 text-black stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-black">Panduan Memasang API Key AI</h3>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-black bg-neoMint text-black">
                  Gratis 100%
                </span>
              </div>
              <p className="text-xs text-slate-600 font-bold mt-0.5">
                Dapatkan API Key pribadi hanya dalam 1 menit untuk mengakses ASEP AI tanpa batas.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl border-2 border-black bg-slate-100 hover:bg-slate-200 transition-colors text-black cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Scrollable Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1">
          {/* Provider Selector Tabs */}
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(PROVIDER_GUIDES) as ProviderType[]).map((prov) => {
              const guide = PROVIDER_GUIDES[prov];
              const isSelected = selectedProvider === prov;
              return (
                <button
                  key={prov}
                  type="button"
                  onClick={() => {
                    setSelectedProvider(prov);
                    setInputKey('');
                  }}
                  className={`p-3 rounded-2xl border-2 border-black text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-neoYellow shadow-neo-sm font-black -translate-y-0.5'
                      : 'bg-slate-50 hover:bg-slate-100 font-bold text-slate-700'
                  }`}
                >
                  <div className="text-xs font-black text-black">{guide.name}</div>
                  <span className={`inline-block mt-1 text-[9px] font-black px-1.5 py-0.5 rounded border border-black ${guide.badgeBg}`}>
                    {guide.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Step by Step Container */}
          <div className="bg-slate-50 border-2 border-black rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-black uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Langkah Mendapatkan Key {currentGuide.name}
              </h4>
              <a
                href={currentGuide.url}
                target="_blank"
                rel="noopener noreferrer"
                className="neo-btn bg-neoMint text-black px-3 py-1.5 text-xs font-black rounded-xl border-2 border-black shadow-neo-sm hover:-translate-y-0.5 transition-transform flex items-center gap-1 cursor-pointer"
              >
                <span>Buka {currentGuide.urlLabel}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* List of Steps */}
            <ol className="space-y-2.5 text-xs font-semibold text-slate-800">
              {currentGuide.steps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2.5 bg-white p-2.5 rounded-xl border border-black/20">
                  <span className="w-5 h-5 rounded-full bg-black text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="leading-snug">{step}</span>
                </li>
              ))}
            </ol>

            {/* Note alert */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] font-bold text-amber-900 flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{currentGuide.note}</span>
            </div>
          </div>

          {/* Direct Key Submission Input */}
          <form onSubmit={handleSubmit} className="space-y-3 bg-white border-2 border-black rounded-2xl p-4 shadow-neo-sm">
            <label className="block text-xs font-black text-black">
              Tempelkan API Key {currentGuide.name} Anda Di Sini:
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder={currentGuide.placeholder}
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="w-full neo-input rounded-xl pl-4 pr-10 py-3 text-xs font-mono font-bold"
                disabled={isSubmitting}
              />
              <Key className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !inputKey.trim()}
              className="w-full neo-btn bg-neoYellow text-black rounded-xl py-3 text-xs font-black shadow-neo hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer border-2 border-black"
            >
              {isSubmitting ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" /> Memverifikasi Kunci ke {currentGuide.name}...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4.5 h-4.5 text-black" /> Verifikasi & Simpan API Key 🔑
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
