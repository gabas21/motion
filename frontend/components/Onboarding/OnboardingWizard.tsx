'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useScheduling } from '@/hooks/useScheduling';
import CustomSelect from '@/components/ui/CustomSelect';
import { MotiClock, StarrySparkle } from '@/components/Landing/Mascots';
import { 
  Clock, Coffee, Sparkles, Check, ArrowRight, ArrowLeft, Loader, 
  Globe, Zap, QrCode, ExternalLink, ShieldCheck, RefreshCw,
  GraduationCap, BookOpen, Calendar, Lock, User, CheckCircle2
} from 'lucide-react';
import API from '@/lib/api';
import { toast } from '@/hooks/useToast';

interface OnboardingWizardProps {
  onComplete: (navigateToIntegrations?: boolean) => void;
}

interface PendingPayment {
  orderId: string;
  amount: number;
  qrUrl: string;
  checkoutUrl: string;
  createdAt: string;
}

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { user, updateProfile } = useAuth();
  const { updatePreferences } = useScheduling();
  
  const [step, setStep] = useState(1);
  const [timezone, setTimezone] = useState('Asia/Jakarta');
  const [currentTime, setCurrentTime] = useState('');
  
  // Scheduling States
  const [workHoursStart, setWorkHoursStart] = useState(9);
  const [workHoursEnd, setWorkHoursEnd] = useState(18);
  const [breakDurationMinutes, setBreakDurationMinutes] = useState(15);
  const [allowWeekendScheduling, setAllowWeekendScheduling] = useState(false);
  const [preferredTaskTime, setPreferredTaskTime] = useState('morning');

  // Step 3 Integration States (SIAK, WeLearn, Calendar)
  const [integrationTab, setIntegrationTab] = useState<'siak' | 'welearn' | 'calendar'>('siak');
  
  // SIAK state
  const [siakNim, setSiakNim] = useState('');
  const [siakPassword, setSiakPassword] = useState('');
  const [isConnectingSiak, setIsConnectingSiak] = useState(false);
  const [siakConnected, setSiakConnected] = useState(false);

  // WeLearn state
  const [welearnUsername, setWelearnUsername] = useState('');
  const [welearnPassword, setWelearnPassword] = useState('');
  const [isConnectingWelearn, setIsConnectingWelearn] = useState(false);
  const [welearnConnected, setWelearnConnected] = useState(false);

  // Calendar state
  const [calendarConnected, setCalendarConnected] = useState(false);

  // Step 4 Plan & Payment States
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'pro'>('pro');
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isProActive, setIsProActive] = useState(false);
  const [countdown, setCountdown] = useState<string>('');
  const [connectWeLearnChoice, setConnectWeLearnChoice] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Ambil pilihan plan dari signup
  useEffect(() => {
    try {
      const savedPlan = localStorage.getItem('motion_signup_plan');
      if (savedPlan === 'pro' || savedPlan === 'free') {
        setSelectedPlan(savedPlan);
      }
    } catch (_) {}
  }, []);

  // Clock Update for Step 1
  useEffect(() => {
    const updateClock = () => {
      try {
        const formatter = new Intl.DateTimeFormat('id-ID', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        setCurrentTime(formatter.format(new Date()));
      } catch (e) {
        setCurrentTime(new Date().toLocaleTimeString('id-ID'));
      }
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [timezone]);

  // Step 1 & 2 Navigation
  const handleStep1Next = () => {
    if (!timezone) return;
    setErrorMsg('');
    setStep(2);
  };

  const handleStep2Next = () => {
    if (workHoursStart >= workHoursEnd) {
      setErrorMsg('Jam mulai kerja harus lebih awal dari jam selesai kerja!');
      return;
    }
    setErrorMsg('');
    setStep(3);
  };

  const handleStep3Next = (connectWeLearn: boolean) => {
    setConnectWeLearnChoice(connectWeLearn);
    setErrorMsg('');
    setStep(4);
  };

  const handleConnectSiak = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siakNim || !siakPassword) {
      toast.warning('NIM dan Password SIAK wajib diisi!');
      return;
    }
    setIsConnectingSiak(true);
    try {
      const res = await API.post('/siak/connect', { nim: siakNim, password: siakPassword });
      if (res.data?.success) {
        setSiakConnected(true);
        toast.success('🎉 Akun SIAK Wicida berhasil terhubung!');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menghubungkan ke SIAK Wicida');
    } finally {
      setIsConnectingSiak(false);
    }
  };

  const handleConnectWeLearn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!welearnUsername || !welearnPassword) {
      toast.warning('Username dan Password WeLearn wajib diisi!');
      return;
    }
    setIsConnectingWelearn(true);
    try {
      const res = await API.post('/moodle/connect', { username: welearnUsername, password: welearnPassword });
      if (res.data?.success) {
        setWelearnConnected(true);
        toast.success('🎉 Akun LMS WeLearn berhasil terhubung!');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menghubungkan ke WeLearn');
    } finally {
      setIsConnectingWelearn(false);
    }
  };

  // Buat Invoice saat masuk ke Step 4 jika memilih Pro
  const triggerUpgradeInvoice = useCallback(async () => {
    setIsCreatingInvoice(true);
    try {
      const res = await API.post('/subscription/upgrade', { plan: 'pro' });
      const data = res.data.data;
      if (data.qr_url) {
        setPendingPayment({
          orderId: data.order_id,
          amount: data.amount,
          qrUrl: data.qr_url,
          checkoutUrl: data.checkout_url,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      console.error('Gagal membuat invoice di onboarding:', err);
    } finally {
      setIsCreatingInvoice(false);
    }
  }, []);

  useEffect(() => {
    if (step === 4 && selectedPlan === 'pro' && !pendingPayment && !isProActive) {
      triggerUpgradeInvoice();
    }
  }, [step, selectedPlan, pendingPayment, isProActive, triggerUpgradeInvoice]);

  // Real-time polling saat pending payment di Step 4
  useEffect(() => {
    if (step !== 4 || !pendingPayment || isProActive) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    pollingRef.current = setInterval(async () => {
      try {
        const sRes = await API.get('/subscription/status');
        if (!sRes.data.data.has_pending_payment && sRes.data.data.plan === 'pro') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setIsProActive(true);
          setPendingPayment(null);
          toast.success('🎉 Pembayaran berhasil! Akun Anda telah diupgrade ke PRO!');
        }
      } catch (_) {}
    }, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [step, pendingPayment, isProActive]);

  // Countdown timer 15 menit QRIS
  useEffect(() => {
    if (!pendingPayment) return;
    const expiryTime = new Date(pendingPayment.createdAt).getTime() + 15 * 60 * 1000;

    const timer = setInterval(() => {
      const remaining = expiryTime - Date.now();
      if (remaining <= 0) {
        setCountdown('EXPIRED');
        clearInterval(timer);
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${mins}:${secs.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [pendingPayment]);

  const handleSimulatePay = async () => {
    if (!pendingPayment) return;
    setIsSimulating(true);
    try {
      await API.post('/subscription/simulate-pay', { order_id: pendingPayment.orderId });
      toast.success('[DEV] Pembayaran berhasil disimulasikan!');
      setIsProActive(true);
      setPendingPayment(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Simulasi gagal');
    } finally {
      setIsSimulating(false);
    }
  };

  // Final Save & Complete Onboarding
  const handleFinalComplete = async () => {
    setIsSaving(true);
    setErrorMsg('');

    try {
      const stored = JSON.parse(localStorage.getItem('motion_user') || '{}');
      stored.timezone = timezone;
      localStorage.setItem('motion_user', JSON.stringify(stored));
    } catch (_) {}

    localStorage.setItem('motion_onboarding_done', 'true');

    try {
      await Promise.allSettled([
        updateProfile({ name: user?.name || '', timezone }),
        updatePreferences({
          workHoursStart: Number(workHoursStart),
          workHoursEnd: Number(workHoursEnd),
          breakDurationMinutes: Number(breakDurationMinutes),
          allowWeekendScheduling,
          preferredTaskTime,
        }),
      ]);
    } catch (_) {}

    setIsSaving(false);
    onComplete(connectWeLearnChoice);
  };

  const tzOptions = [
    { value: 'Asia/Jakarta', label: 'WIB - Waktu Indonesia Barat (Jakarta)' },
    { value: 'Asia/Makassar', label: 'WITA - Waktu Indonesia Tengah (Makassar)' },
    { value: 'Asia/Jayapura', label: 'WIT - Waktu Indonesia Timur (Jayapura)' },
    { value: 'UTC', label: 'UTC - Coordinated Universal Time' }
  ];

  const hoursArray = Array.from({ length: 24 }, (_, i) => i);
  const startHourOptions = hoursArray.map((h) => ({
    value: h,
    label: `Pukul ${h === 0 ? '00' : h < 10 ? '0' + h : h}:00`
  }));
  const endHourOptions = hoursArray.map((h) => ({
    value: h,
    label: `Pukul ${h === 0 ? '00' : h < 10 ? '0' + h : h}:00`
  }));

  const breakOptions = [
    { value: 5, label: '5 Menit' },
    { value: 10, label: '10 Menit' },
    { value: 15, label: '15 Menit (Rekomendasi)' },
    { value: 20, label: '20 Menit' },
    { value: 30, label: '30 Menit' }
  ];

  const taskTimeOptions = [
    { value: 'morning', label: 'Fokus Pagi Hari (09:00 - 12:00)' },
    { value: 'afternoon', label: 'Fokus Siang Hari (13:00 - 17:00)' },
    { value: 'evening', label: 'Fokus Sore/Malam (17:00 - 20:00)' }
  ];

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-white border-3 border-black shadow-neo rounded-3xl w-full max-w-2xl overflow-hidden relative my-8 animate-fadeInUp">
        
        {/* Top Accent Bar */}
        <div className="h-4 bg-neoYellow border-b-3 border-black w-full" />

        <div className="p-8 md:p-10 flex flex-col items-center">
          
          {/* Header Progress */}
          <div className="w-full flex items-center justify-between mb-8">
            <span className="text-xl font-black text-black tracking-tight">
              Motion <span className="text-xs bg-neoMint border-2 border-black px-2 py-0.5 rounded shadow-neo-sm font-bold ml-1">SETUP</span>
            </span>
            
            <div className="flex gap-1.5 items-center">
              {[1, 2, 3, 4].map((s) => (
                <div 
                  key={s}
                  className={`w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center font-black text-xs shadow-neo-sm transition-colors
                    ${step === s ? 'bg-neoYellow text-black' : step > s ? 'bg-neoMint text-black' : 'bg-white text-slate-400'}`}
                >
                  {step > s ? <Check size={12} strokeWidth={4} /> : s}
                </div>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="w-full mb-6 bg-neoOrange border-2 border-black p-3.5 rounded-xl font-bold text-white text-xs shadow-neo-sm">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* ── STEP 1: Timezone Selection ─────────────────────────────────── */}
          {step === 1 && (
            <div className="w-full flex flex-col items-center animate-fadeIn">
              <MotiClock size={110} speechBubble="Hai! Jam berapa sekarang di kotamu?" bubblePosition="top" className="mb-6" />
              
              <h2 className="text-2xl font-black text-black text-center mb-2">
                Halo {user?.name || 'Sobat Motion'}! Sesuaikan Timezone-mu
              </h2>
              <p className="text-sm font-semibold text-slate-600 text-center mb-8 max-w-md">
                Pilih zona waktu lokasimu agar AI Motion menjadwalkan tugas pada waktu yang tepat.
              </p>

              <div className="w-full max-w-md space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-black uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="w-4 h-4" /> Zona Waktu Kamu
                  </label>
                  <CustomSelect 
                    options={tzOptions} 
                    value={timezone} 
                    onChange={setTimezone} 
                  />
                </div>

                <div className="border-3 border-black bg-neoCream/30 p-4 rounded-2xl flex items-center justify-between shadow-neo-sm">
                  <div>
                    <h4 className="text-xs font-black text-black uppercase">Waktu Saat Ini:</h4>
                    <p className="text-xxs font-bold text-slate-500">Berdasarkan zona waktu terpilih</p>
                  </div>
                  <div className="bg-white border-2 border-black px-4 py-2 rounded-xl text-lg font-mono font-black text-black shadow-neo-sm">
                    {currentTime || '--:--:--'}
                  </div>
                </div>
              </div>

              <div className="w-full max-w-md mt-10">
                <button
                  type="button"
                  onClick={handleStep1Next}
                  className="w-full neo-btn bg-neoYellow text-black border-2 border-black rounded-xl py-3 text-sm font-black shadow-neo hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2 cursor-pointer"
                >
                  Lanjut ke Jam Kerja <ArrowRight size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Work Hours Preference ─────────────────────────────── */}
          {step === 2 && (
            <div className="w-full flex flex-col items-center animate-fadeIn mt-2">
              <h2 className="text-2xl font-black text-black text-center mb-2">
                Atur Jam Kerja &amp; Waktu Produktif
              </h2>
              <p className="text-sm font-semibold text-slate-600 text-center mb-8 max-w-md">
                Biarkan AI tahu kapan Anda aktif bekerja agar tidak terganggu di luar jam tersebut.
              </p>

              <div className="w-full max-w-md space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-black uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-4 h-4" /> Mulai Kerja
                    </label>
                    <CustomSelect 
                      options={startHourOptions} 
                      value={workHoursStart} 
                      onChange={setWorkHoursStart} 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-black text-black uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-4 h-4" /> Selesai Kerja
                    </label>
                    <CustomSelect 
                      options={endHourOptions} 
                      value={workHoursEnd} 
                      onChange={setWorkHoursEnd} 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-black uppercase tracking-wider flex items-center gap-1.5">
                    <Coffee className="w-4 h-4" /> Durasi Istirahat Tiap Sesi
                  </label>
                  <CustomSelect 
                    options={breakOptions} 
                    value={breakDurationMinutes} 
                    onChange={setBreakDurationMinutes} 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-black uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> Preferensi Waktu Alokasi AI
                  </label>
                  <CustomSelect 
                    options={taskTimeOptions} 
                    value={preferredTaskTime} 
                    onChange={setPreferredTaskTime} 
                  />
                </div>

                <div className="flex items-center justify-between border-2 border-black bg-neoCream/35 p-3 rounded-xl shadow-neo-sm">
                  <div>
                    <h4 className="text-xs font-black text-black">Jadwalkan di Akhir Pekan?</h4>
                    <p className="text-xxs font-bold text-slate-500">Izinkan AI memberi tugas di Sabtu/Minggu</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAllowWeekendScheduling(!allowWeekendScheduling)}
                    className={`w-12 h-6.5 rounded-lg border-2 border-black shadow-neo-sm transition-colors p-0.5 relative shrink-0 ${
                      allowWeekendScheduling ? 'bg-neoMint' : 'bg-white'
                    }`}
                  >
                    <div
                      className={`w-4.5 h-4.5 bg-black rounded transition-all ${
                        allowWeekendScheduling ? 'translate-x-5 rotate-90 bg-white' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="w-full max-w-md mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setErrorMsg(''); setStep(1); }}
                  className="w-1/3 neo-btn bg-white text-black border-2 border-black rounded-xl py-3 text-sm font-black shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft size={16} strokeWidth={2.5} /> Kembali
                </button>
                
                <button
                  type="button"
                  onClick={handleStep2Next}
                  className="flex-1 neo-btn bg-neoYellow text-black border-2 border-black rounded-xl py-3 text-sm font-black shadow-neo hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2 cursor-pointer"
                >
                  Lanjut <ArrowRight size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Multi-Platform Integrations (SIAK, WeLearn, Calendar) ──── */}
          {step === 3 && (
            <div className="w-full flex flex-col items-center animate-fadeIn">
              <StarrySparkle size={100} speechBubble="Hubungkan akun perkuliahanmu!" bubblePosition="top" className="mb-4" />
              
              <h2 className="text-2xl font-black text-black text-center mb-1">
                Integrasi Akademik &amp; Kalender
              </h2>
              <p className="text-xs font-semibold text-slate-600 text-center mb-6 max-w-md">
                Sinkronkan jadwal, nilai, dan tugas secara otomatis agar AI dapat mengatur harimu secara presisi.
              </p>

              {/* Tab Selector 3-in-1 */}
              <div className="w-full max-w-md flex border-2 border-black rounded-xl p-1 bg-neoCream/40 mb-6 gap-1 shadow-neo-sm">
                <button
                  type="button"
                  onClick={() => setIntegrationTab('siak')}
                  className={`flex-1 py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    integrationTab === 'siak' ? 'bg-neoYellow text-black border-2 border-black shadow-neo-sm' : 'text-slate-600 hover:text-black'
                  }`}
                >
                  <GraduationCap size={15} /> SIAK Wicida
                  {siakConnected && <CheckCircle2 size={13} className="text-green-600 fill-green-100" />}
                </button>

                <button
                  type="button"
                  onClick={() => setIntegrationTab('welearn')}
                  className={`flex-1 py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    integrationTab === 'welearn' ? 'bg-neoBlue text-black border-2 border-black shadow-neo-sm' : 'text-slate-600 hover:text-black'
                  }`}
                >
                  <BookOpen size={15} /> WeLearn LMS
                  {welearnConnected && <CheckCircle2 size={13} className="text-green-600 fill-green-100" />}
                </button>

                <button
                  type="button"
                  onClick={() => setIntegrationTab('calendar')}
                  className={`flex-1 py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    integrationTab === 'calendar' ? 'bg-neoMint text-black border-2 border-black shadow-neo-sm' : 'text-slate-600 hover:text-black'
                  }`}
                >
                  <Calendar size={15} /> Google Calendar
                  {calendarConnected && <CheckCircle2 size={13} className="text-green-600 fill-green-100" />}
                </button>
              </div>

              {/* Tab 1: SIAK Wicida */}
              {integrationTab === 'siak' && (
                <div className="w-full max-w-md bg-white border-2 border-black rounded-2xl p-5 shadow-neo-sm space-y-4 text-left">
                  <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3">
                    <div>
                      <h4 className="text-xs font-black text-black uppercase flex items-center gap-1.5">
                        <GraduationCap size={16} className="text-neoOrange" /> Hubungkan SIAK Wicida
                      </h4>
                      <p className="text-[10px] font-bold text-slate-500">Impor IPK, transkrip nilai, jadwal kuliah &amp; jadwal ujian.</p>
                    </div>
                  </div>

                  {siakConnected ? (
                    <div className="bg-neoMint/30 border-2 border-black p-3.5 rounded-xl text-xs font-black text-black flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 size={16} className="text-green-600" /> Terhubung ke SIAK Wicida
                      </span>
                      <span className="text-[10px] bg-white border border-black px-2 py-0.5 rounded font-mono">NIM: {siakNim}</span>
                    </div>
                  ) : (
                    <form onSubmit={handleConnectSiak} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-black block">NIM Mahasiswa</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            value={siakNim}
                            onChange={(e) => setSiakNim(e.target.value)}
                            placeholder="Contoh: 2343092"
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border-2 border-black rounded-xl text-xs font-bold text-black focus:outline-none focus:bg-white"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-black block">Password SIAK</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="password"
                            value={siakPassword}
                            onChange={(e) => setSiakPassword(e.target.value)}
                            placeholder="Password portal SIAK"
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border-2 border-black rounded-xl text-xs font-bold text-black focus:outline-none focus:bg-white"
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isConnectingSiak}
                        className="w-full py-2.5 bg-neoYellow text-black border-2 border-black rounded-xl text-xs font-black shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isConnectingSiak ? (
                          <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menghubungkan...</>
                        ) : (
                          <><GraduationCap size={15} /> Hubungkan Akun SIAK</>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Tab 2: WeLearn LMS */}
              {integrationTab === 'welearn' && (
                <div className="w-full max-w-md bg-white border-2 border-black rounded-2xl p-5 shadow-neo-sm space-y-4 text-left">
                  <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3">
                    <div>
                      <h4 className="text-xs font-black text-black uppercase flex items-center gap-1.5">
                        <BookOpen size={16} className="text-neoBlue" /> Hubungkan WeLearn LMS
                      </h4>
                      <p className="text-[10px] font-bold text-slate-500">Tarik deadline tugas kuliah &amp; materi otomatis.</p>
                    </div>
                  </div>

                  {welearnConnected ? (
                    <div className="bg-neoBlue/20 border-2 border-black p-3.5 rounded-xl text-xs font-black text-black flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 size={16} className="text-blue-600" /> Terhubung ke WeLearn LMS
                      </span>
                      <span className="text-[10px] bg-white border border-black px-2 py-0.5 rounded font-mono">{welearnUsername}</span>
                    </div>
                  ) : (
                    <form onSubmit={handleConnectWeLearn} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-black block">Username WeLearn</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            value={welearnUsername}
                            onChange={(e) => setWelearnUsername(e.target.value)}
                            placeholder="Username LMS Moodle/WeLearn"
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border-2 border-black rounded-xl text-xs font-bold text-black focus:outline-none focus:bg-white"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-black block">Password WeLearn</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="password"
                            value={welearnPassword}
                            onChange={(e) => setWelearnPassword(e.target.value)}
                            placeholder="Password portal WeLearn"
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border-2 border-black rounded-xl text-xs font-bold text-black focus:outline-none focus:bg-white"
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isConnectingWelearn}
                        className="w-full py-2.5 bg-neoBlue text-black border-2 border-black rounded-xl text-xs font-black shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isConnectingWelearn ? (
                          <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menghubungkan...</>
                        ) : (
                          <><BookOpen size={15} /> Hubungkan Akun WeLearn</>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Tab 3: Google Calendar */}
              {integrationTab === 'calendar' && (
                <div className="w-full max-w-md bg-white border-2 border-black rounded-2xl p-5 shadow-neo-sm space-y-4 text-left">
                  <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3">
                    <div>
                      <h4 className="text-xs font-black text-black uppercase flex items-center gap-1.5">
                        <Calendar size={16} className="text-neoMint" /> Google / Outlook Calendar
                      </h4>
                      <p className="text-[10px] font-bold text-slate-500">Cegah jadwal bentrok dengan sinkronisasi 2 arah.</p>
                    </div>
                  </div>

                  <div className="bg-neoCream/30 border-2 border-black p-4 rounded-xl space-y-3">
                    <p className="text-xs font-semibold text-slate-700">
                      Dengan mengintegrasikan Google Calendar, AI Motion akan secara otomatis menghitung slot jam kerja dan tidak membagi tugas saat ada rapat atau agenda keluarga.
                    </p>
                    <a
                      href="/api/v1/calendar/connect"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setCalendarConnected(true)}
                      className="w-full neo-btn bg-neoMint text-black border-2 border-black rounded-xl py-2.5 text-xs font-black shadow-neo-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Calendar size={15} /> Hubungkan Google Calendar <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              )}

              {/* Navigation Action */}
              <div className="w-full max-w-md mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-1/3 neo-btn bg-white text-black border-2 border-black rounded-xl py-3 text-sm font-black shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft size={16} strokeWidth={2.5} /> Kembali
                </button>
                
                <button
                  type="button"
                  onClick={() => handleStep3Next(welearnConnected)}
                  className="flex-1 neo-btn bg-neoYellow text-black border-2 border-black rounded-xl py-3 text-sm font-black shadow-neo hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-neo-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  Lanjut ke Pilih Paket <ArrowRight size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Aktivasi Paket & QRIS Pembayaran ───────────────────── */}
          {step === 4 && (
            <div className="w-full flex flex-col items-center animate-fadeIn">
              <h2 className="text-2xl font-black text-black text-center mb-1">
                Aktivasi Pembayaran Paket Pro
              </h2>
              <p className="text-xs font-semibold text-slate-600 text-center mb-6 max-w-md">
                Lakukan scan QRIS di bawah ini untuk mengaktifkan keanggotaan Pro Rp 30.000/bulan secara instan.
              </p>

              {/* Card Informasi Paket Pro */}
              <div className="w-full max-w-md border-2 border-black bg-neoYellow rounded-2xl p-4 shadow-neo-sm mb-6 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-black/70">Paket Keanggotaan</span>
                  <h4 className="text-lg font-black text-black flex items-center gap-1.5">
                    Motion Pro <Zap size={14} className="fill-black" />
                  </h4>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-black">Rp 30.000</div>
                  <span className="text-[10px] font-bold text-black/80">/ bulan</span>
                </div>
              </div>

              {/* Tampilan QRIS Pembayaran PRO */}
              <div className="w-full max-w-md border-3 border-black bg-white rounded-2xl p-5 shadow-neo mb-6 flex flex-col items-center text-center space-y-3">
                  {isProActive ? (
                    <div className="bg-neoMint border-2 border-black p-4 rounded-xl font-black text-black flex items-center justify-center gap-2 w-full">
                      <ShieldCheck size={20} />
                      <span>🎉 Akses PRO Aktif! Selamat Datang di Motion Pro!</span>
                    </div>
                  ) : isCreatingInvoice ? (
                    <div className="py-8 flex flex-col items-center">
                      <RefreshCw className="animate-spin text-black mb-2" size={24} />
                      <p className="text-xs font-black">Membuat Invoice QRIS Midtrans...</p>
                    </div>
                  ) : pendingPayment?.qrUrl ? (
                    <>
                      <div className="w-full flex justify-between items-center border-b-2 border-black pb-2 text-left">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-black">Menunggu Scan QRIS</span>
                          <p className="text-[9px] font-mono text-zinc-500">{pendingPayment.orderId}</p>
                        </div>
                        <span className="text-xs font-black text-black bg-neoYellow border border-black px-2 py-0.5 rounded shadow-neo-sm">
                          Rp 30.000
                        </span>
                      </div>

                      <div className="bg-white border-2 border-black p-3 rounded-xl shadow-neo-sm">
                        <img src={pendingPayment.qrUrl} alt="QRIS Midtrans" className="w-40 h-40 mx-auto" />
                        <div className="text-[9px] font-black text-black mt-1.5 uppercase flex items-center justify-center gap-1">
                          <QrCode size={10} /> Scan dengan E-Wallet / Mobile Banking
                        </div>
                        {countdown && (
                          <div className="text-[9px] font-mono font-bold text-zinc-600 mt-1">
                            Kedaluwarsa: {countdown}
                          </div>
                        )}
                      </div>

                      {/* Tombol Simulasi Dev Mode */}
                      {process.env.NODE_ENV === 'development' && (
                        <button
                          type="button"
                          onClick={handleSimulatePay}
                          disabled={isSimulating}
                          className="w-full neo-btn bg-neoMint text-black text-xs font-black py-2 px-3 rounded-xl border-2 border-black shadow-neo-sm flex items-center justify-center gap-1 cursor-pointer"
                        >
                          {isSimulating ? <RefreshCw className="animate-spin" size={12} /> : <Zap size={12} className="fill-black" />}
                          <span>[DEV MOCK] Simulasikan Pembayaran Berhasil</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="py-4">
                      <p className="text-xs font-bold text-slate-600">Klik tombol di bawah untuk membuat QRIS pembayaran.</p>
                      <button
                        type="button"
                        onClick={triggerUpgradeInvoice}
                        className="mt-2 neo-btn bg-neoYellow text-black text-xs font-black py-2 px-4 border-2 border-black rounded-xl shadow-neo-sm"
                      >
                        Generate QRIS Pembayaran
                      </button>
                    </div>
                  )}
                </div>

              {/* Navigation Complete */}
              <div className="w-full max-w-md space-y-3">
                <button
                  type="button"
                  onClick={handleFinalComplete}
                  disabled={isSaving}
                  className="w-full neo-btn bg-neoMint text-black border-2 border-black rounded-xl py-3.5 text-sm font-black shadow-neo hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isSaving ? (
                    <><Loader className="w-4 h-4 animate-spin" /> Menyimpan...</>
                  ) : (
                    <>Selesai &amp; Masuk Dashboard 🚀</>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={isSaving}
                  className="w-full neo-btn bg-white text-black border-2 border-black rounded-xl py-2.5 text-xs font-black shadow-neo-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft size={14} strokeWidth={2.5} /> Kembali ke Setup
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
