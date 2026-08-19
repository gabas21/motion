'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import API from '../../../../../lib/api';
import {
  ShieldAlert, Loader, ArrowLeft, Laptop, Smartphone, CheckCircle, AlertCircle,
  Key, ShieldCheck, Ban, RefreshCw, KeyRound, Clock, Edit, Lock, Eye, EyeOff, User, Calendar
} from 'lucide-react';
import { toast } from '../../../../../hooks/useToast';
import { ToastContainer } from '../../../../../components/ui/Toast';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  timezone: string;
  emailVerified: boolean;
  lockedUntil?: string;
  requirePasswordChange: boolean;
  failedLoginAttempts: number;
  lastLoginAt?: string;
  subscriptionExpiresAt?: string;
  createdAt: string;
}

interface UserSessionItem {
  id: string;
  userId: string;
  deviceInfo: string;
  ipAddress: string;
  lastActiveAt: string;
  revokedAt?: string;
  createdAt: string;
}

interface KeyStatus {
  provider: string;
  hasKey: boolean;
  last4?: string;
  isValidFormat: boolean;
  connectionStatus: string;
}

interface TimelineItem {
  timestamp: string;
  category: string;
  action: string;
  actor: string;
  details: string;
  ipAddress?: string;
}

export default function UserInspectorPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);
  const [sessions, setSessions] = useState<UserSessionItem[]>([]);
  const [apiKeys, setApiKeys] = useState<Record<string, KeyStatus>>({});
  const [stats, setStats] = useState<any>({});
  const [integrations, setIntegrations] = useState<Record<string, boolean>>({});
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Evict Session Modal
  const [evictSessionTarget, setEvictSessionTarget] = useState<UserSessionItem | null>(null);
  const [isEvictingAll, setIsEvictingAll] = useState(false);
  const [evictReason, setEvictReason] = useState('');
  const [submittingEvict, setSubmittingEvict] = useState(false);

  // API Key Reveal Modal
  const [revealProvider, setRevealProvider] = useState<string | null>(null);
  const [revealReason, setRevealReason] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealTimer, setRevealTimer] = useState<number>(15);
  const [submittingReveal, setSubmittingReveal] = useState(false);

  // Admin Override Modal
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideForm, setOverrideForm] = useState({
    name: '',
    plan: '',
    role: '',
    requirePasswordChange: false,
    isSuspended: false,
    reason: '',
  });
  const [submittingOverride, setSubmittingOverride] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchInspectorData();
      fetchTimeline();
    }
  }, [userId]);

  // Reveal countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (revealedKey && revealTimer > 0) {
      timer = setInterval(() => {
        setRevealTimer((prev) => prev - 1);
      }, 1000);
    } else if (revealTimer === 0) {
      setRevealedKey(null);
      setRevealProvider(null);
      setRevealReason('');
      setRevealTimer(15);
    }
    return () => clearInterval(timer);
  }, [revealedKey, revealTimer]);

  const fetchInspectorData = async () => {
    try {
      setLoading(true);
      const res = await API.get(`/admin/users/${userId}/inspect`);
      const data = res.data.data;
      setUser(data.user);
      setSessions(data.sessions || []);
      setApiKeys(data.apiKeys || {});
      setStats(data.stats || {});
      setIntegrations(data.integrations || {});

      // Initialize override form
      setOverrideForm({
        name: data.user.name || '',
        plan: data.user.plan || 'free',
        role: data.user.role || 'user',
        requirePasswordChange: data.user.requirePasswordChange || false,
        isSuspended: checkIsSuspended(data.user),
        reason: '',
      });
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Gagal mengambil data inspeksi user.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeline = async () => {
    try {
      setLoadingTimeline(true);
      const res = await API.get(`/admin/users/${userId}/timeline`);
      setTimeline(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch timeline:', err);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const checkIsSuspended = (u: UserData) => {
    if (!u.lockedUntil) return false;
    const lockedDate = new Date(u.lockedUntil);
    const now = new Date();
    const diffDays = Math.ceil((lockedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 30;
  };

  const handleEvictSession = async () => {
    if (!evictReason || evictReason.length < 10) {
      toast.error('Alasan pemutusan wajib diisi minimal 10 karakter!');
      return;
    }
    try {
      setSubmittingEvict(true);
      if (isEvictingAll) {
        await API.post(`/admin/users/${userId}/evict-all-sessions`, { reason: evictReason });
        toast.success('Seluruh sesi perangkat pengguna berhasil dicabut secara massal!');
      } else if (evictSessionTarget) {
        await API.post(`/admin/users/${userId}/sessions/${evictSessionTarget.id}/evict`, { reason: evictReason });
        toast.success('Sesi perangkat spesifik berhasil dicabut!');
      }
      setEvictSessionTarget(null);
      setIsEvictingAll(false);
      setEvictReason('');
      fetchInspectorData();
      fetchTimeline();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Gagal mencabut sesi.');
    } finally {
      setSubmittingEvict(false);
    }
  };

  const handleRevealAPIKey = async () => {
    if (!revealReason || revealReason.length < 10) {
      toast.error('Alasan inspeksi wajib diisi minimal 10 karakter!');
      return;
    }
    if (!revealProvider) return;

    try {
      setSubmittingReveal(true);
      const res = await API.post(`/admin/users/${userId}/api-keys/${revealProvider}/reveal`, { reason: revealReason });
      setRevealedKey(res.data.data.key);
      setRevealTimer(15);
      toast.success(`API Key ${revealProvider.toUpperCase()} berhasil diungkapkan. Tindakan dicatat di Admin Audit Log.`);
      fetchTimeline();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Gagal meretrieve API Key.');
    } finally {
      setSubmittingReveal(false);
    }
  };

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideForm.reason || overrideForm.reason.length < 10) {
      toast.error('Alasan override data wajib diisi minimal 10 karakter!');
      return;
    }
    try {
      setSubmittingOverride(true);
      const res = await API.put(`/admin/users/${userId}/override-data`, overrideForm);
      toast.success('Data pengguna berhasil diperbarui oleh Admin!');
      setUser(res.data.data.user);
      setShowOverrideModal(false);
      fetchInspectorData();
      fetchTimeline();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Gagal mengubah data user.');
    } finally {
      setSubmittingOverride(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-black">
        <Loader className="w-8 h-8 animate-spin" />
        <p className="font-extrabold text-xs text-black/60 uppercase">Memuat Live User Inspector 360°...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20 bg-white border-3 border-black rounded-2xl shadow-neo p-8 text-black">
        <ShieldAlert className="w-12 h-12 mx-auto text-neoOrange mb-3" />
        <h3 className="font-black text-lg">User Tidak Ditemukan</h3>
        <button
          onClick={() => router.push('/admin/users')}
          className="mt-4 px-4 py-2 bg-neoYellow border-2 border-black rounded-xl font-black text-xs shadow-neo-sm"
        >
          Kembali ke Daftar User
        </button>
      </div>
    );
  }

  const isSuspended = checkIsSuspended(user);

  return (
    <div className="space-y-8 text-black relative">
      <ToastContainer />

      {/* Header Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/admin/users')}
            className="p-2.5 bg-white border-2 border-black rounded-xl shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-black" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="neo-badge bg-neoYellow text-black text-[9px] px-2 py-0.5 font-black uppercase border-2 border-black">
                ZERO-TRUST INSPECTOR
              </span>
              <span className="font-mono text-xs font-bold text-black/55">ID: {user.id}</span>
            </div>
            <h1 className="font-black text-2xl tracking-tight text-black">{user.name}</h1>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowOverrideModal(true)}
            className="px-4 py-2 bg-neoYellow border-2 border-black rounded-xl font-black text-xs shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Edit className="w-4 h-4" /> OVERRIDE DATA USER
          </button>
          <button
            onClick={() => {
              setIsEvictingAll(true);
              setEvictSessionTarget(null);
            }}
            className="px-4 py-2 bg-neoOrange text-white border-2 border-black rounded-xl font-black text-xs shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Ban className="w-4 h-4" /> MEMUTUS SELURUH SESI
          </button>
        </div>
      </div>

      {/* Profile Overview Card */}
      <div className="bg-white border-3 border-black p-6 rounded-2xl shadow-neo grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="flex items-center gap-4 md:col-span-2 border-b-2 md:border-b-0 md:border-r-2 border-black/10 pb-4 md:pb-0 md:pr-4">
          <div className={`w-16 h-16 rounded-2xl border-3 border-black flex items-center justify-center font-black text-2xl shadow-neo-sm ${
            user.role === 'admin' ? 'bg-neoPink' : 'bg-neoYellow'
          }`}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-xl leading-snug">{user.name}</h3>
            <p className="font-mono text-xs text-black/60">{user.email}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className={`text-[9px] font-black px-2 py-0.5 border-2 border-black rounded-md shadow-neo-sm uppercase ${
                user.role === 'admin' ? 'bg-neoPink text-black' : 'bg-neoCream text-black'
              }`}>
                ROLE: {user.role}
              </span>
              <span className="text-[9px] font-black px-2 py-0.5 bg-purple-100 text-purple-800 border-2 border-black rounded-md shadow-neo-sm uppercase">
                PLAN: {user.plan}
              </span>
              {isSuspended ? (
                <span className="text-[9px] font-black px-2 py-0.5 bg-neoOrange text-white border-2 border-black rounded-md shadow-neo-sm uppercase">
                  SUSPENDED
                </span>
              ) : (
                <span className="text-[9px] font-black px-2 py-0.5 bg-neoMint text-black border-2 border-black rounded-md shadow-neo-sm uppercase">
                  STATUS: AKTIF
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Security Summary */}
        <div className="space-y-2 text-xs font-bold border-b-2 md:border-b-0 md:border-r-2 border-black/10 pb-4 md:pb-0 md:pr-4">
          <p className="text-[10px] font-black text-black/40 uppercase tracking-wider">Keamanan & Login</p>
          <div className="flex justify-between">
            <span className="text-black/60">Email Verifikasi:</span>
            <span className={user.emailVerified ? 'text-emerald-600 font-black' : 'text-red-500 font-black'}>
              {user.emailVerified ? 'TERVERIFIKASI ✓' : 'PENDING ✗'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-black/60">Ganti Sandi Paksa:</span>
            <span className={user.requirePasswordChange ? 'text-neoOrange font-black' : 'text-black/50 font-black'}>
              {user.requirePasswordChange ? 'YA' : 'TIDAK'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-black/60">Gagal Login:</span>
            <span className="font-mono font-black">{user.failedLoginAttempts}x</span>
          </div>
        </div>

        {/* Integration Summary */}
        <div className="space-y-2 text-xs font-bold">
          <p className="text-[10px] font-black text-black/40 uppercase tracking-wider">Status Integrasi</p>
          <div className="flex justify-between">
            <span className="text-black/60">SIAK Wicida:</span>
            <span className={integrations.siakConnected ? 'text-emerald-600 font-black' : 'text-black/40 font-black'}>
              {integrations.siakConnected ? 'TERHUBUNG' : 'TERPUTUS'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-black/60">WeLearn Moodle:</span>
            <span className={integrations.moodleConnected ? 'text-emerald-600 font-black' : 'text-black/40 font-black'}>
              {integrations.moodleConnected ? 'TERHUBUNG' : 'TERPUTUS'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-black/60">Google Calendar:</span>
            <span className={integrations.calendarConnected ? 'text-emerald-600 font-black' : 'text-black/40 font-black'}>
              {integrations.calendarConnected ? 'TERHUBUNG' : 'TERPUTUS'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Per-Device Active Sessions & API Key Monitor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Active Device Sessions Card */}
        <div className="bg-white border-3 border-black rounded-2xl shadow-neo overflow-hidden flex flex-col">
          <div className="bg-[#121214] text-white p-4 border-b-3 border-black flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Laptop className="w-5 h-5 text-neoYellow" />
              <h3 className="font-black text-sm uppercase text-white">Sesi Perangkat Aktif ({sessions.filter(s => !s.revokedAt).length})</h3>
            </div>
            <button
              onClick={() => {
                setIsEvictingAll(true);
                setEvictSessionTarget(null);
              }}
              className="px-3 py-1 bg-neoOrange text-white border border-white rounded-lg text-xxs font-black cursor-pointer hover:bg-orange-600 transition-colors"
            >
              EVICT MASSAL
            </button>
          </div>

          <div className="p-4 flex-1 overflow-y-auto space-y-3 max-h-[360px]">
            {sessions.length === 0 ? (
              <p className="text-xs text-black/50 font-bold text-center py-8">Tidak ada riwayat sesi perangkat terdeteksi.</p>
            ) : (
              sessions.map((sess) => {
                const isActive = !sess.revokedAt;
                const isMobile = /mobile|android|iphone|ipad/i.test(sess.deviceInfo);

                return (
                  <div
                    key={sess.id}
                    className={`p-3.5 border-2 border-black rounded-xl shadow-neo-sm flex items-center justify-between gap-3 ${
                      isActive ? 'bg-white' : 'bg-black/[0.04] opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg border-2 border-black shrink-0 ${isActive ? 'bg-neoMint' : 'bg-gray-200'}`}>
                        {isMobile ? <Smartphone className="w-4 h-4 text-black" /> : <Laptop className="w-4 h-4 text-black" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs truncate max-w-[240px] text-black">{sess.deviceInfo || 'Unknown Device'}</p>
                        <div className="flex gap-2 text-xxs font-mono text-black/60 mt-0.5">
                          <span>IP: {sess.ipAddress || 'Unknown'}</span>
                          <span>·</span>
                          <span>{new Date(sess.lastActiveAt).toLocaleString('id-ID')}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      {isActive ? (
                        <button
                          onClick={() => {
                            setEvictSessionTarget(sess);
                            setIsEvictingAll(false);
                          }}
                          className="px-2.5 py-1 bg-neoOrange text-white border-2 border-black rounded-lg text-xxs font-black shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all cursor-pointer"
                        >
                          PUTUS SESI 🚫
                        </button>
                      ) : (
                        <span className="text-[9px] font-black px-2 py-0.5 bg-gray-200 text-gray-700 border border-black rounded uppercase">
                          DICABUT
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* API Key Monitor & Regex Format Inspector Card */}
        <div className="bg-white border-3 border-black rounded-2xl shadow-neo overflow-hidden flex flex-col">
          <div className="bg-[#121214] text-white p-4 border-b-3 border-black flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-neoPink" />
              <h3 className="font-black text-sm uppercase text-white">Inspektur API Key (BYOK Zero-Trust)</h3>
            </div>
            <span className="text-[9px] font-black px-2 py-0.5 bg-neoPink text-black rounded border border-black uppercase">
              ENCRYPTED DB
            </span>
          </div>

          <div className="p-4 flex-1 space-y-4">
            {['gemini', 'groq', 'openrouter'].map((provider) => {
              const status = apiKeys[provider] || { provider, hasKey: false, connectionStatus: 'unconfigured', isValidFormat: false };

              return (
                <div key={provider} className="p-4 bg-[#FAF9F5] border-2 border-black rounded-xl shadow-neo-sm flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm uppercase">{provider}</span>
                      {status.hasKey && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 border rounded uppercase ${
                          status.isValidFormat ? 'bg-emerald-100 text-emerald-800 border-emerald-500' : 'bg-red-100 text-red-800 border-red-500'
                        }`}>
                          {status.isValidFormat ? 'REGEX VALID ✓' : 'FORMAT WRONG ⚠️'}
                        </span>
                      )}
                    </div>

                    <p className="font-mono text-xs text-black/60 mt-1">
                      {status.hasKey ? `Registered (Ends with: ...${status.last4 || '****'})` : 'Belum mengonfigurasi API key'}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {status.hasKey ? (
                      <button
                        onClick={() => {
                          setRevealProvider(provider);
                          setRevealReason('');
                          setRevealedKey(null);
                        }}
                        className="px-3 py-1.5 bg-neoYellow border-2 border-black rounded-lg text-xs font-black shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> REVEAL KEY
                      </button>
                    ) : (
                      <span className="text-[10px] font-black text-black/40">KOSONG</span>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="bg-neoCream border-2 border-black p-3.5 rounded-xl font-bold text-xs space-y-1">
              <p className="font-black text-black uppercase text-[10px] tracking-wide">💡 Ketentuan Inspeksi Zero-Trust:</p>
              <p className="text-black/70 leading-relaxed text-[11px]">
                API key disimpan terenkripsi AES-GCM dengan garam per-pengguna. Pengungkapan kunci hanya dapat diakses melalui audit log admin dengan memberikan justifikasi alasan tertulis.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Activity & Audit Logs Timeline */}
      <div className="bg-white border-3 border-black rounded-2xl shadow-neo p-6 space-y-4">
        <div className="flex items-center justify-between border-b-2 border-black/10 pb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-neoYellow" />
            <h3 className="font-black text-base uppercase">Timeline Mutasi Data & Audit Log User</h3>
          </div>
          <button
            onClick={fetchTimeline}
            className="p-1.5 bg-white border-2 border-black rounded-lg shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all cursor-pointer"
            title="Refresh Timeline"
          >
            <RefreshCw className={`w-4 h-4 text-black ${loadingTimeline ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loadingTimeline ? (
          <div className="flex justify-center py-8">
            <Loader className="w-6 h-6 animate-spin text-black" />
          </div>
        ) : timeline.length === 0 ? (
          <p className="text-xs text-black/50 font-bold text-center py-8">Belum ada riwayat aktivitas atau tindakan audit tercatat.</p>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {timeline.map((item, idx) => {
              const isAdminAction = item.category === 'admin_action';
              return (
                <div
                  key={idx}
                  className={`p-3.5 border-2 border-black rounded-xl text-xs flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-neo-sm ${
                    isAdminAction ? 'bg-amber-50/70 border-amber-900' : 'bg-white'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded border border-black uppercase ${
                        isAdminAction ? 'bg-neoOrange text-white' : 'bg-neoMint text-black'
                      }`}>
                        {item.action}
                      </span>
                      <span className="font-black text-black">{item.actor}</span>
                    </div>
                    <p className="font-bold text-black/70">{item.details}</p>
                  </div>

                  <div className="font-mono text-xxs text-black/50 text-right shrink-0">
                    <div>{new Date(item.timestamp).toLocaleString('id-ID')}</div>
                    {item.ipAddress && <div>IP: {item.ipAddress}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: Evict Session Modal */}
      {(evictSessionTarget || isEvictingAll) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 text-black">
          <div className="bg-white border-3 border-black rounded-2xl shadow-neo max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-neoOrange text-white p-4 border-b-3 border-black flex items-center gap-2">
              <Ban className="w-5 h-5" />
              <h3 className="font-black text-sm uppercase text-white">
                {isEvictingAll ? 'Konfirmasi Pemutusan Seluruh Sesi' : 'Konfirmasi Pemutusan Perangkat'}
              </h3>
            </div>

            <div className="p-6 space-y-4 text-xs font-bold">
              <p>
                {isEvictingAll
                  ? `Apakah Anda yakin ingin memutus seluruh sesi perangkat aktif milik ${user.name}? Pengguna akan ter-logout dari semua browser.`
                  : `Apakah Anda yakin ingin memutus sesi perangkat "${evictSessionTarget?.deviceInfo}" (IP: ${evictSessionTarget?.ipAddress})?`}
              </p>

              <div className="space-y-1.5">
                <label className="font-black text-black uppercase text-[10px]">
                  Alasan Pemutusan (Wajib Min. 10 Karakter): <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={evictReason}
                  onChange={(e) => setEvictReason(e.target.value)}
                  placeholder="Contoh: Terdeteksi aktivitas login mencurigakan dari IP tidak dikenal..."
                  className="w-full neo-input p-3 text-xs font-bold"
                />
                <span className="text-[10px] text-black/50 block font-mono">
                  Karakter: {evictReason.length}/10
                </span>
              </div>
            </div>

            <div className="bg-[#121214]/5 p-4 border-t-3 border-black flex justify-end gap-3">
              <button
                disabled={submittingEvict}
                onClick={() => {
                  setEvictSessionTarget(null);
                  setIsEvictingAll(false);
                }}
                className="px-4 py-2 bg-white border-2 border-black rounded-xl font-black text-xs shadow-neo-sm"
              >
                BATAL
              </button>
              <button
                disabled={submittingEvict || evictReason.length < 10}
                onClick={handleEvictSession}
                className="px-4 py-2 bg-neoOrange text-white border-2 border-black rounded-xl font-black text-xs shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {submittingEvict ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                <span>PROSES PEMUTUSAN</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Reveal API Key Modal */}
      {revealProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 text-black">
          <div className="bg-white border-3 border-black rounded-2xl shadow-neo max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#121214] text-white p-4 border-b-3 border-black flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-neoPink" />
                <h3 className="font-black text-sm uppercase text-white">Inspeksi API Key: {revealProvider.toUpperCase()}</h3>
              </div>
              {revealedKey && (
                <span className="font-mono text-xs font-black bg-neoYellow text-black px-2 py-0.5 rounded border border-black">
                  Auto-Hide: {revealTimer}s
                </span>
              )}
            </div>

            <div className="p-6 space-y-4 text-xs font-bold">
              {!revealedKey ? (
                <>
                  <p className="text-black/80">
                    Pengungkapan API key pengguna merupakan aksi sensitif. Harap masukkan alasan audit wajib sebelum kunci asli ditampilkan.
                  </p>

                  <div className="space-y-1.5">
                    <label className="font-black text-black uppercase text-[10px]">
                      Alasan Audit Inspeksi (Min. 10 Karakter): <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={revealReason}
                      onChange={(e) => setRevealReason(e.target.value)}
                      placeholder="Contoh: Investigasi kuota API key bermasalah sesuai tiket #4092..."
                      className="w-full neo-input p-3 text-xs font-bold"
                    />
                    <span className="text-[10px] text-black/50 block font-mono">
                      Karakter: {revealReason.length}/10
                    </span>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="bg-neoOrange/10 border-2 border-neoOrange p-3 rounded-xl text-neoOrange text-[11px] font-black flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 shrink-0" />
                    <span>Perhatian: Kunci ini milik pengguna secara pribadi. Jangan membagikannya ke pihak luar!</span>
                  </div>

                  <div className="bg-black text-emerald-400 font-mono p-4 rounded-xl border-2 border-black text-sm break-all font-black select-all">
                    {revealedKey}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[#121214]/5 p-4 border-t-3 border-black flex justify-end gap-3">
              <button
                onClick={() => {
                  setRevealProvider(null);
                  setRevealedKey(null);
                  setRevealReason('');
                }}
                className="px-4 py-2 bg-white border-2 border-black rounded-xl font-black text-xs shadow-neo-sm"
              >
                TUTUP
              </button>
              {!revealedKey && (
                <button
                  disabled={submittingReveal || revealReason.length < 10}
                  onClick={handleRevealAPIKey}
                  className="px-4 py-2 bg-neoYellow border-2 border-black rounded-xl font-black text-xs shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submittingReveal ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>REVEAL KEY</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Admin User Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 text-black">
          <div className="bg-white border-3 border-black rounded-2xl shadow-neo max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-neoYellow text-black p-4 border-b-3 border-black flex items-center gap-2">
              <Edit className="w-5 h-5" />
              <h3 className="font-black text-sm uppercase">Admin User Data Override</h3>
            </div>

            <form onSubmit={handleOverrideSubmit} className="p-6 space-y-4 text-xs font-bold max-h-[80vh] overflow-y-auto">
              <div className="space-y-1">
                <label className="font-black uppercase text-[10px]">Nama Pengguna</label>
                <input
                  type="text"
                  value={overrideForm.name}
                  onChange={(e) => setOverrideForm({ ...overrideForm, name: e.target.value })}
                  className="w-full neo-input p-2.5 text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-black uppercase text-[10px]">Subscription Plan</label>
                  <select
                    value={overrideForm.plan}
                    onChange={(e) => setOverrideForm({ ...overrideForm, plan: e.target.value })}
                    className="w-full neo-input p-2.5 text-xs font-bold bg-white"
                  >
                    <option value="free">FREE</option>
                    <option value="pro">PRO (1 Tahun)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-black uppercase text-[10px]">User Role</label>
                  <select
                    value={overrideForm.role}
                    onChange={(e) => setOverrideForm({ ...overrideForm, role: e.target.value })}
                    className="w-full neo-input p-2.5 text-xs font-bold bg-white"
                  >
                    <option value="user">USER</option>
                    <option value="admin">ADMIN</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-black/10">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overrideForm.requirePasswordChange}
                    onChange={(e) => setOverrideForm({ ...overrideForm, requirePasswordChange: e.target.checked })}
                    className="w-4 h-4 rounded border-2 border-black"
                  />
                  <span>Paksa pengguna ganti sandi pada login berikutnya</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overrideForm.isSuspended}
                    onChange={(e) => setOverrideForm({ ...overrideForm, isSuspended: e.target.checked })}
                    className="w-4 h-4 rounded border-2 border-black"
                  />
                  <span className="text-red-600 font-black">Bekukan/Suspend akun pengguna ini</span>
                </label>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-black/10">
                <label className="font-black uppercase text-[10px]">
                  Alasan Override (Wajib Min. 10 Karakter): <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={overrideForm.reason}
                  onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                  placeholder="Contoh: Permintaan upgrade kuota khusus dari pengguna atau perbaikan profil..."
                  className="w-full neo-input p-3 text-xs font-bold"
                />
                <span className="text-[10px] text-black/50 block font-mono">
                  Karakter: {overrideForm.reason.length}/10
                </span>
              </div>

              <div className="bg-[#121214]/5 p-4 border-t-3 border-black -mx-6 -mb-6 mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-4 py-2 bg-white border-2 border-black rounded-xl font-black text-xs shadow-neo-sm"
                >
                  BATAL
                </button>
                <button
                  type="submit"
                  disabled={submittingOverride || overrideForm.reason.length < 10}
                  className="px-4 py-2 bg-neoYellow border-2 border-black rounded-xl font-black text-xs shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submittingOverride ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  <span>SIMPAN OVERRIDE</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
