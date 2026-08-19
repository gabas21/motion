'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Sparkles, X, Send, Trash2, Bot, Image as ImageIcon, BookOpen, Smile, Zap,
  Paperclip, Loader, Maximize2, Minimize2, FileText, Brain, Heart, GraduationCap, Layers, Key,
} from 'lucide-react';
import { useAI, ChatMessage, Personality } from '../../hooks/useAI';
import { useAIChatBridge } from '../../hooks/useAIChatBridge';
import MarkdownRenderer from './MarkdownRenderer';
import API from '../../lib/api';
import OnboardingTooltip from '../Onboarding/OnboardingTooltip';


// ─── Konfigurasi Personality (UI/UX PRO-MAX: No Emojis, Pure SVG Icons) ───────────
const PERSONALITY_CONFIG: Record<Personality, {
  label: string;
  icon: React.ReactNode;
  largeIcon: React.ReactNode;
  headerBg: string;
  headerText: string;
  description: string;
  placeholder: string;
  gradient: string;
}> = {
  productive: {
    label: 'Productive',
    icon: <Zap size={13} className="stroke-[2.5]" />,
    largeIcon: <Zap size={15} className="stroke-[2.5] text-amber-950 fill-amber-300 animate-float" />,
    headerBg: 'bg-amber-400',
    headerText: 'text-amber-950',
    description: 'Coach tegas & to-the-point',
    placeholder: 'Tanya Asep tentang tugas...',
    gradient: 'from-amber-400/15 via-orange-400/5 to-white',
  },
  bestie: {
    label: 'Bestie',
    icon: <Heart size={13} className="stroke-[2.5] fill-rose-450 text-rose-600" />,
    largeIcon: <Heart size={15} className="stroke-[2.5] text-rose-950 fill-rose-300 animate-pulse" />,
    headerBg: 'bg-rose-400',
    headerText: 'text-rose-950',
    description: 'Teman curhat yang hangat',
    placeholder: 'Cerita dong ke Asep...',
    gradient: 'from-rose-400/15 via-pink-400/5 to-white',
  },
  academic: {
    label: 'Academic',
    icon: <GraduationCap size={13} className="stroke-[2.5]" />,
    largeIcon: <GraduationCap size={15} className="stroke-[2.5] text-violet-950 fill-violet-300" />,
    headerBg: 'bg-violet-400',
    headerText: 'text-violet-950',
    description: 'Tutor Sokratik + LaTeX',
    placeholder: 'Tanya soal atau rumus matematika...',
    gradient: 'from-violet-400/15 via-purple-400/5 to-white',
  },
};

// ─── Komponen Preview Gambar ───────────────────────────────────────────────────
function ImagePreview({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div className="relative inline-block mb-2 self-start animate-fadeIn">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Gambar soal"
        className="max-h-28 max-w-full rounded-lg border-2 border-black shadow-neo-sm object-contain"
      />
      <button
        onClick={onRemove}
        type="button"
        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 border-2 border-black rounded-full flex items-center justify-center cursor-pointer hover:bg-red-600 transition-colors"
      >
        <X size={10} className="text-white stroke-[3]" />
      </button>
    </div>
  );
}

// ─── Komponen Utama ────────────────────────────────────────────────────────────
const AIChatWidget = React.memo(function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true); // UI/UX PROMAX: Fitur ekspansi layar lebar
  const [inputValue, setInputValue] = useState('');
  const [personality, setPersonality] = useState<Personality>('productive');
  const [chatMode, setChatMode] = useState<'study' | 'instant'>('study');
  const [showPersonalityMenu, setShowPersonalityMenu] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<{ name: string; date: string }[]>([]); // Daftar file RAG terunggah
  const [banner, setBanner] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);
  const [isExporting, setIsExporting] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false); // Untuk drop zone saat drag dari WeLearn
  const { messages, isLoading, sendMessage, stopRequest, clearChat } = useAI();
  const { isOpen: bridgeOpen, pendingContext, clearContext } = useAIChatBridge();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const currentPersonality = PERSONALITY_CONFIG[personality];

  // Quota and plan state
  const [quota, setQuota] = useState<{
    plan: string;
    taskQuota: { used: number; limit: number };
    chatQuota: { used: number; limit: number };
  } | null>(null);

  const isChatQuotaExceeded = !!(quota && quota.plan !== 'pro' && quota.chatQuota.used >= quota.chatQuota.limit);

  const fetchQuota = useCallback(async () => {
    try {
      const response = await API.get('/users/quota');
      setQuota(response.data.data);
    } catch (err) {
      console.error('Gagal mengambil kuota pengguna:', err);
    }
  }, []);

  // Fetch quota when chat window is opened
  useEffect(() => {
    if (isOpen) {
      fetchQuota();
    }
  }, [isOpen, fetchQuota]);

  // Helper untuk menampilkan banner status neobrutalist
  const showBanner = (message: string, type: 'error' | 'success' | 'info') => {
    setBanner({ message, type });
  };

  // Dengarkan bridge state dari WeLearnTab
  // Saat user klik "Tanya Asep" di card tugas, chat terbuka + langsung auto-send konteks tugas
  useEffect(() => {
    if (bridgeOpen && pendingContext) {
      setIsOpen(true);
      setChatMode('instant'); // Mode Jawaban Instan untuk tugas akademik
      clearContext();         // Reset bridge setelah dibaca

      // Auto-send langsung tanpa user harus tekan tombol kirim
      const systemHint = `[MODE INSTAN / JAWABAN LANGSUNG: Jawablah pertanyaan di atas secara sangat komprehensif, terstruktur, rapi, lengkap, dan detail tanpa ringkasan atau basa-basi pelatih. PANGGIL secara otomatis tool/function GenerateWeLearnDocx dengan judul dan isi draf yang telah Anda buat untuk menghasilkan dokumen .docx Word profesional agar siap diunduh pengguna.]`;
      sendMessage(pendingContext, personality, undefined, systemHint, true);

      // Scroll ke bawah setelah render
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 150);
    }
  }, [bridgeOpen, pendingContext, clearContext, sendMessage, personality]);

  // Auto-dismiss banner setelah 5 detik
  useEffect(() => {
    if (banner) {
      const timer = setTimeout(() => setBanner(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [banner]);

  // Cerdas: Auto-detect kata kunci dokumen untuk otomatis mengaktifkan Mode Jawaban Instan
  useEffect(() => {
    const lowValue = inputValue.toLowerCase();
    const docKeywords = ['docx', 'word', 'unduh docx', 'unduh word', 'buatkan docx', 'buatkan word', 'tugas 1', 'tugas kompilasi'];
    const hasKeyword = docKeywords.some(keyword => lowValue.includes(keyword));
    if (hasKeyword && chatMode === 'study') {
      setChatMode('instant');
      showBanner('Mendeteksi permintaan dokumen akademik. Mengaktifkan Mode Jawaban Instan (.docx)...', 'success');
    }
  }, [inputValue, chatMode]);

  const handleManualExport = async (content: string, index: number) => {
    setIsExporting(index);
    try {
      const promptTrigger = `[SISTEM: Buatkan dokumen Word (.docx) dengan format rapi dan isi lengkap dari draf jawaban berikut. PANGGIL fungsi/tool GenerateWeLearnDocx secara langsung!]\n\nDRAF KONTEN JAWABAN:\n${content}`;
      await sendMessage(promptTrigger, personality);
      showBanner('Permintaan ekspor dikirimkan. Silakan periksa chat terbaru untuk link unduhan.', 'success');
    } catch (err: any) {
      showBanner('Gagal mengekspor dokumen via chat: ' + err.message, 'error');
    } finally {
      setIsExporting(null);
    }
  };

  const handleManualExportDirect = async (content: string, index: number) => {
    setIsExporting(index);
    try {
      showBanner('Sedang membuat berkas Word. Mohon tunggu...', 'info');
      
      const response = await API.post('/ai/documents/generate-docx-direct', {
        title: 'Tugas_Ekspor_Motion',
        content: content,
      }, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Ekspor_Asep_${Date.now()}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showBanner('Berkas Word (.docx) berhasil diunduh langsung!', 'success');
    } catch (err: any) {
      console.warn('Fallback to chat-triggered docx generation...', err);
      await handleManualExport(content, index);
    } finally {
      setIsExporting(null);
    }
  };

  // UI/UX PROMAX: Proteksi responsif untuk perangkat mobile/tablet
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsExpanded(false);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // UI/UX PROMAX: Presistensi riwayat percakapan di browser (localStorage)
  useEffect(() => {
    const saved = localStorage.getItem('motion_chat_messages');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          useAI.setState({ messages: parsed });
        }
      } catch (e) {
        console.error('Failed to load chat history:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('motion_chat_messages', JSON.stringify(messages));
    }
  }, [messages]);

  // UI/UX PROMAX: Pemicu prompt instan & frictionless (Single Click Send)
  const handleQuickPrompt = async (promptText: string) => {
    if (isLoading) return;
    await sendMessage(promptText, personality);
  };

  // ─── Auto-scroll ────────────────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen, isLoading, scrollToBottom]);

  // ─── Klik di luar untuk tutup ─────────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        chatWindowRef.current &&
        !chatWindowRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('.ai-trigger-btn')
      ) {
        setIsOpen(false);
        setShowPersonalityMenu(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // ─── Kirim Pesan ─────────────────────────────────────────────────────────────
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputValue.trim() && !imageBase64) || isLoading) return;

    const text = inputValue || '(Tolong analisis gambar soal yang aku kirim ini)';
    const img = imageBase64 ?? undefined;

    setInputValue('');
    setImagePreview(null);
    setImageBase64(null);

    const promptProcessorInstruction = "\n[SISTEM NOTE: Jika prompt pengguna di atas mengandung teks yang kacau, terpotong, salah terjemahan, atau tidak beraturan, harap bersihkan terlebih dahulu, analisis pertanyaan aslinya secara mendalam, lalu berikan hasil rekonstruksi soal dan jawaban yang sesuai dengan konteks tugas yang dimaksud.]";

    const systemHint = chatMode === 'instant'
      ? `[MODE INSTAN / JAWABAN LANGSUNG: Jawablah pertanyaan di atas secara sangat komprehensif, terstruktur, rapi, lengkap, dan detail tanpa ringkasan atau basa-basi pelatih. PANGGIL secara otomatis tool/function GenerateWeLearnDocx dengan judul dan isi draf yang telah Anda buat untuk menghasilkan dokumen .docx Word profesional agar siap diunduh pengguna.]${promptProcessorInstruction}`
      : `[MODE BELAJAR / PERFORMANCE COACH: Berperanlah sebagai tutor akademik Sokratik. Berikan framework pengerjaan terstruktur, tabel definisi token, dan ajukan beberapa pertanyaan pembimbing/langkah eksekusi agar pengguna bisa menyelesaikannya sendiri secara pintar. Jangan langsung memanggil tool GenerateWeLearnDocx.]${promptProcessorInstruction}`;

    const isInstant = chatMode === 'instant';
    await sendMessage(text, personality, img, systemHint, isInstant);
    fetchQuota();
  };

  // ─── Upload Gambar (Vision) ──────────────────────────────────────────────────
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showBanner('Ukuran gambar maksimal 5 MB ya Kak!', 'error');
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

  // ─── Upload Dokumen (RAG) ────────────────────────────────────────────────────
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showBanner('Ukuran file dokumen maksimal 10 MB ya Kak!', 'error');
      return;
    }

    setIsUploadingDoc(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await API.post('/ai/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      showBanner(res.data?.data?.message || 'Dokumen berhasil dipelajari oleh Asep!', 'success');
      
      // Tambahkan ke daftar dokumen terunggah di sidebar
      setUploadedDocs((prev) => [
        { name: file.name, date: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) },
        ...prev,
      ]);

      // Kirim trigger RAG sapaan instan
      await sendMessage(
        `[SISTEM] Saya baru saja sukses mengunggah dokumen kuliah "${file.name}". Asep, tolong pelajari isinya dan konfirmasikan bahwa kamu siap membantuku membahas materi ini!`,
        personality
      );
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Gagal mengunggah dokumen ke ingatan Asep.';
      showBanner(errMsg, 'error');
    } finally {
      setIsUploadingDoc(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  // Memoize messages list to avoid re-rendering heavy MarkdownRenderer on every keystroke
  const renderedMessages = useMemo(() => {
    return messages.map((msg, index) => {
      const isUser = msg.role === 'user';
      return (
        <div
          key={index}
          className={`flex flex-col max-w-[90%] md:max-w-[85%] min-w-0 ${isUser ? 'self-end' : 'self-start'} animate-fadeIn`}
        >
          {/* Nama Pengirim */}
          <span className={`text-[10px] font-extrabold text-black/40 mb-1 flex items-center gap-1 ${isUser ? 'self-end' : 'self-start'}`}>
            {!isUser && <Bot size={12} className="text-black/60 stroke-[2.5]" />}
            <span>{isUser ? 'Kamu' : `Asep`}</span>
          </span>

          {/* Balon Chat (UI/UX PRO-MAX: High-contrast text colors) */}
          <div
            className={`p-3 md:p-3.5 rounded-2xl font-body text-left leading-relaxed min-w-0 w-full break-words overflow-x-auto ${
              isUser
                ? 'bg-[#A7B3BF]/25 text-black border border-white/50 self-end shadow-sm'
                : 'glass-card self-start'
            }`}
          >
            {/* Tampilkan gambar jika ada di pesan user */}
            {isUser && msg.imageBase64 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={msg.imageBase64}
                alt="Gambar soal"
                className="max-h-40 rounded-xl border border-black/20 mb-2 object-contain"
              />
            )}
            {isUser ? (
              <p className="text-xs md:text-sm text-slate-900 font-extrabold">{msg.content}</p>
            ) : (
              <>
                <MarkdownRenderer content={msg.content} size="sm" />
                {msg.requires_api_key && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                      <Key className="w-4 h-4 text-amber-400" />
                      <span>Konfigurasi API Key Dibutuhkan</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      {msg.reason === 'key_invalid_or_quota'
                        ? 'API Key Anda saat ini bermasalah (kuota habis atau kedaluwarsa). Perbarui API Key di Pengaturan Profile.'
                        : 'Silakan daftarkan API Key pribadi Anda (Gemini, Groq, atau OpenRouter) untuk menikmati akses AI ASEP tanpa batas.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'profile' }));
                      }}
                      className="mt-1 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-400 text-slate-950 text-xs font-bold hover:bg-amber-300 transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>Buka Pengaturan API Key 🔑</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Waktu Pesan */}
          <span className={`text-[9px] font-semibold text-black/30 mt-1 ${isUser ? 'self-end' : 'self-start'}`}>
            {new Date(msg.timestamp).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      );
    });
  }, [messages]);

  return (
    <>
      {/* ── 1. Floating Toggle Button (UI/UX PRO-MAX: Juga berfungsi sebagai Drop Target drag WeLearn) ── */}
      <OnboardingTooltip
        hintId="asep-ai-chat"
        text="Seret tugas WeLearn ke sini untuk jawaban instan!"
        position="left"
        accentBg="bg-neoYellow"
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            const text = e.dataTransfer.getData('text/plain');
            if (text) {
              setInputValue(text);
              setChatMode('instant');
              setIsOpen(true);
            }
            setIsDragOver(false);
          }}
          className={`fixed bottom-20 right-3 md:bottom-20 md:right-6 min-w-[52px] min-h-[52px] w-14 h-14 md:w-16 md:h-16 hover:scale-105 active:scale-90 transition-all flex items-center justify-center cursor-pointer z-50 rounded-2xl ai-trigger-btn group focus-visible:ring-2 focus-visible:ring-neoBlue ${
            isDragOver
              ? 'bg-neoYellow border-3 border-black scale-125 shadow-[0_0_0_4px_rgba(255,222,77,0.4)] rotate-12'
              : 'bg-[#A2A88F]/20 glass-panel'
          }`}
          aria-label={isOpen ? 'Tutup Asep AI' : 'Buka Asep AI'}
          title={isDragOver ? 'Lepaskan untuk tanya Asep!' : 'Tanya Asep AI'}
        >
          {isDragOver ? (
            <div className="flex flex-col items-center gap-0.5">
              <Sparkles size={22} className="text-black stroke-[2.5] animate-bounce" />
              <span className="text-[8px] font-black text-black leading-none">DROP!</span>
            </div>
          ) : isOpen ? (
            <X size={26} className="text-black stroke-[3] group-hover:rotate-90 transition-transform duration-200" />
          ) : (
            <div className="relative">
              <Bot size={26} className="text-black stroke-[2.5]" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-neoMint border border-black rounded-full animate-ping" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-neoMint border border-black rounded-full" />
            </div>
          )}
        </button>
      </OnboardingTooltip>

      {/* ── 2. Chat Window Panel (UI/UX PRO-MAX: Fullscreen drawer on mobile, 300ms smooth transitions) ── */}
      {isOpen && (
        <div
          ref={chatWindowRef}
          className={`fixed inset-x-2 bottom-[84px] top-14 md:top-auto md:bottom-[152px] md:right-6 glass-panel z-[100000] flex rounded-2xl overflow-hidden origin-bottom-right transition-all duration-200 ${
            isExpanded
              ? 'w-[calc(100vw-20px)] md:w-[760px] lg:w-[840px] h-[calc(100vh-100px)] md:h-[720px]'
              : 'w-[calc(100vw-20px)] md:w-[580px] h-[calc(100vh-100px)] md:h-[660px]'
          } animate-in fade-in-0 zoom-in-95 duration-200`}
          style={{ transitionTimingFunction: 'var(--ease-out)' }}
        >
          {/* MAIN CHAT PANEL (Spacious & ProMax Layout) */}
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            
            {/* Header Panel */}
            <div className={`${currentPersonality.headerBg} border-b-3 border-black p-3.5 flex items-center justify-between shrink-0 transition-colors duration-300 shadow-[0_2px_8px_rgba(29,42,68,0.08)]`}>
              <div className="flex items-center gap-3">
                <div className="bg-white/50 border border-black/20 p-1.5 rounded-lg shadow-neo-sm overflow-hidden flex items-center justify-center">
                  <Bot size={20} className="text-black stroke-[2.5]" />
                </div>
                <div className="text-left">
                  <h3 className={`font-heading font-black text-sm ${currentPersonality.headerText} leading-none flex items-center gap-1.5`}>
                    Asep AI <span className="text-[9px] font-mono bg-black text-white px-1.5 py-0.5 rounded uppercase border border-black shadow-[1px_1px_0px_rgba(0,0,0,0.15)]">ProMax</span>
                  </h3>
                  <span className={`text-[10px] font-extrabold ${currentPersonality.headerText}/70 uppercase tracking-wider block mt-1`}>
                    Mode {currentPersonality.label} {quota && ` • Obrolan: ${quota.chatQuota.limit === -1 ? 'Tanpa Batas' : `${quota.chatQuota.used}/${quota.chatQuota.limit}`}`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Personality Selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowPersonalityMenu(!showPersonalityMenu)}
                    className="flex items-center gap-1.5 px-3 py-1.5 glass-btn rounded-lg text-[10px] font-bold cursor-pointer"
                    title="Ganti Mode Asep"
                  >
                    {currentPersonality.icon}
                    <span>{currentPersonality.label}</span>
                  </button>

                  {/* Dropdown Menu */}
                  {showPersonalityMenu && (
                    <div className="absolute right-0 top-full mt-1.5 w-52 glass-panel rounded-xl overflow-hidden z-10 animate-fadeIn">
                      {(Object.entries(PERSONALITY_CONFIG) as [Personality, typeof PERSONALITY_CONFIG[Personality]][]).map(([key, cfg]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => { setPersonality(key); setShowPersonalityMenu(false); }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/30 transition-colors cursor-pointer border-b border-white/20 last:border-b-0 ${personality === key ? 'bg-white/20' : ''}`}
                        >
                          <div className="bg-white/50 border border-white/30 p-1 rounded shrink-0">
                            {cfg.largeIcon}
                          </div>
                          <div>
                            <p className="text-xs font-black text-black">{cfg.label}</p>
                            <p className="text-[10px] text-gray-500">{cfg.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Widescreen Mode Toggle (Hanya tampil di desktop/layar lebar md+) */}
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="hidden md:flex p-1.5 glass-btn rounded-lg cursor-pointer items-center justify-center animate-fadeIn"
                  title={isExpanded ? 'Kembalikan Tampilan Standar' : 'Perluas Tampilan Obrolan'}
                >
                  {isExpanded ? <Minimize2 size={13} className="stroke-[2.5]" /> : <Maximize2 size={13} className="stroke-[2.5]" />}
                </button>

                <button
                  type="button"
                  onClick={clearChat}
                  className="p-1.5 glass-btn rounded-lg cursor-pointer flex items-center justify-center hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-500"
                  title="Hapus Obrolan"
                >
                  <Trash2 size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 glass-btn rounded-lg cursor-pointer flex items-center justify-center"
                  title="Tutup"
                >
                  <X size={13} className="stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Banner Notifikasi / Status (Neobrutalism Style) */}
            {banner && (
              <div className={`mx-4 mt-3 px-4 py-3 border border-white/40 rounded-xl flex items-center justify-between text-xs font-bold glass-panel animate-fadeIn z-10 ${
                banner.type === 'error' ? 'bg-red-50 text-red-900 border-red-200' :
                banner.type === 'success' ? 'bg-[#A2A88F]/20 text-black' : 'bg-[#E8C595]/20 text-black'
              }`}>
                <div className="flex items-center gap-2">
                  {banner.type === 'error' ? <X size={14} className="stroke-[3] text-red-900" /> : <Sparkles size={14} className="fill-current animate-pulse text-black" />}
                  <span>{banner.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setBanner(null)}
                  className="p-1 hover:bg-black/10 rounded cursor-pointer transition-colors"
                >
                  <X size={12} className="stroke-[2.5]" />
                </button>
              </div>
            )}

            {/* Messages Container (High-contrast, responsive text sizes) */}
            <div className={`flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-5 flex flex-col bg-gradient-to-b ${currentPersonality.gradient}`}>
              
              {/* Quick Prompts (Muncul hanya jika chat kosong) */}
              {messages.length <= 1 && (
                <div className="glass-card p-4 text-left space-y-3 animate-fadeIn my-auto max-w-[90%] mx-auto">
                  <h4 className="text-xs font-black text-black uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={14} className="text-[#E8C595] fill-[#E8C595]" /> Rekomendasi Prompt Asep
                  </h4>
                  <p className="text-[10px] font-bold text-black/60">
                    Klik prompt di bawah untuk memicu tindakan instan dari Asep AI:
                  </p>
                  <div className="flex flex-col gap-2 pt-1.5 text-[10px] font-extrabold">
                    <button 
                      type="button"
                      onClick={() => handleQuickPrompt("Tolong jadwalkan semua tugasku secara otomatis.")} 
                      className="glass-btn hover:bg-white/80 rounded-lg px-2.5 py-2 text-left shadow-sm hover:translate-y-[-1px] transition-all duration-200 cursor-pointer flex items-center gap-2 group/btn min-w-0"
                    >
                      <Zap size={14} className="text-black shrink-0 stroke-[2.5] group-hover/btn:animate-bounce" />
                      <span className="truncate">Rapikan jadwal tugas & belajar (Auto-Schedule)</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleQuickPrompt("Bagaimana ringkasan analisis burnout risk saya?")} 
                      className="glass-btn hover:bg-white/80 rounded-lg px-2.5 py-2 text-left shadow-sm hover:translate-y-[-1px] transition-all duration-200 cursor-pointer flex items-center gap-2 group/btn min-w-0"
                    >
                      <Brain size={14} className="text-black shrink-0 stroke-[2.5] group-hover/btn:animate-pulse" />
                      <span className="truncate">Periksa risiko stres & burnout (ML Burnout)</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleQuickPrompt("Buatkan tugas baru berjudul 'Praktikum ML', prioritas 4, estimasi 90 menit.")} 
                      className="glass-btn hover:bg-white/80 rounded-lg px-2.5 py-2 text-left shadow-sm hover:translate-y-[-1px] transition-all duration-200 cursor-pointer flex items-center gap-2 group/btn min-w-0"
                    >
                      <FileText size={14} className="text-black shrink-0 stroke-[2.5]" />
                      <span className="truncate">Daftarkan tugas baru 'Praktikum ML'</span>
                    </button>
                  </div>
                </div>
              )}

              {renderedMessages}

              {isChatQuotaExceeded && (
                <div className="bg-neoOrange text-black border-3 border-black p-4 rounded-2xl shadow-neo-sm text-left space-y-2 animate-fadeIn max-w-[95%] mx-auto my-3 shrink-0">
                  <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-black">
                    <Sparkles size={14} className="fill-black" /> Kuota Obrolan Habis!
                  </h4>
                  <p className="text-[10px] font-extrabold text-black/85 leading-relaxed">
                    Anda telah menggunakan seluruh **10 kuota obrolan harian** gratis Anda hari ini. Silakan hubungi admin di <span className="font-black">bagasa020@gmail.com</span> untuk peningkatan ke **Paket Pro** agar dapat mengakses Asep AI tanpa batas! 🚀
                  </p>
                </div>
              )}

              {/* Typing Indicator */}
              {isLoading && (
                <div className="flex flex-col max-w-[85%] self-start animate-fadeIn">
                  <span className="text-[10px] font-extrabold text-black/40 mb-1">
                    Asep sedang memikirkan jawaban...
                  </span>
                  <div className="flex gap-3 items-center px-4 py-2.5 glass-card min-w-[140px]">
                    <Bot size={20} className="text-black stroke-[2.5] animate-pulse" />
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

            {/* Form Input (High contrast placeholder text & cursors pointer) */}
            <form
              onSubmit={handleSend}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                const text = e.dataTransfer.getData('text/plain');
                if (text) {
                  setInputValue(text);
                  setChatMode('instant');
                }
                setIsDragOver(false);
              }}
              className={`p-3.5 bg-white/20 border-t border-white/30 flex flex-col gap-2 shrink-0 text-left relative transition-all ${
                isDragOver ? 'bg-amber-400/20 border-t-amber-400' : ''
              }`}
            >
              {/* Drop Overlay — muncul saat drag di atas form */}
              {isDragOver && (
                <div className="absolute inset-0 border-3 border-dashed border-amber-500 rounded-b-2xl flex items-center justify-center z-20 pointer-events-none bg-amber-50/60 backdrop-blur-sm">
                  <div className="glass-card px-5 py-3 text-center border-2 border-black shadow-neo-sm">
                    <Sparkles size={20} className="text-amber-600 mx-auto mb-1 animate-bounce" />
                    <p className="text-xs font-black text-black">Lepaskan untuk tanya Asep!</p>
                  </div>
                </div>
              )}
              {/* Preview gambar */}
              {imagePreview && (
                <ImagePreview src={imagePreview} onRemove={() => {
                  setImagePreview(null);
                  setImageBase64(null);
                }} />
              )}

              {/* Dual-Mode Selector (Belajar vs Jawaban Instan) */}
              <OnboardingTooltip
                hintId="answer-mode"
                text="Aktifkan ini untuk generate jawaban + file Word sekaligus!"
                position="top"
                accentBg="bg-neoYellow"
              >
                <div className="flex bg-[#FAF9F5]/90 border-2 border-black rounded-xl p-0.5 shadow-[2px_2px_0px_#000] mb-1 shrink-0 select-none w-full">
                  <button
                    type="button"
                    onClick={() => setChatMode('study')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-black rounded-lg border-2 transition-all cursor-pointer ${
                      chatMode === 'study'
                        ? 'bg-neoMint text-black border-black shadow-[1.5px_1.5px_0px_#000] -translate-y-0.5'
                        : 'bg-transparent text-black/55 border-transparent hover:text-black'
                    }`}
                  >
                    <BookOpen size={13} className="stroke-[2.5]" />
                    <span>Mode Belajar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChatMode('instant')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-black rounded-lg border-2 transition-all cursor-pointer ${
                      chatMode === 'instant'
                        ? 'bg-neoYellow text-black border-black shadow-[1.5px_1.5px_0px_#000] -translate-y-0.5'
                        : 'bg-transparent text-black/55 border-transparent hover:text-black'
                    }`}
                  >
                    <Sparkles size={13} className="stroke-[2.5]" />
                    <span>Jawaban Instan (.docx)</span>
                  </button>
                </div>
              </OnboardingTooltip>

              <div className="flex gap-2 items-center">
                {/* Tombol Upload Gambar (Vision AI) */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isChatQuotaExceeded}
                  className="w-10 h-10 glass-btn rounded-xl flex items-center justify-center cursor-pointer shrink-0 group disabled:opacity-40 disabled:pointer-events-none"
                  title="Upload gambar soal (Vision AI)"
                >
                  <ImageIcon size={16} className="text-black group-hover:text-white stroke-[2.5]" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleImageUpload}
                  className="hidden"
                />

                {/* Tombol Upload Dokumen (RAG) */}
                <button
                  type="button"
                  onClick={() => docInputRef.current?.click()}
                  disabled={isUploadingDoc || isChatQuotaExceeded}
                  className="w-10 h-10 glass-btn rounded-xl flex items-center justify-center cursor-pointer shrink-0 group disabled:opacity-40 disabled:pointer-events-none"
                  title="Unggah berkas kuliah PDF/TXT (RAG Study Assistant)"
                >
                  {isUploadingDoc ? (
                    <Loader size={16} className="text-black animate-spin stroke-[2.5]" />
                  ) : (
                    <Paperclip size={16} className="text-black stroke-[2.5]" />
                  )}
                </button>
                <input
                  ref={docInputRef}
                  type="file"
                  accept=".pdf,.txt"
                  onChange={handleDocUpload}
                  className="hidden"
                />

                {/* Input Teks (UI/UX PRO-MAX: High-contrast slate text & black/50 placeholder) */}
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={
                    isChatQuotaExceeded 
                      ? 'Kuota obrolan harian Anda sudah habis...' 
                      : chatMode === 'instant' 
                        ? 'Minta langsung jawaban lengkap .docx...' 
                        : currentPersonality.placeholder
                  }
                  disabled={isLoading || isChatQuotaExceeded}
                  className="flex-1 px-4 py-2.5 glass-input rounded-xl font-body text-sm outline-none placeholder:text-black/45 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />

                {/* Tombol Kirim / Hentikan */}
                {isLoading ? (
                  <button
                    type="button"
                    onClick={stopRequest}
                    className="w-10 h-10 bg-red-500 hover:bg-red-600 border-2 border-black rounded-xl flex items-center justify-center cursor-pointer shrink-0 transition-colors shadow-[2px_2px_0px_#000] active:translate-y-0.5 active:shadow-[1px_1px_0px_#000]"
                    title="Hentikan pencarian jika salah kirim"
                  >
                    <span className="w-3.5 h-3.5 bg-white rounded-sm animate-pulse" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={(!inputValue.trim() && !imageBase64) || isChatQuotaExceeded}
                    className="w-10 h-10 glass-btn rounded-xl flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:pointer-events-none shrink-0"
                  >
                    <Send size={16} className="text-black stroke-[2.5]" />
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
});

export default AIChatWidget;
