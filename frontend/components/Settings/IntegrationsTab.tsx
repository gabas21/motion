import React, { useState, useEffect } from 'react';
import { Calendar, RefreshCw, Trash2, CheckCircle, Plus, Sparkles, Loader, Send, ExternalLink, FileText } from 'lucide-react';
import { CalendarConnection } from '../../hooks/useCalendar';
import API from '../../lib/api';
import MoodleTab from './MoodleTab';

interface IntegrationsTabProps {
  connections: CalendarConnection[];
  isLoading: boolean;
  onConnect: (type: string, code: string) => Promise<boolean>;
  onSync: () => Promise<boolean>;
  onDisconnect: (id: string) => Promise<boolean>;
  onNavigateToExcuseLetter?: () => void;
}

export default function IntegrationsTab({
  connections,
  isLoading,
  onConnect,
  onSync,
  onDisconnect,
  onNavigateToExcuseLetter,
}: IntegrationsTabProps) {
  const isGoogleConnected = connections.some((c) => c.calendarType === 'google');
  const isMockConnected = connections.some((c) => c.calendarType === 'mock');

  // Telegram Integration States
  const [isTelegramLinked, setIsTelegramLinked] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState('');
  const [isTelegramLoading, setIsTelegramLoading] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState<string | null>(null);
  const [telegramError, setTelegramError] = useState<string | null>(null);

  const fetchTelegramStatus = async () => {
    try {
      const response = await API.get('/auth/telegram/status');
      if (response.data?.success) {
        const { isTelegramLinked, telegramChatId } = response.data.data;
        setIsTelegramLinked(isTelegramLinked);
        setTelegramChatId(telegramChatId || '');
        if (isTelegramLinked) {
          setOtpCode(''); // Clear OTP on successful connection
        }
      }
    } catch (err) {
      console.error('Failed to fetch Telegram status:', err);
    }
  };

  useEffect(() => {
    fetchTelegramStatus();
  }, []);

  // Polling Telegram Status if OTP is active to auto-refresh UI
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (otpCode && !isTelegramLinked) {
      interval = setInterval(fetchTelegramStatus, 4000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [otpCode, isTelegramLinked]);

  const handleGenerateTelegramOTP = async () => {
    setIsTelegramLoading(true);
    setTelegramError(null);
    try {
      const response = await API.post('/auth/telegram/otp');
      if (response.data?.success) {
        const { otp, expiresAt } = response.data.data;
        setOtpCode(otp);
        setOtpExpiresAt(expiresAt);
      }
    } catch (err: any) {
      setTelegramError(err.response?.data?.error || 'Gagal menghasilkan kode OTP.');
    } finally {
      setIsTelegramLoading(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!confirm('Apakah Anda yakin ingin memutuskan hubungan dengan Telegram Bot?')) return;
    setIsTelegramLoading(true);
    setTelegramError(null);
    try {
      const response = await API.post('/auth/telegram/unlink');
      if (response.data?.success) {
        setIsTelegramLinked(false);
        setTelegramChatId('');
        setOtpCode('');
        setOtpExpiresAt(null);
      }
    } catch (err: any) {
      setTelegramError(err.response?.data?.error || 'Gagal memutuskan hubungan.');
    } finally {
      setIsTelegramLoading(false);
    }
  };

  const handleConnectMock = async () => {
    // Generate a simulated mock oauth code
    await onConnect('mock', 'mock_sandbox_code_' + Math.random().toString(36).substring(7));
  };

  const handleConnectGoogleReal = () => {
    // Redirect to simulated Google OAuth screen or redirect directly to callback
    // For pure seamless mock testing in sandbox local dev:
    const redirectUri = encodeURIComponent(window.location.origin + '/auth/oauth-callback');
    window.location.href = `/auth/oauth-callback?code=mock_google_oauth_code_${Math.random().toString(36).substring(7)}`;
  };

  return (
    <div className="space-y-6">
      {/* Overview Intro (Neobrutalism Card) */}
      <div className="bg-white border-3 border-black shadow-neo rounded-2xl p-6 text-left">
        <h3 className="text-lg font-black text-black mb-2 flex items-center gap-2 border-b-2 border-black pb-3">
          <Calendar className="w-5.5 h-5.5 text-black shrink-0" /> Integrasi Asisten Jadwal & Kalender
        </h3>
        <p className="text-sm font-semibold text-black/80 leading-relaxed mt-2">
          Hubungkan kalender eksternal dan asisten chat Anda dengan Motion AI. Mesin AI kami secara dinamis memantau agenda Anda secara real-time, mengalokasikan slot kerja fokus, dan memindahkan jadwal tugas secara otomatis agar terhindar dari bentrokan.
        </p>
      </div>

      {/* Available Connections Cards (Neobrutalism Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Google Calendar Card */}
        <div className="bg-white border-3 border-black shadow-neo rounded-2xl p-6 flex flex-col justify-between text-left hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm transition-all relative overflow-hidden">
          
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div className="w-12 h-12 rounded-xl bg-neoBlue border-2 border-black flex items-center justify-center font-black text-xl text-black shadow-neo-sm transform -rotate-3">
                G
              </div>
              {isGoogleConnected ? (
                <span className="neo-badge bg-neoBlue text-black text-[9px] px-2.5 py-0.5 shadow-neo-sm uppercase font-black">
                  Connected
                </span>
              ) : (
                <span className="neo-badge bg-neoCream text-black text-[9px] px-2.5 py-0.5 shadow-neo-sm uppercase font-black">
                  Tersedia
                </span>
              )}
            </div>
            <div>
              <h4 className="text-base font-black text-black">Google Calendar</h4>
              <p className="text-xs font-semibold text-black/70 mt-1 leading-normal">
                Sinkronisasikan rapat eksternal, jadwal pribadi, dan agenda kantor secara otomatis.
              </p>
            </div>
          </div>

          <div className="pt-6 mt-auto">
            {isGoogleConnected ? (
              <div className="flex gap-2">
                <button
                  onClick={onSync}
                  disabled={isLoading}
                  className="flex-1 neo-btn bg-white text-black rounded-xl py-2 px-3 text-xs font-bold shadow-neo-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Sinkronkan
                </button>
                <button
                  onClick={() => {
                    const conn = connections.find((c) => c.calendarType === 'google');
                    if (conn) onDisconnect(conn.id);
                  }}
                  disabled={isLoading}
                  className="neo-btn bg-neoOrange text-white rounded-xl p-2 shadow-neo-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none cursor-pointer"
                  title="Putuskan Hubungan"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectGoogleReal}
                disabled={isLoading}
                className="w-full neo-btn bg-neoBlue text-black rounded-xl py-2.5 text-xs font-bold shadow-neo hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm active:translate-x-[3px] active:translate-y-[3px] active:shadow-none flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-black shrink-0" /> Hubungkan Google Calendar
              </button>
            )}
          </div>
        </div>

        {/* Telegram Bot Card */}
        <div className="bg-white border-3 border-black shadow-neo rounded-2xl p-6 flex flex-col justify-between text-left hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm transition-all relative overflow-hidden">
          
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div className="w-12 h-12 rounded-xl bg-[#24A1DE] border-2 border-black flex items-center justify-center text-white shadow-neo-sm transform -rotate-3 shrink-0">
                <Send className="w-5.5 h-5.5 text-white shrink-0 fill-current" />
              </div>
              {isTelegramLinked ? (
                <span className="neo-badge bg-neoMint text-black text-[9px] px-2.5 py-0.5 shadow-neo-sm uppercase font-black">
                  Terhubung
                </span>
              ) : (
                <span className="neo-badge bg-neoCream text-black text-[9px] px-2.5 py-0.5 shadow-neo-sm uppercase font-black">
                  Tersedia
                </span>
              )}
            </div>
            
            <div>
              <h4 className="text-base font-black text-black">Telegram Bot</h4>
              <p className="text-xs font-semibold text-black/70 mt-1 leading-normal">
                Catat tugas dan kelola jadwal harian Anda langsung dari HP melalui formulir chat bot interaktif.
              </p>
            </div>

            {/* OTP Display / Status details */}
            {otpCode && !isTelegramLinked && (
              <div className="mt-3 bg-neoYellow/20 border-2 border-dashed border-black rounded-xl p-3 space-y-2.5 text-left">
                <div className="text-[10px] font-black uppercase text-black/60 tracking-wider">Kode OTP Sinkronisasi:</div>
                <div className="bg-neoYellow border-2 border-black font-black text-2xl tracking-widest text-center py-1.5 rounded-lg shadow-neo-sm text-black">
                  {otpCode}
                </div>
                <p className="text-[10px] font-bold text-black/85 leading-normal">
                  Silakan buka chat Telegram Anda dan klik tautan ini:<br/>
                  <a 
                    href={`https://t.me/Agasita_bot?start=${otpCode}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline text-black font-black inline-flex items-center gap-0.5 hover:text-black/75"
                  >
                    t.me/Agasita_bot <ExternalLink className="w-2.5 h-2.5" />
                  </a><br/>
                  atau kirim chat pesan:<br/>
                  <code className="bg-black/10 px-1 py-0.5 rounded font-mono font-bold text-black text-[9px]">/sync {otpCode}</code>
                </p>
                <div className="text-[9px] text-black/50 font-semibold italic leading-snug">
                  *UI web ini akan otomatis berubah menjadi terhubung setelah sinkronisasi sukses di bot HP Anda!
                </div>
              </div>
            )}

            {isTelegramLinked && (
              <div className="mt-3 bg-neoMint/10 border-2 border-dashed border-black rounded-xl p-3 text-left">
                <div className="text-[10px] font-black uppercase text-black/60 tracking-wider">Koneksi Telegram Aktif:</div>
                <div className="font-mono text-xs font-black text-black mt-1 bg-black/5 px-2 py-1 rounded border border-black/10">
                  Chat ID: {telegramChatId}
                </div>
                <p className="text-[10px] font-bold text-black/70 mt-2.5 leading-relaxed">
                  🚀 Bot asisten siap! Cukup tekan tombol menu **➕ Tambah Tugas** di chat Telegram HP Anda untuk mulai mencatat secara interaktif.
                </p>
              </div>
            )}

            {telegramError && (
              <div className="text-xs font-bold text-neoOrange mt-2">
                ⚠️ {telegramError}
              </div>
            )}
          </div>

          <div className="pt-6 mt-auto">
            {isTelegramLinked ? (
              <button
                onClick={handleUnlinkTelegram}
                disabled={isTelegramLoading}
                className="w-full neo-btn bg-neoOrange text-white border-2 border-black rounded-xl py-2 px-3 text-xs font-bold shadow-neo-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isTelegramLoading ? (
                  <Loader className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 text-white" />
                )}
                Putuskan Hubungan Telegram
              </button>
            ) : (
              <button
                onClick={handleGenerateTelegramOTP}
                disabled={isTelegramLoading}
                className="w-full neo-btn bg-[#24A1DE] text-white border-2 border-black rounded-xl py-2.5 text-xs font-bold shadow-neo hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm active:translate-x-[3px] active:translate-y-[3px] active:shadow-none flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isTelegramLoading ? (
                  <Loader className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Send className="w-4 h-4 text-white shrink-0 fill-current" />
                )}
                {otpCode ? 'Hasilkan Kode Baru' : 'Hubungkan Telegram Bot'}
              </button>
            )}
          </div>
        </div>

        {/* Sandbox Mock Calendar (Developer simulator) */}
        <div className="bg-white border-3 border-black shadow-neo rounded-2xl p-6 flex flex-col justify-between text-left hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm transition-all relative overflow-hidden">
          
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div className="w-12 h-12 rounded-xl bg-neoViolet border-2 border-black flex items-center justify-center text-black shadow-neo-sm transform rotate-3 shrink-0">
                <Sparkles className="w-5.5 h-5.5 text-black shrink-0" />
              </div>
              {isMockConnected ? (
                <span className="neo-badge bg-neoViolet text-black text-[9px] px-2.5 py-0.5 shadow-neo-sm uppercase font-black">
                  Live Demo
                </span>
              ) : (
                <span className="neo-badge bg-neoCream text-black text-[9px] px-2.5 py-0.5 shadow-neo-sm uppercase font-black">
                  Simulator
                </span>
              )}
            </div>
            <div>
              <h4 className="text-base font-black text-black">Sandbox Simulator Calendar</h4>
              <p className="text-xs font-semibold text-black/70 mt-1 leading-normal">
                **Koneksi Instan Tanpa Akun!** Tanam kalender tiruan berisi 10 jadwal rapat harian otomatis untuk kebutuhan pengujian AI.
              </p>
            </div>
          </div>

          <div className="pt-6 mt-auto">
            {isMockConnected ? (
              <div className="flex gap-2">
                <button
                  onClick={onSync}
                  disabled={isLoading}
                  className="flex-1 neo-btn bg-white text-black rounded-xl py-2 px-3 text-xs font-bold shadow-neo-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Sinkronkan
                </button>
                <button
                  onClick={() => {
                    const conn = connections.find((c) => c.calendarType === 'mock');
                    if (conn) onDisconnect(conn.id);
                  }}
                  disabled={isLoading}
                  className="neo-btn bg-neoOrange text-white rounded-xl p-2 shadow-neo-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none cursor-pointer"
                  title="Putuskan Hubungan Sandbox"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectMock}
                disabled={isLoading}
                className="w-full neo-btn bg-neoViolet text-black rounded-xl py-2.5 text-xs font-bold shadow-neo hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm active:translate-x-[3px] active:translate-y-[3px] active:shadow-none flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin text-black" /> Membangun Sandbox...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-black shrink-0" /> Tanam Sandbox Mock Calendar
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Surat Izin Praktikum Card */}
        <div className="bg-white border-3 border-black shadow-neo rounded-2xl p-6 flex flex-col justify-between text-left hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm transition-all relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div className="w-12 h-12 rounded-xl bg-neoMint border-2 border-black flex items-center justify-center text-black shadow-neo-sm transform -rotate-3 shrink-0">
                <FileText className="w-5.5 h-5.5 text-black shrink-0" />
              </div>
              <span className="neo-badge bg-neoMint text-black text-[9px] px-2.5 py-0.5 shadow-neo-sm uppercase font-black">
                Fitur Baru
              </span>
            </div>
            <div>
              <h4 className="text-base font-black text-black">Surat Izin Praktikum</h4>
              <p className="text-xs font-semibold text-black/70 mt-1 leading-normal">
                Generate berkas PDF izin praktikum resmi WICIDA dengan tanda tangan coretan tangan Canvas Anda.
              </p>
            </div>
          </div>
          <div className="pt-6 mt-auto">
            <button
              onClick={onNavigateToExcuseLetter}
              className="w-full neo-btn bg-neoYellow text-black border-2 border-black rounded-xl py-2.5 text-xs font-bold shadow-neo hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm active:translate-x-[3px] active:translate-y-[3px] active:shadow-none flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-black shrink-0" /> Buka Pembuat Surat Izin
            </button>
          </div>
        </div>

      </div>

      {/* Active Connections Meta Tables (Neobrutalism Card) */}
      {connections.length > 0 && (
        <div className="bg-white border-3 border-black shadow-neo rounded-2xl p-6 text-left">
          <h4 className="text-sm font-black text-black mb-4 uppercase tracking-wider border-b-2 border-black pb-2">Status Kalender Terhubung</h4>
          <div className="space-y-4">
            {connections.map((conn) => (
              <div key={conn.id} className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-black/10 pb-4 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-neoYellow border border-black flex items-center justify-center font-black text-xs text-black shadow-neo-sm">
                    {conn.calendarType === 'google' ? 'G' : 'M'}
                  </div>
                  <div>
                    <span className="text-xs font-black text-black block leading-none">{conn.calendarName}</span>
                    <span className="text-[10px] font-bold text-black/50 block mt-1">ID: {conn.calendarId}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[10px] text-black font-extrabold block">
                      Sinkronisasi Terakhir: {conn.lastSyncedAt ? new Date(conn.lastSyncedAt).toLocaleString('id-ID') : 'Belum Pernah'}
                    </span>
                    <span className="text-[9px] text-black font-black flex items-center justify-end gap-1 mt-1 bg-neoMint border border-black px-2 py-0.5 rounded shadow-neo-sm">
                      <CheckCircle className="w-3.5 h-3.5" /> Auto-Sync Aktif
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Integrasi LMS Kampus (WeLearn Moodle) */}
      <div className="mt-8">
        <h4 className="text-sm font-black text-black mb-4 uppercase tracking-wider border-b-2 border-black pb-2 flex items-center gap-2">
          <Send className="w-4 h-4 text-black shrink-0 fill-current" /> Integrasi LMS Kampus (Moodle WeLearn)
        </h4>
        <MoodleTab />
      </div>
    </div>
  );
}
