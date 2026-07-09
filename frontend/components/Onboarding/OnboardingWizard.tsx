'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useScheduling } from '@/hooks/useScheduling';
import CustomSelect from '@/components/ui/CustomSelect';
import { Clock, Coffee, Sparkles, Check, ArrowRight, ArrowLeft, Loader, Globe } from 'lucide-react';

interface OnboardingWizardProps {
  onComplete: (navigateToIntegrations?: boolean) => void;
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

  // Saving state hanya untuk step 3 (final save)
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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

  // ─── Step navigation: MURNI LOKAL, tidak ada API call ───────────────────────

  const handleStep1Next = () => {
    // Validasi timezone
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

  // ─── Final save: semua data disimpan sekaligus di step 3 ────────────────────

  const handleComplete = async (connectWeLearn: boolean) => {
    setIsSaving(true);
    setErrorMsg('');

    // Simpan ke localStorage dulu sebagai fallback (instant, tidak bisa gagal)
    try {
      const stored = JSON.parse(localStorage.getItem('motion_user') || '{}');
      stored.timezone = timezone;
      localStorage.setItem('motion_user', JSON.stringify(stored));
    } catch (_) {}

    // Tandai onboarding selesai langsung — agar tidak muncul lagi meski API gagal
    localStorage.setItem('motion_onboarding_done', 'true');

    // Kirim ke backend secara paralel (fire-and-forget style: tidak blokir navigasi)
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
    } catch (_) {
      // Jika API gagal, data sudah tersimpan di localStorage
      // Backend akan sync saat user mengubah preferences manual
    }

    setIsSaving(false);
    onComplete(connectWeLearn);
  };

  // ─── Select Options Data ─────────────────────────────────────────────────────

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
        
        {/* Top Accent Color Bar */}
        <div className="h-4 bg-neoYellow border-b-3 border-black w-full" />

        <div className="p-8 md:p-10 flex flex-col items-center">
          
          {/* Header */}
          <div className="w-full flex items-center justify-between mb-8">
            <span className="text-xl font-black text-black tracking-tight">
              Motion <span className="text-xs bg-neoMint border-2 border-black px-2 py-0.5 rounded shadow-neo-sm font-bold ml-1">SETUP</span>
            </span>
            
            {/* Neobrutalist Progress Indicator */}
            <div className="flex gap-1.5 items-center">
              {[1, 2, 3].map((s) => (
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

              {/* Timezone Select */}
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

                {/* Clock Preview */}
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

              {/* Navigation */}
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
            <div className="w-full flex flex-col items-center animate-fadeIn mt-6">
              
              <h2 className="text-2xl font-black text-black text-center mb-2">
                Atur Jam Kerja &amp; Waktu Produktif
              </h2>
              <p className="text-sm font-semibold text-slate-600 text-center mb-8 max-w-md">
                Biarkan AI tahu kapan Anda aktif bekerja agar tidak terganggu di luar jam tersebut.
              </p>

              {/* Time preferences form */}
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

                {/* Weekend Toggle */}
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

              {/* Navigation */}
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

          {/* ── STEP 3: WeLearn Connect + Final Save ──────────────────────── */}
          {step === 3 && (
            <div className="w-full flex flex-col items-center animate-fadeIn">
              <StarrySparkle size={110} speechBubble="Siap sinkronkan kuliahmu ke AI?" bubblePosition="top" className="mb-6" />
              
              <h2 className="text-2xl font-black text-black text-center mb-2">
                Hubungkan LMS WeLearn
              </h2>
              <p className="text-sm font-semibold text-slate-600 text-center mb-8 max-w-md">
                Tarik tugas kuliah secara otomatis! AI akan menjawab, membuat rangkuman, dan menyusun jadwal tugasmu dalam sekejap.
              </p>

              {/* Mascot Info Box */}
              <div className="w-full max-w-md border-3 border-black bg-neoBlue/10 p-5 rounded-2xl shadow-neo-sm text-left border-l-8 border-l-neoBlue">
                <h4 className="text-xs font-black text-black uppercase mb-1 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-neoBlue" /> Mengapa Menghubungkan WeLearn?
                </h4>
                <ul className="text-xxs font-bold text-slate-700 space-y-1 list-disc pl-4 mt-2">
                  <li>AI mendeteksi tenggat waktu tugas kuliah terbaru otomatis.</li>
                  <li>Dapatkan bahan rangkuman instan dan draf jawaban tugas.</li>
                  <li>Generate Excuse Letter resmi jika berhalangan hadir.</li>
                </ul>
              </div>

              {/* Ringkasan setup yang dipilih */}
              <div className="w-full max-w-md mt-4 border-2 border-black bg-neoCream/30 p-4 rounded-2xl shadow-neo-sm">
                <h4 className="text-xs font-black text-black uppercase mb-2 flex items-center gap-1.5">
                  <Check size={14} className="text-neoMint" /> Ringkasan Setup Kamu
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xxs font-bold text-slate-700">
                  <span>🌏 Timezone:</span>
                  <span className="text-black">{tzOptions.find(t => t.value === timezone)?.label?.split(' – ')[0] || timezone}</span>
                  <span>🕐 Jam Kerja:</span>
                  <span className="text-black">{String(workHoursStart).padStart(2,'0')}:00 – {String(workHoursEnd).padStart(2,'0')}:00</span>
                  <span>☕ Istirahat:</span>
                  <span className="text-black">{breakDurationMinutes} menit/sesi</span>
                  <span>⚡ Fokus AI:</span>
                  <span className="text-black">{taskTimeOptions.find(t => t.value === preferredTaskTime)?.label?.split(' (')[0]}</span>
                </div>
              </div>

              {/* Navigation */}
              <div className="w-full max-w-md mt-6 space-y-3">
                <button
                  type="button"
                  onClick={() => handleComplete(true)}
                  disabled={isSaving}
                  className="w-full neo-btn bg-neoBlue text-black border-2 border-black rounded-xl py-3.5 text-sm font-black shadow-neo hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isSaving ? (
                    <><Loader className="w-4 h-4 animate-spin" /> Menyimpan Setup...</>
                  ) : (
                    <>Hubungkan WeLearn Sekarang 🚀</>
                  )}
                </button>
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={isSaving}
                    className="w-1/3 neo-btn bg-white text-black border-2 border-black rounded-xl py-3.5 text-sm font-black shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    <ArrowLeft size={16} strokeWidth={2.5} /> Kembali
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handleComplete(false)}
                    disabled={isSaving}
                    className="flex-1 neo-btn bg-neoCream/50 text-slate-700 border-2 border-black rounded-xl py-3.5 text-sm font-black shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-none flex items-center justify-center cursor-pointer disabled:opacity-60"
                  >
                    {isSaving ? (
                      <><Loader className="w-4 h-4 animate-spin" /></>
                    ) : (
                      <>Lewati, Masuk Dashboard 🚪</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
