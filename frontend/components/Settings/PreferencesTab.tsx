import React, { useState, useEffect } from 'react';
import { Clock, Coffee, Calendar, ShieldAlert, CheckCircle, Sparkles, Loader } from 'lucide-react';
import { useScheduling } from '../../hooks/useScheduling';
import CustomSelect from '../ui/CustomSelect';

export default function PreferencesTab() {
  const { preferences, fetchPreferences, updatePreferences, isLoading, error } = useScheduling();
  const [success, setSuccess] = useState(false);

  // State form lokal
  const [workHoursStart, setWorkHoursStart] = useState(9);
  const [workHoursEnd, setWorkHoursEnd] = useState(18);
  const [breakDurationMinutes, setBreakDurationMinutes] = useState(15);
  const [allowWeekendScheduling, setAllowWeekendScheduling] = useState(false);
  const [preferredTaskTime, setPreferredTaskTime] = useState('morning');

  // Muat data preferensi saat pertama kali dipasang
  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  // Sinkronkan state lokal saat preferensi dimuat dari backend
  useEffect(() => {
    if (preferences) {
      setWorkHoursStart(preferences.workHoursStart);
      setWorkHoursEnd(preferences.workHoursEnd);
      setBreakDurationMinutes(preferences.breakDurationMinutes);
      setAllowWeekendScheduling(preferences.allowWeekendScheduling);
      setPreferredTaskTime(preferences.preferredTaskTime);
    }
  }, [preferences]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    
    const ok = await updatePreferences({
      workHoursStart: Number(workHoursStart),
      workHoursEnd: Number(workHoursEnd),
      breakDurationMinutes: Number(breakDurationMinutes),
      allowWeekendScheduling,
      preferredTaskTime,
    });

    if (ok) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  const hoursArray = Array.from({ length: 24 }, (_, i) => i);

  const startHourOptions = hoursArray.map((h) => {
    const ampm = h >= 12 ? 'Siang/Sore' : 'Pagi';
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return {
      value: h,
      label: `Pukul ${displayH}:00 (${ampm})`
    };
  });

  const endHourOptions = hoursArray.map((h) => {
    const ampm = h >= 12 ? 'Siang/Malam' : 'Pagi';
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return {
      value: h,
      label: `Pukul ${displayH}:00 (${ampm})`
    };
  });

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
    <div className="space-y-6">
      {/* Pengantar Preferensi (Neobrutalism Card) */}
      <div className="bg-white border-3 border-black shadow-neo rounded-2xl p-6 text-left">
        <h3 className="text-lg font-black text-black mb-2 flex items-center gap-2 border-b-2 border-black pb-3">
          <Clock className="w-5.5 h-5.5 text-black shrink-0" /> Pengaturan Preferensi Kerja
        </h3>
        <p className="text-sm font-semibold text-black/80 leading-relaxed mt-2">
          Sesuaikan jam aktif kerja dan kriteria waktu Anda. Algoritma AI Motion akan mempelajari batasan-batasan ini untuk secara otomatis menjadwalkan tugas harian Anda agar terhindar dari kelelahan (*burnout*).
        </p>
      </div>

      {/* Pesan Sukses / Error (Neobrutalist Box) */}
      {success && (
        <div className="bg-neoMint border-2 border-black text-black text-xs font-black rounded-xl p-4 flex items-center gap-2 text-left shadow-neo-sm animate-bounce">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>Pengaturan preferensi kerja Anda berhasil disimpan dan diterapkan pada algoritma penjadwalan AI!</span>
        </div>
      )}

      {error && (
        <div className="bg-neoOrange border-2 border-black text-white text-xs font-black rounded-xl p-4 flex items-center gap-2 text-left shadow-neo-sm">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Gagal memperbarui pengaturan: {error}</span>
        </div>
      )}

      {/* Form Preferensi (Neobrutalism Card) */}
      <form onSubmit={handleSubmit} className="bg-white border-3 border-black shadow-neo rounded-2xl p-6 text-left space-y-6">
        
        {/* Pembatas Jam Kerja */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-black uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-black" /> Jam Mulai Kerja
            </label>
            <CustomSelect
              options={startHourOptions}
              value={workHoursStart}
              onChange={setWorkHoursStart}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-black uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-black" /> Jam Selesai Kerja
            </label>
            <CustomSelect
              options={endHourOptions}
              value={workHoursEnd}
              onChange={setWorkHoursEnd}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Istirahat & Preferensi AI */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t-2 border-black pt-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-black uppercase tracking-wider flex items-center gap-1.5">
              <Coffee className="w-4 h-4 text-black" /> Durasi Jeda Istirahat
            </label>
            <CustomSelect
              options={breakOptions}
              value={breakDurationMinutes}
              onChange={setBreakDurationMinutes}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-black uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-black" /> Preferensi Waktu Alokasi AI
            </label>
            <CustomSelect
              options={taskTimeOptions}
              value={preferredTaskTime}
              onChange={setPreferredTaskTime}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Akhir Pekan Toggle */}
        <div className="flex items-center justify-between gap-4 border-t-2 border-black pt-6 bg-neoCream/30 p-4 rounded-xl border-2">
          <div className="space-y-1">
            <label className="text-sm font-black text-black flex items-center gap-1.5">
              <Calendar className="w-4.5 h-4.5 text-black" /> Izinkan Penjadwalan Akhir Pekan
            </label>
            <p className="text-xs font-bold text-black/60">
              Jika diaktifkan, AI dapat mengalokasikan tugas Anda di hari Sabtu dan Minggu.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAllowWeekendScheduling(!allowWeekendScheduling)}
            className={`w-14 h-7 rounded-lg transition-all relative p-1 shrink-0 border-2 border-black shadow-neo-sm cursor-pointer ${
              allowWeekendScheduling ? 'bg-neoMint' : 'bg-white'
            }`}
            disabled={isLoading}
          >
            <div
              className={`w-4 h-4 bg-black rounded border border-black transition-all ${
                allowWeekendScheduling ? 'translate-x-6 rotate-90 bg-white' : 'translate-x-0'
              }`}
            ></div>
          </button>
        </div>

        {/* Tombol Simpan */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full neo-btn bg-neoYellow text-black rounded-xl py-3.5 text-sm font-black shadow-neo hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm active:translate-x-[3px] active:translate-y-[3px] active:shadow-none flex items-center justify-center gap-2 mt-8"
        >
          {isLoading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" /> Menyimpan Pengaturan...
            </>
          ) : (
            <>
              Simpan & Terapkan Preferensi AI <Sparkles className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
