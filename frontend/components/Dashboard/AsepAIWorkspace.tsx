'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Bot, Sparkles, Send, Zap, Brain, FileText, Image as ImageIcon,
  Paperclip, Key, RefreshCw, Trash2, ArrowRight, ShieldCheck, Loader,
  CheckCircle, Globe
} from 'lucide-react';
import { useAI, Personality } from '../../hooks/useAI';
import { useAIConfig } from '../../hooks/useAIConfig';
import MarkdownRenderer from './MarkdownRenderer';
import BYOKGuideModal from '../ui/BYOKGuideModal';
import API from '../../lib/api';
import { toast } from '../../hooks/useToast';

interface AsepAIWorkspaceProps {
  onNavigateToTab?: (tab: string) => void;
}

const PERSONALITY_CONFIG: Record<Personality, {
  label: string;
  icon: React.ReactNode;
  headerBg: string;
  description: string;
}> = {
  productive: {
    label: 'Productive Kating',
    icon: <Zap size={14} className="text-amber-950 fill-amber-300" />,
    headerBg: 'bg-amber-400',
    description: 'Fokus pada eksekusi cepat, penyusunan jadwal, dan produktivitas tinggi.',
  },
  bestie: {
    label: 'Bestie Curhat',
    icon: <Sparkles size={14} className="text-rose-950 fill-rose-300" />,
    headerBg: 'bg-rose-300',
    description: 'Ramah, santai, dan siap mendengarkan keluh kesah perkuliahanmu.',
  },
  academic: {
    label: 'Academic Tutor',
    icon: <Brain size={14} className="text-purple-950 fill-purple-300" />,
    headerBg: 'bg-purple-300',
    description: 'Sokratik, mendalam, dan membantumu memahami materi atau soal ujian.',
  },
};

export default function AsepAIWorkspace({ onNavigateToTab }: AsepAIWorkspaceProps) {
  const [inputValue, setInputValue] = useState('');
  const [personality, setPersonality] = useState<Personality>('productive');
  const [chatMode, setChatMode] = useState<'study' | 'instant'>('study');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<{ name: string; date: string }[]>([]);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const { messages, isLoading, sendMessage, clearChat } = useAI();
  const { summary, fetchStatus: fetchAIStatus } = useAIConfig();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAIStatus();
  }, [fetchAIStatus]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const currentPersonality = PERSONALITY_CONFIG[personality];

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() && !imageBase64) return;

    const text = inputValue;
    const img = imageBase64 ?? undefined;

    setInputValue('');
    setImagePreview(null);
    setImageBase64(null);

    const isInstant = chatMode === 'instant';
    await sendMessage(text, personality, img, undefined, isInstant);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran gambar maksimal 5 MB!');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setImagePreview(result);
      setImageBase64(result);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Ukuran file dokumen maksimal 10 MB!');
      return;
    }

    setIsUploadingDoc(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await API.post('/ai/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(res.data?.data?.message || 'Dokumen berhasil dipelajari Asep!');
      setUploadedDocs((prev) => [
        { name: file.name, date: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) },
        ...prev,
      ]);
      await sendMessage(
        `[SISTEM] Saya baru saja mengunggah dokumen "${file.name}". Asep, pelajari isinya dan bantu saya membahas materi ini!`,
        personality
      );
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal mengunggah dokumen.');
    } finally {
      setIsUploadingDoc(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  const handleQuickPrompt = (promptText: string) => {
    setInputValue(promptText);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-6xl mx-auto space-y-4 text-left">
      {/* Workspace Header Panel */}
      <div className="bg-white border-3 border-black shadow-neo rounded-3xl p-5 shrink-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-neoYellow border-3 border-black flex items-center justify-center shadow-neo-sm">
            <Bot className="w-7 h-7 text-black stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-black tracking-tight">Asep AI Workspace</h1>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-black text-neoYellow rounded border border-black shadow-neo-sm">
                ProMax
              </span>
            </div>
            <p className="text-xs text-slate-600 font-bold mt-0.5">
              Asisten AI Kating Kampus • Mode Active: <strong className="text-black">{currentPersonality.label}</strong>
            </p>
          </div>
        </div>

        {/* Action Controls & BYOK Badge */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          {summary?.hasCustomKey ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 border-2 border-emerald-500 text-emerald-900 text-xs font-black">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>BYOK Key Active ✅</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsGuideOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neoYellow border-2 border-black text-black text-xs font-black hover:bg-neoYellow/80 shadow-neo-sm transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-black" />
                <span>Cara Ambil Key Gratis 📖</span>
              </button>

              <button
                onClick={() => onNavigateToTab ? onNavigateToTab('preferences') : window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'profile' }))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 border-2 border-amber-500 text-amber-900 text-xs font-black hover:bg-amber-200 transition-colors cursor-pointer"
              >
                <Key className="w-4 h-4 text-amber-600" />
                <span>Set API Key 🔑</span>
              </button>
            </div>
          )}

          <button
            onClick={clearChat}
            className="p-2.5 rounded-xl border-2 border-black bg-slate-100 hover:bg-slate-200 font-black text-xs text-slate-700 transition-all cursor-pointer"
            title="Bersihkan Percakapan"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mode Selector & Quick Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
        {(Object.entries(PERSONALITY_CONFIG) as [Personality, typeof PERSONALITY_CONFIG[Personality]][]).map(([key, cfg]) => {
          const isSelected = personality === key;
          return (
            <button
              key={key}
              onClick={() => setPersonality(key)}
              className={`p-3.5 rounded-2xl border-3 border-black text-left transition-all cursor-pointer flex items-center justify-between ${
                isSelected
                  ? 'bg-neoYellow shadow-neo -translate-y-0.5'
                  : 'bg-white hover:bg-slate-50 shadow-neo-sm'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white border-2 border-black">
                  {cfg.icon}
                </div>
                <div>
                  <h4 className="text-xs font-black text-black">{cfg.label}</h4>
                  <p className="text-[10px] text-slate-600 font-bold truncate max-w-[180px]">{cfg.description}</p>
                </div>
              </div>
              {isSelected && <CheckCircle className="w-4 h-4 text-black shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Main Chat Thread Area */}
      <div className="flex-1 bg-white border-3 border-black rounded-3xl shadow-neo p-4 md:p-6 overflow-y-auto space-y-4 flex flex-col min-h-0">
        {messages.length <= 1 && (
          <div className="bg-slate-50 border-2 border-black/10 rounded-2xl p-5 my-auto max-w-xl mx-auto text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-neoYellow border-2 border-black flex items-center justify-center mx-auto shadow-neo-sm">
              <Sparkles className="w-6 h-6 text-black" />
            </div>
            <h3 className="text-sm font-black text-black">Mulai Percakapan dengan Asep AI</h3>
            <p className="text-xs text-slate-600 font-bold max-w-md mx-auto leading-relaxed">
              Tanyakan materi kuliah, minta analisis burnout, atau instruksikan Asep untuk merapikan jadwal tugas secara otomatis!
            </p>

            <div className="grid grid-cols-1 gap-2 pt-2 text-xs font-bold">
              <button
                onClick={() => handleQuickPrompt("Tolong jadwalkan semua tugasku secara otomatis.")}
                className="p-2.5 rounded-xl border-2 border-black bg-white hover:bg-neoYellow/30 text-left flex items-center gap-2 transition-all cursor-pointer"
              >
                <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Rapikan jadwal tugas & belajar otomatis (Auto-Schedule)</span>
              </button>
              <button
                onClick={() => handleQuickPrompt("Bagaimana analisis risiko burnout saya minggu ini?")}
                className="p-2.5 rounded-xl border-2 border-black bg-white hover:bg-neoYellow/30 text-left flex items-center gap-2 transition-all cursor-pointer"
              >
                <Brain className="w-4 h-4 text-purple-500 shrink-0" />
                <span>Periksa analisis risiko stres & burnout (ML Analytics)</span>
              </button>
            </div>
          </div>
        )}

        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={index}
              className={`flex flex-col max-w-[90%] md:max-w-[85%] ${isUser ? 'self-end' : 'self-start'} animate-fadeIn`}
            >
              <span className={`text-[10px] font-extrabold text-slate-400 mb-1 flex items-center gap-1 ${isUser ? 'self-end' : 'self-start'}`}>
                {!isUser && <Bot className="w-3.5 h-3.5 text-purple-600" />}
                <span>{isUser ? 'Kamu' : 'Asep AI'}</span>
              </span>

              <div
                className={`p-4 rounded-2xl text-xs md:text-sm leading-relaxed text-left border-2 border-black ${
                  isUser
                    ? 'bg-slate-900 text-white font-semibold rounded-tr-none shadow-neo-sm'
                    : 'bg-slate-50 text-slate-900 rounded-tl-none shadow-neo-sm'
                }`}
              >
                {isUser && msg.imageBase64 && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={msg.imageBase64} alt="Attachment" className="max-h-48 rounded-xl border border-black/20 mb-2 object-contain" />
                )}
                {isUser ? (
                  <p>{msg.content}</p>
                ) : (
                  <>
                    <MarkdownRenderer content={msg.content} size="sm" />
                    {msg.requires_api_key && (
                      <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border-2 border-amber-500/40 flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                          <Key className="w-4 h-4 text-amber-600" />
                          <span>Konfigurasi API Key Dibutuhkan</span>
                        </div>
                        <p className="text-xs text-slate-700 font-medium">
                          {msg.reason === 'key_invalid_or_quota'
                            ? 'API Key Anda saat ini bermasalah (kuota habis atau kedaluwarsa). Perbarui API Key di Pengaturan Profile.'
                            : 'Silakan daftarkan API Key pribadi Anda (Gemini, Groq, atau OpenRouter) untuk menikmati akses AI ASEP tanpa batas.'}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => setIsGuideOpen(true)}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-neoYellow text-slate-950 text-xs font-black hover:bg-neoYellow/80 border border-black shadow-neo-sm transition-all cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Cara Ambil Key Gratis 📖</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onNavigateToTab ? onNavigateToTab('preferences') : window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'profile' }))}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-400 text-slate-950 text-xs font-bold hover:bg-amber-300 transition-all shadow-md active:scale-95 cursor-pointer"
                          >
                            <Key className="w-3.5 h-3.5" />
                            <span>Buka Pengaturan API Key 🔑</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <span className={`text-[9px] font-bold text-slate-400 mt-1 ${isUser ? 'self-end' : 'self-start'}`}>
                {new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex flex-col max-w-[80%] self-start">
            <span className="text-[10px] font-bold text-slate-400 mb-1">Asep sedang berpikir...</span>
            <div className="p-3.5 rounded-2xl bg-slate-100 border-2 border-black flex items-center gap-3">
              <Bot className="w-5 h-5 text-purple-600 animate-pulse" />
              <div className="flex gap-1.5 items-center">
                <span className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Panel */}
      <form onSubmit={handleSend} className="bg-white border-3 border-black rounded-3xl p-3 shadow-neo space-y-2 shrink-0">
        {imagePreview && (
          <div className="flex items-center gap-2 p-2 bg-slate-100 rounded-xl border border-black/20 w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="Preview" className="h-10 w-10 object-cover rounded-lg" />
            <span className="text-xs font-bold text-slate-700">Gambar Soal Siap Dikirim</span>
            <button type="button" onClick={() => { setImagePreview(null); setImageBase64(null); }} className="text-xs text-red-600 font-bold ml-2">Batal</button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />
          <input
            type="file"
            ref={docInputRef}
            onChange={handleDocUpload}
            accept=".pdf,.docx,.txt"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl border-2 border-black bg-slate-100 hover:bg-slate-200 transition-colors text-slate-700"
            title="Upload Foto Soal"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => docInputRef.current?.click()}
            disabled={isUploadingDoc}
            className="p-2.5 rounded-xl border-2 border-black bg-slate-100 hover:bg-slate-200 transition-colors text-slate-700"
            title="Upload Dokumen RAG (PDF/Word)"
          >
            {isUploadingDoc ? <Loader className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          </button>

          <input
            type="text"
            placeholder="Tanyakan materi, jadwalkan tugas, atau ketik pertanyaan ke Asep AI..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1 px-4 py-3 text-xs md:text-sm font-semibold border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-neoMint"
          />

          <button
            type="submit"
            disabled={isLoading || (!inputValue.trim() && !imageBase64)}
            className="px-5 py-3 rounded-xl bg-neoYellow border-2 border-black text-black font-black text-xs md:text-sm shadow-neo-sm hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>Kirim</span>
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>

      <BYOKGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
}
