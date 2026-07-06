import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, 
  Mail, 
  Globe, 
  Shield, 
  Sparkles, 
  Loader, 
  CheckCircle, 
  ShieldAlert, 
  Award, 
  Key, 
  Calendar, 
  Clock, 
  Link2, 
  Eye, 
  EyeOff, 
  ArrowUpRight,
  Settings2,
  LayoutDashboard,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useCalendar } from '../../hooks/useCalendar';
import { useMoodle } from '../../hooks/useMoodle';
import { useAIConfig } from '../../hooks/useAIConfig';
import { toast } from '../../hooks/useToast';
import CustomSelect from '../ui/CustomSelect';

export default function ProfileTab() {
  const { user, updateProfile, isLoading, error: authError, clearError } = useAuth();
  const { connections, fetchConnections } = useCalendar();
  const { status: moodleStatus, fetchStatus: fetchMoodleStatus } = useMoodle();
  const { 
    status: aiConfigStatus, 
    isLoading: aiConfigLoading, 
    error: aiConfigError, 
    successMessage: aiConfigSuccess, 
    fetchStatus: fetchAIStatus, 
    saveKeys, 
    clearError: clearAIConfigError, 
    clearSuccessMessage: clearAIConfigSuccess 
  } = useAIConfig();
  
  // State form profil
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  
  // State form ganti password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  
  // State password visibility toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // State UI
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);

  // State form API AI Keys
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [openRouterKey, setOpenRouterKey] = useState('');

  const [showGemini, setShowGemini] = useState(false);
  const [showGroq, setShowGroq] = useState(false);
  const [showOpenRouter, setShowOpenRouter] = useState(false);
  
  // Interactive Avatar Background Color
  const [avatarBg, setAvatarBg] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('profile_avatar_bg') || 'bg-neoMint';
    }
    return 'bg-neoMint';
  });

  // Ticking local clock for user's timezone
  const [currentTime, setCurrentTime] = useState('');

  // Load user data & external stats
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setTimezone(user.timezone || 'UTC');
    }
    fetchConnections();
    fetchMoodleStatus();
    fetchAIStatus();
  }, [user, fetchConnections, fetchMoodleStatus, fetchAIStatus]);

  // Clock effect
  useEffect(() => {
    const updateClock = () => {
      try {
        const formatter = new Intl.DateTimeFormat('id-ID', {
          timeZone: timezone,
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        setCurrentTime(formatter.format(new Date()));
      } catch (e) {
        const formatter = new Intl.DateTimeFormat('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        setCurrentTime(formatter.format(new Date()));
      }
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [timezone]);

  // Clean errors on mount/unmount
  useEffect(() => {
    clearError();
    return () => clearError();
  }, [clearError]);

  const handleAvatarBgChange = (colorClass: string) => {
    setAvatarBg(colorClass);
    localStorage.setItem('profile_avatar_bg', colorClass);
    toast.success('Warna tema avatar diperbarui!');
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setFormError(null);
    clearError();

    if (!name.trim()) {
      setFormError('Nama lengkap tidak boleh kosong');
      return;
    }

    const payload: { name: string; timezone: string } = {
      name: name.trim(),
      timezone
    };

    const ok = await updateProfile(payload);
    if (ok) {
      setSuccessMsg('Profil Anda berhasil diperbarui!');
      toast.success('Profil berhasil diperbarui!');
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setFormError(null);
    clearError();

    if (!currentPassword) {
      setFormError('Kata sandi saat ini harus diisi');
      return;
    }
    if (newPassword.length < 6) {
      setFormError('Kata sandi baru minimal harus 6 karakter');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setFormError('Konfirmasi kata sandi baru tidak cocok');
      return;
    }

    const ok = await updateProfile({
      name: user?.name || '',
      timezone: user?.timezone || 'UTC',
      currentPassword,
      newPassword
    });

    if (ok) {
      setSuccessMsg('Kata sandi Anda berhasil diperbarui!');
      toast.success('Kata sandi berhasil diubah!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const handleUpgradePlan = async () => {
    setSuccessMsg(null);
    setFormError(null);
    clearError();
    setIsUpgrading(true);

    const isCurrentlyPremium = user?.plan === 'premium';
    const nextPlan = isCurrentlyPremium ? 'free' : 'premium';

    const ok = await updateProfile({
      name: user?.name || '',
      timezone: user?.timezone || 'UTC',
      plan: nextPlan
    });

    setIsUpgrading(false);
    if (ok) {
      const msg = nextPlan === 'premium' 
        ? 'Selamat! Akun Anda berhasil ditingkatkan ke paket premium AI Pro Rider! 🚀' 
        : 'Akun Anda telah dikembalikan ke paket gratis.';
      setSuccessMsg(msg);
      toast.success(nextPlan === 'premium' ? 'Plan ditingkatkan ke Premium!' : 'Plan dikembalikan ke Free.');
      setTimeout(() => setSuccessMsg(null), 5000);
    }
  };

  const handleSaveAIKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAIConfigError();
    clearAIConfigSuccess();

    const payload: { gemini_key?: string; groq_key?: string; openrouter_key?: string } = {};
    if (geminiKey.trim() !== '') payload.gemini_key = geminiKey.trim();
    if (groqKey.trim() !== '') payload.groq_key = groqKey.trim();
    if (openRouterKey.trim() !== '') payload.openrouter_key = openRouterKey.trim();

    if (Object.keys(payload).length === 0) {
      toast.error('Masukkan setidaknya satu API Key untuk disimpan');
      return;
    }

    const ok = await saveKeys(payload);
    if (ok) {
      setGeminiKey('');
      setGroqKey('');
      setOpenRouterKey('');
      toast.success('Konfigurasi API Key berhasil disimpan!');
    }
  };

  const handleClearKey = async (provider: 'gemini' | 'groq' | 'openrouter') => {
    clearAIConfigError();
    clearAIConfigSuccess();
    
    const payload: { gemini_key?: string; groq_key?: string; openrouter_key?: string } = {};
    if (provider === 'gemini') payload.gemini_key = "";
    if (provider === 'groq') payload.groq_key = "";
    if (provider === 'openrouter') payload.openrouter_key = "";

    const ok = await saveKeys(payload);
    if (ok) {
      toast.success(`API Key ${provider} berhasil dihapus.`);
    }
  };

  const timezoneOptions = [
    { value: 'Asia/Jakarta', label: 'Asia/Jakarta (WIB - UTC+7)' },
    { value: 'Asia/Makassar', label: 'Asia/Makassar (WITA - UTC+8)' },
    { value: 'Asia/Jayapura', label: 'Asia/Jayapura (WIT - UTC+9)' },
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST - UTC+9)' },
    { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
    { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
  ];

  const getInitials = (fullName: string) => {
    if (!fullName) return 'M';
    const parts = fullName.split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  const activeConnectionsCount = connections ? connections.filter(c => c.isActive).length : 0;

  return (
    <div className="space-y-8 text-left max-w-4xl mx-auto">
      
      {/* SECTION 1: HEADER & BANNER IDENTITAS */}
      <div className="bg-white border-3 border-black shadow-neo rounded-3xl p-6 relative overflow-hidden transition-all duration-200 hover:shadow-[6px_6px_0px_#1D2A44] hover:-translate-y-0.5">
        <div className="absolute right-4 -top-8 opacity-5 animate-float pointer-events-none">
          <UserIcon size={240} className="text-black" />
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-6 pb-6 border-b-3 border-dashed border-black/25">
          {/* Avatar Interaktif Customizer */}
          <div className="relative group">
            <div className={`w-24 h-24 rounded-2xl ${avatarBg} border-3 border-black flex items-center justify-center shadow-neo text-black font-mono text-3.5xl font-black tracking-wider transition-all duration-300 transform group-hover:rotate-3`}>
              {getInitials(name)}
            </div>
            
            {/* Color Swatch Panel */}
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white border-2 border-black rounded-full px-2 py-1 flex items-center gap-1 shadow-neo-sm">
              <button 
                type="button" 
                onClick={() => handleAvatarBgChange('bg-neoMint')} 
                className="w-3 h-3 rounded-full bg-neoMint border border-black cursor-pointer hover:scale-125 transition-transform" 
                title="Mint theme"
              />
              <button 
                type="button" 
                onClick={() => handleAvatarBgChange('bg-neoYellow')} 
                className="w-3 h-3 rounded-full bg-neoYellow border border-black cursor-pointer hover:scale-125 transition-transform" 
                title="Amber theme"
              />
              <button 
                type="button" 
                onClick={() => handleAvatarBgChange('bg-neoPink')} 
                className="w-3 h-3 rounded-full bg-neoPink border border-black cursor-pointer hover:scale-125 transition-transform" 
                title="Pink theme"
              />
              <button 
                type="button" 
                onClick={() => handleAvatarBgChange('bg-neoViolet')} 
                className="w-3 h-3 rounded-full bg-neoViolet border border-black cursor-pointer hover:scale-125 transition-transform" 
                title="Purple theme"
              />
            </div>
          </div>

          <div className="flex-1 text-center md:text-left space-y-2">
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <h2 className="text-2xl font-black text-black tracking-tight">{name || 'Pengguna Motion'}</h2>
              <span className={`px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md border border-black shadow-neo-sm ${
                user?.plan === 'premium' ? 'bg-neoOrange text-white' : 'bg-white text-black'
              }`}>
                {user?.plan === 'premium' ? 'AI Pro Rider' : 'Free Tier'}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 text-xs text-black/60 font-bold justify-center md:justify-start">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-black/50" /> {user?.email}
              </span>
              <span className="hidden sm:inline text-black/35">•</span>
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-black/50" /> {timezone}
              </span>
            </div>
          </div>
        </div>

        {/* BENTO STATS SYSTEM */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="bg-neoCream/35 border-2 border-black rounded-2xl p-4 shadow-neo-sm flex items-center gap-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-neo cursor-default">
            <div className="w-10 h-10 rounded-xl bg-neoMint border-2 border-black flex items-center justify-center shadow-neo-sm shrink-0">
              <Calendar className="w-5 h-5 text-black" />
            </div>
            <div>
              <span className="text-[9px] text-black/55 font-bold uppercase block tracking-wider">Kalender Sinkron</span>
              <span className="text-sm font-black text-black block">{activeConnectionsCount} Terhubung</span>
            </div>
          </div>

          <div className="bg-neoCream/35 border-2 border-black rounded-2xl p-4 shadow-neo-sm flex items-center gap-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-neo cursor-default">
            <div className="w-10 h-10 rounded-xl bg-neoViolet border-2 border-black flex items-center justify-center shadow-neo-sm shrink-0">
              <Link2 className="w-5 h-5 text-black" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] text-black/55 font-bold uppercase block tracking-wider">Status WeLearn</span>
              <span className="text-sm font-black text-black block truncate">
                {moodleStatus?.isConnected ? moodleStatus.moodleUsername : 'Belum Terhubung'}
              </span>
            </div>
          </div>

          <div className="bg-neoCream/35 border-2 border-black rounded-2xl p-4 shadow-neo-sm flex items-center gap-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-neo cursor-default">
            <div className="w-10 h-10 rounded-xl bg-neoYellow border-2 border-black flex items-center justify-center shadow-neo-sm shrink-0">
              <Clock className="w-5 h-5 text-black" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] text-black/55 font-bold uppercase block tracking-wider">Waktu Lokal AI</span>
              <span className="text-xs font-mono font-black text-black block truncate">{currentTime || 'Memuat...'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ADMIN PANEL BUTTON — Hanya tampil untuk role admin */}
      {user?.role === 'admin' && (
        <div className="bg-[#121214] border-3 border-black shadow-neo rounded-3xl p-6 relative overflow-hidden transition-all duration-200 hover:shadow-[6px_6px_0px_#FBBF24] hover:-translate-y-0.5">
          {/* Background glow */}
          <div className="absolute right-4 top-4 w-24 h-24 bg-neoYellow/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-neoYellow border-2 border-black flex items-center justify-center shadow-neo shrink-0">
                <Shield className="w-6 h-6 text-black" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-base font-black text-white uppercase tracking-wider">Admin Portal</h3>
                  <span className="px-2 py-0.5 bg-neoYellow text-black text-[9px] font-black uppercase tracking-wider rounded-md border border-black shadow-neo-sm">SUPER ADMIN</span>
                </div>
                <p className="text-xs text-white/50 font-bold leading-relaxed">
                  Pantau seluruh pengguna, statistik sistem, dan log aktivitas dari panel kontrol eksklusif.
                </p>
              </div>
            </div>

            <a
              href="/admin/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 px-5 py-3 bg-neoYellow text-black font-black text-xs uppercase tracking-wider border-2 border-black rounded-xl shadow-neo hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all duration-150 shrink-0 cursor-pointer group"
            >
              <LayoutDashboard className="w-4 h-4" />
              Buka Admin Panel
              <ExternalLink className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
            </a>
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-white/10">
            <div className="text-center">
              <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider block">Dashboard</span>
              <span className="text-xs font-black text-neoYellow">/admin/dashboard</span>
            </div>
            <div className="text-center">
              <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider block">Pengguna</span>
              <span className="text-xs font-black text-neoYellow">/admin/users</span>
            </div>
            <div className="text-center">
              <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider block">Aktivitas</span>
              <span className="text-xs font-black text-neoYellow">/admin/activity</span>
            </div>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="bg-neoMint border-3 border-black text-black text-xs font-black rounded-xl p-4 flex items-center gap-2.5 shadow-neo animate-fadeIn">
          <CheckCircle className="w-5 h-5 shrink-0 text-black" />
          <span>{successMsg}</span>
        </div>
      )}

      {(formError || authError) && (
        <div className="bg-neoOrange border-3 border-black text-white text-xs font-black rounded-xl p-4 flex items-center gap-2.5 shadow-neo animate-fadeIn">
          <ShieldAlert className="w-5 h-5 shrink-0 text-white" />
          <span>{formError || authError}</span>
        </div>
      )}

      {/* SECTION 2: SUBSCRIPTION / PREMIUM ACCOUNT BOX */}
      <div className="bg-white border-3 border-black shadow-neo rounded-3xl p-6 relative overflow-hidden transition-all duration-200 hover:shadow-[6px_6px_0px_#1D2A44] hover:-translate-y-0.5">
        <div className="absolute right-0 top-0 w-32 h-32 bg-neoYellow/15 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 flex-1">
            <h3 className="text-md font-black text-black uppercase tracking-wider flex items-center gap-2">
              <Award className="w-5 h-5 text-neoOrange" /> Paket Langganan Premium
            </h3>
            <p className="text-xs text-black/60 font-bold leading-relaxed max-w-xl">
              Tingkatkan akun Anda ke paket Premium AI Pro Rider untuk membuka asisten Asep AI tanpa batasan limitasi pesan harian, menjadwalkan ulang seluruh agenda secara instan, serta sinkronisasi otomatis multi-platform.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-neoMint/20 border border-black rounded-full text-[10px] font-black text-black shadow-neo-sm">
                <Sparkles className="w-3 h-3" /> Kuota Pesan Tanpa Batas
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-neoViolet/20 border border-black rounded-full text-[10px] font-black text-black shadow-neo-sm">
                <Sparkles className="w-3 h-3" /> Auto-Scheduling Prioritas
              </span>
            </div>
          </div>

          <div className="border-t-3 lg:border-t-0 lg:border-l-3 border-dashed border-black/25 pt-6 lg:pt-0 lg:pl-8 flex flex-col items-center justify-center shrink-0 w-full lg:w-64 text-center">
            <div className="mb-3">
              <span className="text-[10px] font-black text-black/55 uppercase tracking-wider block">Harga Bulanan</span>
              <span className="text-2xl font-black text-black tracking-tight font-mono">IDR 0<span className="text-xs font-bold text-black/50">/selamanya</span></span>
            </div>
            
            <button
              type="button"
              onClick={handleUpgradePlan}
              disabled={isUpgrading || isLoading}
              className={`w-full text-xs font-black uppercase py-3 border-2 border-black rounded-xl shadow-neo transition-all cursor-pointer hover:-translate-y-0.5 hover:translate-x-0.5 hover:shadow-neo-sm active:translate-y-0.5 active:translate-x-0.5 active:shadow-none flex items-center justify-center gap-2 ${
                user?.plan === 'premium' 
                  ? 'bg-neoOrange text-white hover:bg-neoOrange/95' 
                  : 'bg-neoYellow text-black hover:bg-neoYellow/95'
              }`}
            >
              {isUpgrading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" /> Memproses...
                </>
              ) : user?.plan === 'premium' ? (
                <>
                  Kembali ke Free Tier
                </>
              ) : (
                <>
                  Aktifkan Premium <ArrowUpRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: FORM SETTINGS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        
        {/* Kolom Kiri: Detail Profil */}
        <form onSubmit={handleUpdateProfile} className="bg-white border-3 border-black shadow-neo rounded-3xl p-6 space-y-5 transition-all duration-200 hover:shadow-[6px_6px_0px_#1D2A44] hover:-translate-y-0.5">
          <h3 className="text-sm font-black text-black uppercase tracking-wider border-b-2 border-black pb-3 flex items-center gap-2">
            <Settings2 className="w-4.5 h-4.5" /> Informasi Umum
          </h3>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-black uppercase tracking-wider block">Nama Lengkap</label>
            <div className="relative">
              <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-black/60" />
              <input
                type="text"
                required
                placeholder="Nama Lengkap Anda"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full neo-input rounded-xl pl-10 pr-4 py-3 text-xs font-black"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-black uppercase tracking-wider block">Zona Waktu AI</label>
            <CustomSelect
              options={timezoneOptions}
              value={timezone}
              onChange={setTimezone}
              disabled={isLoading}
            />
            <p className="text-[9px] font-bold text-black/55 mt-1 leading-normal">
              Zona waktu ini digunakan oleh AI scheduler untuk mengalokasikan agenda dan mengirimkan notifikasi pengingat secara tepat waktu.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full neo-btn bg-neoYellow text-black rounded-xl py-3 text-xs font-black shadow-neo hover:-translate-y-0.5 hover:translate-x-0.5 hover:shadow-neo-sm active:translate-y-0.5 active:translate-x-0.5 active:shadow-none flex items-center justify-center gap-1.5"
          >
            {isLoading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" /> Menyimpan...
              </>
            ) : (
              <>
                Simpan Perubahan <Sparkles className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
 
        {/* Kolom Kanan: Keamanan / Ganti Password */}
        <form onSubmit={handleChangePassword} className="bg-white border-3 border-black shadow-neo rounded-3xl p-6 space-y-5 transition-all duration-200 hover:shadow-[6px_6px_0px_#1D2A44] hover:-translate-y-0.5">
          <h3 className="text-sm font-black text-black uppercase tracking-wider border-b-2 border-black pb-3 flex items-center gap-2">
            <Shield className="w-4.5 h-4.5" /> Keamanan Akun
          </h3>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-black uppercase tracking-wider block">Kata Sandi Saat Ini</label>
            <div className="relative">
              <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-black/60" />
              <input
                type={showCurrentPassword ? "text" : "password"}
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full neo-input rounded-xl pl-10 pr-10 py-3 text-xs font-semibold"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black cursor-pointer"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-black uppercase tracking-wider block">Kata Sandi Baru</label>
            <div className="relative">
              <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-black/60" />
              <input
                type={showNewPassword ? "text" : "password"}
                placeholder="Minimal 6 karakter"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full neo-input rounded-xl pl-10 pr-10 py-3 text-xs font-semibold"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black cursor-pointer"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-black uppercase tracking-wider block">Konfirmasi Kata Sandi Baru</label>
            <div className="relative">
              <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-black/60" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Ulangi kata sandi baru"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full neo-input rounded-xl pl-10 pr-10 py-3 text-xs font-semibold"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full neo-btn bg-black text-white hover:bg-neutral-800 rounded-xl py-3 text-xs font-black shadow-neo hover:-translate-y-0.5 hover:translate-x-0.5 hover:shadow-neo-sm active:translate-y-0.5 active:translate-x-0.5 active:shadow-none flex items-center justify-center gap-1.5"
          >
            {isLoading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" /> Mengubah...
              </>
            ) : (
              <>
                Perbarui Kata Sandi <Shield className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

      </div>

      {/* SECTION 4: KONFIGURASI API AI MANDIRI */}
      <div className="bg-white border-3 border-black shadow-neo rounded-3xl p-6 space-y-6 transition-all duration-200 hover:shadow-[6px_6px_0px_#1D2A44] hover:-translate-y-0.5">
        <div className="border-b-2 border-black pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-sm font-black text-black uppercase tracking-wider flex items-center gap-2">
            <Key className="w-4.5 h-4.5 text-neoOrange" /> Konfigurasi API AI Mandiri (BYOK)
          </h3>
          <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md border border-black bg-neoMint text-black shadow-neo-sm">
            Bring Your Own Key
          </span>
        </div>

        <p className="text-xs text-black/60 font-bold leading-relaxed">
          Secara default, Motion menggunakan API Key sistem yang disediakan oleh admin (Asep AI Service). 
          Jika Anda ingin menggunakan kuota Anda sendiri tanpa batasan limitasi sistem, silakan masukkan API Key Anda di bawah ini. 
          API Key disimpan secara aman menggunakan enkripsi AES-256-GCM.
        </p>

        {aiConfigSuccess && (
          <div className="bg-neoMint border-3 border-black text-black text-xs font-black rounded-xl p-4 flex items-center gap-2.5 shadow-neo animate-fadeIn">
            <CheckCircle className="w-5 h-5 shrink-0 text-black" />
            <span>{aiConfigSuccess}</span>
          </div>
        )}

        {aiConfigError && (
          <div className="bg-neoOrange border-3 border-black text-white text-xs font-black rounded-xl p-4 flex items-center gap-2.5 shadow-neo animate-fadeIn">
            <ShieldAlert className="w-5 h-5 shrink-0 text-white" />
            <span>{aiConfigError}</span>
          </div>
        )}

        <form onSubmit={handleSaveAIKeys} className="space-y-6">
          {/* GEMINI KEY */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-black uppercase tracking-wider flex items-center gap-1.5">
                Gemini API Key
                {aiConfigStatus?.gemini_configured ? (
                  <span className="px-1.5 py-0.5 text-[8px] bg-neoMint border border-black rounded text-black font-black uppercase shadow-neo-sm animate-fadeIn">
                    Terhubung ✅
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 text-[8px] bg-neoCream border border-black rounded text-black/50 font-bold uppercase animate-fadeIn">
                    Pakai Sistem ⚙️
                  </span>
                )}
              </label>
              {aiConfigStatus?.gemini_configured && (
                <button
                  type="button"
                  onClick={() => handleClearKey('gemini')}
                  className="text-[9px] font-black text-neoOrange hover:underline cursor-pointer"
                >
                  Hapus & Reset
                </button>
              )}
            </div>
            <div className="relative">
              <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-black/60" />
              <input
                type={showGemini ? "text" : "password"}
                placeholder={aiConfigStatus?.gemini_configured ? "•••••••••••••••• (Telah Dikonfigurasi)" : "Masukkan Gemini API Key baru (AI-xxxx)"}
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                className="w-full neo-input rounded-xl pl-10 pr-10 py-3 text-xs font-semibold"
                disabled={aiConfigLoading}
              />
              <button
                type="button"
                onClick={() => setShowGemini(!showGemini)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black cursor-pointer"
              >
                {showGemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* GROQ KEY */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-black uppercase tracking-wider flex items-center gap-1.5">
                Groq API Key
                {aiConfigStatus?.groq_configured ? (
                  <span className="px-1.5 py-0.5 text-[8px] bg-neoMint border border-black rounded text-black font-black uppercase shadow-neo-sm animate-fadeIn">
                    Terhubung ✅
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 text-[8px] bg-neoCream border border-black rounded text-black/50 font-bold uppercase animate-fadeIn">
                    Pakai Sistem ⚙️
                  </span>
                )}
              </label>
              {aiConfigStatus?.groq_configured && (
                <button
                  type="button"
                  onClick={() => handleClearKey('groq')}
                  className="text-[9px] font-black text-neoOrange hover:underline cursor-pointer"
                >
                  Hapus & Reset
                </button>
              )}
            </div>
            <div className="relative">
              <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-black/60" />
              <input
                type={showGroq ? "text" : "password"}
                placeholder={aiConfigStatus?.groq_configured ? "•••••••••••••••• (Telah Dikonfigurasi)" : "Masukkan Groq API Key baru (gsk_xxxx)"}
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
                className="w-full neo-input rounded-xl pl-10 pr-10 py-3 text-xs font-semibold"
                disabled={aiConfigLoading}
              />
              <button
                type="button"
                onClick={() => setShowGroq(!showGroq)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black cursor-pointer"
              >
                {showGroq ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* OPENROUTER KEY */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-black uppercase tracking-wider flex items-center gap-1.5">
                OpenRouter API Key
                {aiConfigStatus?.openrouter_configured ? (
                  <span className="px-1.5 py-0.5 text-[8px] bg-neoMint border border-black rounded text-black font-black uppercase shadow-neo-sm animate-fadeIn">
                    Terhubung ✅
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 text-[8px] bg-neoCream border border-black rounded text-black/50 font-bold uppercase animate-fadeIn">
                    Pakai Sistem ⚙️
                  </span>
                )}
              </label>
              {aiConfigStatus?.openrouter_configured && (
                <button
                  type="button"
                  onClick={() => handleClearKey('openrouter')}
                  className="text-[9px] font-black text-neoOrange hover:underline cursor-pointer"
                >
                  Hapus & Reset
                </button>
              )}
            </div>
            <div className="relative">
              <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-black/60" />
              <input
                type={showOpenRouter ? "text" : "password"}
                placeholder={aiConfigStatus?.openrouter_configured ? "•••••••••••••••• (Telah Dikonfigurasi)" : "Masukkan OpenRouter API Key baru (sk-or-xxxx)"}
                value={openRouterKey}
                onChange={(e) => setOpenRouterKey(e.target.value)}
                className="w-full neo-input rounded-xl pl-10 pr-10 py-3 text-xs font-semibold"
                disabled={aiConfigLoading}
              />
              <button
                type="button"
                onClick={() => setShowOpenRouter(!showOpenRouter)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black cursor-pointer"
              >
                {showOpenRouter ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={aiConfigLoading}
            className="w-full neo-btn bg-neoMint text-black rounded-xl py-3 text-xs font-black shadow-neo hover:-translate-y-0.5 hover:translate-x-0.5 hover:shadow-neo-sm active:translate-y-0.5 active:translate-x-0.5 active:shadow-none flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {aiConfigLoading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" /> Menyimpan...
              </>
            ) : (
              <>
                Simpan API Key <Sparkles className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>

    </div>
  );
}
