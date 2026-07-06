import React, { useState, useEffect } from 'react';
import { RefreshCw, Link2, Link2Off, AlertCircle, CheckCircle2, Loader, ExternalLink, Info } from 'lucide-react';
import { useMoodle } from '../../hooks/useMoodle';

export default function MoodleTab() {
  const { status, isLoading, error, fetchStatus, connect, disconnect, syncNow, clearError } = useMoodle();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    const ok = await connect(username, password);
    if (ok) {
      setUsername('');
      setPassword('');
      setShowForm(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Apakah Anda yakin ingin memutuskan hubungan dengan WeLearn Moodle? Semua data tugas WeLearn lokal Anda akan dihapus.')) return;
    await disconnect();
  };

  if (status?.isConnected) {
    return (
      <div className="space-y-6">
        {/* Status Card (Neobrutalism) */}
        <div className="bg-neoYellow border-3 border-black shadow-neo rounded-2xl p-6 text-left relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <h3 className="text-base font-black text-black flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-black shrink-0" /> WeLearn STMIK Wicida Terhubung
              </h3>
              <p className="text-sm font-semibold text-black/80 leading-normal">
                Akun Sinkronisasi: <span className="font-mono font-black bg-white/50 border border-black/10 px-2 py-0.5 rounded text-xs">{status.moodleUsername}</span>
              </p>
              {status.lastSyncAt && (
                <p className="text-[10px] font-bold text-black/50">
                  Sinkronisasi Terakhir: {new Date(status.lastSyncAt).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
            
            <div className="w-10 h-10 rounded-lg bg-white border-2 border-black flex items-center justify-center text-black shadow-neo-sm transform rotate-6 shrink-0">
              <Link2 className="w-5 h-5 text-black" />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4">
          <button
            onClick={syncNow}
            disabled={isLoading}
            className="neo-btn bg-white text-black border-2 border-black rounded-xl py-2.5 px-4 text-xs font-black shadow-neo-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}
          </button>

          <button
            onClick={handleDisconnect}
            disabled={isLoading}
            className="neo-btn bg-neoOrange text-white border-2 border-black rounded-xl py-2.5 px-4 text-xs font-black shadow-neo-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Link2Off className="w-3.5 h-3.5 text-white" />
            Putuskan Hubungan
          </button>
        </div>

        {/* UX Helper Tips Card */}
        <div className="bg-[#FAF9F5] border-2 border-black rounded-xl p-4 text-left shadow-[2px_2px_0px_#000] flex items-start gap-3 mt-4">
          <div className="p-1.5 bg-neoBlue/15 border border-black rounded-lg shrink-0 mt-0.5">
            <Info size={14} className="text-black" />
          </div>
          <div className="space-y-1">
            <h5 className="text-xs font-black text-black">💡 Akses Tugas Instan Sekali Klik</h5>
            <p className="text-[11px] font-semibold text-black/70 leading-normal">
              Agar tombol <strong>"Buka di WeLearn"</strong> dapat membuka tugas secara langsung tanpa meminta masuk ulang, pastikan Anda mencentang opsi <strong>"Ingat username"</strong> saat masuk ke portal WeLearn di peramban Anda.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Info (Neobrutalism Card) */}
      <div className="bg-white border-3 border-black shadow-neo rounded-2xl p-6 text-left">
        <h4 className="text-base font-black text-black">Integrasi Akademik WeLearn Moodle</h4>
        <p className="text-xs font-semibold text-black/70 mt-1 leading-relaxed">
          Hubungkan akun WeLearn STMIK Wicida Anda untuk menyinkronkan daftar kuis, tugas, dan deadline praktikum Anda secara real-time ke asisten penjadwalan AI Motion.
        </p>
      </div>

      {!showForm ? (
        <button
          onClick={() => {
            clearError();
            setShowForm(true);
          }}
          className="neo-btn bg-neoYellow text-black border-2 border-black rounded-xl py-3 px-6 text-xs font-black shadow-neo hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm active:translate-x-[3px] active:translate-y-[3px] active:shadow-none flex items-center justify-center gap-2 cursor-pointer"
        >
          <Link2 className="w-4 h-4 text-black shrink-0" />
          Hubungkan Akun WeLearn
        </button>
      ) : (
        <form onSubmit={handleConnect} className="bg-white border-3 border-black shadow-neo rounded-2xl p-6 space-y-4 max-w-lg text-left">
          <h4 className="text-sm font-black text-black border-b-2 border-black pb-2 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-black shrink-0" /> Kredensial WeLearn STMIK Wicida
          </h4>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-black uppercase tracking-wider">Username / NIM</label>
            <input
              type="text"
              required
              placeholder="Masukkan NIM Anda (contoh: 2160...)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full neo-input rounded-xl px-4 py-2.5 text-sm"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-black uppercase tracking-wider">Password WeLearn</label>
            <input
              type="password"
              required
              placeholder="Masukkan password Moodle Anda"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full neo-input rounded-xl px-4 py-2.5 text-sm"
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="bg-neoOrange/20 border-2 border-neoOrange rounded-xl p-3 flex items-start gap-2 text-left">
              <AlertCircle className="w-4 h-4 text-neoOrange mt-0.5 shrink-0" />
              <span className="text-xs font-bold text-neoOrange leading-snug">{error}</span>
            </div>
          )}

          <div className="flex gap-4 pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 neo-btn bg-neoYellow text-black border-2 border-black rounded-xl py-2.5 text-xs font-black shadow-neo-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin text-black" /> Memverifikasi...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 text-black shrink-0" /> Hubungkan Sekarang
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="neo-btn bg-white text-black border-2 border-black rounded-xl py-2.5 px-4 text-xs font-black shadow-neo-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none cursor-pointer"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {/* UX Helper Tips Card */}
      <div className="bg-[#FAF9F5] border-2 border-black rounded-2xl p-4 text-left shadow-[3px_3px_0px_#000] flex items-start gap-3 max-w-lg mt-2">
        <div className="p-2 bg-neoBlue/15 border-2 border-black rounded-xl shrink-0 mt-0.5 shadow-[1.5px_1.5px_0px_#000]">
          <Info size={14} className="text-black" />
        </div>
        <div className="space-y-1">
          <h5 className="text-xs font-black text-black">💡 Tips Akses Tugas Langsung Sekali Klik</h5>
          <p className="text-[11px] font-semibold text-black/70 leading-relaxed">
            Agar tombol <strong>"Buka di WeLearn"</strong> dapat membuka tugas secara instan tanpa meminta masuk ulang, pastikan Anda mencentang opsi <strong>"Ingat username"</strong> saat masuk ke portal WeLearn di peramban Anda. Peramban akan menjaga sesi tetap aktif selama beberapa minggu.
          </p>
        </div>
      </div>
    </div>
  );
}
