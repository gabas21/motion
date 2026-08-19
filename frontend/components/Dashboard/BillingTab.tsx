'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  Sparkles, Check, CreditCard, AlertCircle, RefreshCw, 
  ExternalLink, QrCode, ShieldCheck, Zap, Info, Clock, Receipt
} from 'lucide-react';
import API from '../../lib/api';
import { toast } from '../../hooks/useToast';

interface Quota {
  plan: string;
  taskQuota: { used: number; limit: number };
  chatQuota: { used: number; limit: number };
}

interface PendingPayment {
  id: string;
  orderId: string;
  plan: string;
  amount: number;
  qrUrl: string;
  checkoutUrl: string;
  status: string;
  createdAt: string;
}

interface HistoryItem {
  id: string;
  orderId: string;
  plan: string;
  amount: number;
  status: string;
  paymentGateway: string;
  createdAt: string;
  expiresAt?: string;
}

export default function BillingTab() {
  const [quota, setQuota] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [countdown, setCountdown] = useState<string>('');
  const [simulating, setSimulating] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      // Ambil status kuota
      const qRes = await API.get('/users/quota');
      setQuota(qRes.data.data);

      // Ambil status subscription
      const sRes = await API.get('/subscription/status');
      if (sRes.data.data.has_pending_payment) {
        const p = sRes.data.data.pending_payment;
        setPendingPayment({
          id: p.id,
          orderId: p.orderId,
          plan: p.plan,
          amount: p.amount,
          qrUrl: p.qrUrl,
          checkoutUrl: p.checkoutUrl,
          status: p.status,
          createdAt: p.createdAt,
        });
      } else {
        setPendingPayment(null);
      }

      // Ambil riwayat transaksi
      const hRes = await API.get('/subscription/history');
      setHistory(hRes.data.data?.history || []);
    } catch (err: any) {
      console.error('Gagal mengambil status billing:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Polling status real-time saat ada pending payment
  useEffect(() => {
    if (!pendingPayment) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    pollingRef.current = setInterval(async () => {
      try {
        const sRes = await API.get('/subscription/status');
        if (!sRes.data.data.has_pending_payment && sRes.data.data.plan === 'pro') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          toast.success('🎉 Pembayaran berhasil! Akun Anda telah diupgrade ke PRO!');
          fetchStatus();
        }
      } catch (_) {}
    }, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [pendingPayment, fetchStatus]);

  // Countdown timer 15 menit untuk QRIS pending
  useEffect(() => {
    if (!pendingPayment) return;
    const expiryTime = new Date(pendingPayment.createdAt).getTime() + 15 * 60 * 1000;

    const timer = setInterval(() => {
      const remaining = expiryTime - Date.now();
      if (remaining <= 0) {
        setCountdown('EXPIRED');
        clearInterval(timer);
        fetchStatus();
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${mins}:${secs.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [pendingPayment, fetchStatus]);

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const res = await API.post('/subscription/upgrade', { plan: 'pro' });
      const data = res.data.data;

      if (data.existing) {
        toast.info(res.data.message || 'Pembayaran Anda sedang menunggu penyelesaian.');
      } else {
        toast.success('Invoice pembayaran berhasil dibuat! Silakan lakukan scan QRIS.');
      }

      if (data.qr_url) {
        setPendingPayment({
          id: data.order_id,
          orderId: data.order_id,
          plan: 'pro',
          amount: data.amount,
          qrUrl: data.qr_url,
          checkoutUrl: data.checkout_url,
          status: 'pending',
          createdAt: new Date().toISOString()
        });
      }
      fetchStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal memulai upgrade langganan.');
    } finally {
      setUpgrading(false);
    }
  };

  const handleSimulatePay = async () => {
    if (!pendingPayment) return;
    setSimulating(true);
    try {
      await API.post('/subscription/simulate-pay', { order_id: pendingPayment.orderId });
      toast.success('[DEV] Simulasi pembayaran sukses dikirim! Akun Anda diupgrade ke PRO.');
      fetchStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Simulasi pembayaran gagal.');
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RefreshCw className="animate-spin text-black mb-3" size={32} />
        <p className="text-sm font-black uppercase text-black">Mengambil status langganan...</p>
      </div>
    );
  }

  const isPro = quota?.plan === 'pro';

  return (
    <div className="max-w-4xl mx-auto space-y-8 text-left">
      {/* Header Plan Status */}
      <div className="bg-neoCream border-3 border-black p-6 rounded-2xl shadow-neo flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <span className="text-[10px] font-black text-white bg-black px-2.5 py-1 rounded-full uppercase tracking-wider">
            PLAN SAAT INI
          </span>
          <h2 className="text-2xl font-black mt-2 flex items-center gap-2">
            {isPro ? (
              <>
                PRO/PREMIUM <Sparkles className="text-neoYellow shrink-0 w-6 h-6 fill-neoYellow" />
              </>
            ) : (
              'FREE/GRATIS'
            )}
          </h2>
          <p className="text-xs font-semibold text-gray-700 mt-1 leading-relaxed">
            {isPro 
              ? 'Anda memiliki akses premium tanpa batasan ke semua fitur cerdas Motion.' 
              : 'Anda sedang menggunakan paket dasar gratis dengan batasan kuota fitur.'}
          </p>
        </div>

        <div className="flex flex-col gap-2 w-full md:w-auto">
          {isPro ? (
            <div className="bg-neoMint border-2 border-black px-5 py-3 rounded-xl shadow-neo-sm font-black text-center flex items-center justify-center gap-2">
              <ShieldCheck className="text-black" size={20} />
              <span>Akses Premium Aktif</span>
            </div>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={upgrading}
              className="neo-btn bg-neoYellow text-black font-black px-6 py-3 rounded-xl border-2 border-black shadow-neo hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-neo-sm transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {upgrading ? (
                <>
                  <RefreshCw className="animate-spin" size={16} /> Memproses...
                </>
              ) : (
                <>
                  Upgrade ke PRO <Zap size={16} className="fill-black" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left: Detail Paket Pro */}
        <div className="bg-white border-3 border-black shadow-neo rounded-2xl p-6 space-y-6">
          <h3 className="text-lg font-black border-b-2 border-black pb-3">
            ✨ Kenapa Harus Paket Pro?
          </h3>

          <div className="space-y-4">
            {[
              { title: 'Tugas Kerja Tanpa Batas', desc: 'Buat tugas sebanyak mungkin tanpa batasan limit bulanan.' },
              { title: 'AI Obrolan Tanpa Batas', desc: 'Konsultasikan tugas & materi kuliah dengan Asep AI kapan saja.' },
              { title: '5 Koneksi Kalender Eksternal', desc: 'Sinkronisasikan Google Calendar & Outlook secara bersamaan.' },
              { title: 'Prioritas Penjadwalan AI', desc: 'Slot belajar AI disesuaikan dengan ritme produktivitas Anda secara real-time.' },
            ].map((item, idx) => (
              <div key={idx} className="flex gap-3 items-start">
                <div className="w-5 h-5 rounded-full bg-neoMint border border-black flex items-center justify-center shrink-0 mt-0.5 shadow-neo-sm">
                  <Check size={12} className="text-black stroke-[3]" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-black leading-none">{item.title}</h4>
                  <p className="text-xxs text-gray-700 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-neoCream border border-black p-4 rounded-xl text-xxs font-semibold text-zinc-700 leading-relaxed flex gap-2">
            <Info size={16} className="text-black shrink-0" />
            <span>
              Paket Pro seharga <strong>Rp 30.000 / bulan</strong>. Pembayaran menggunakan QRIS (GoPay, OVO, Dana, ShopeePay, LinkAja, Mobile Banking).
            </span>
          </div>
        </div>

        {/* Right: Payment QRIS / Pending Invoice */}
        <div className="space-y-6">
          {pendingPayment ? (
            <div className="bg-white border-3 border-black shadow-neo rounded-2xl p-6 flex flex-col items-center text-center space-y-4">
              <div className="w-full flex justify-between items-center border-b-2 border-black pb-3 text-left">
                <div>
                  <h4 className="text-xs font-black text-black uppercase tracking-wider">Menunggu Pembayaran</h4>
                  <span className="text-[10px] font-mono text-zinc-500">{pendingPayment.orderId}</span>
                </div>
                <span className="text-sm font-black text-black bg-neoYellow border border-black px-2.5 py-0.5 rounded shadow-neo-sm">
                  Rp 30.000
                </span>
              </div>

              {pendingPayment.qrUrl ? (
                <div className="bg-white border-2 border-black p-4 rounded-xl shadow-neo-sm space-y-2">
                  <img 
                    src={pendingPayment.qrUrl} 
                    alt="QRIS Pembayaran" 
                    className="w-48 h-48 mx-auto"
                  />
                  <div className="text-[10px] font-black text-black tracking-wide uppercase flex items-center justify-center gap-1">
                    <QrCode size={12} /> SCAN DENGAN E-WALLET / BANK
                  </div>

                  {countdown && (
                    <div className={`text-xxs font-black flex items-center justify-center gap-1 ${
                      countdown === 'EXPIRED' ? 'text-red-500' : 'text-zinc-600'
                    }`}>
                      <Clock size={12} /> Kedaluwarsa: {countdown}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-6">
                  <AlertCircle size={32} className="mx-auto text-neoOrange mb-2" />
                  <p className="text-xs font-black">Data QRIS gagal dimuat</p>
                </div>
              )}

              <p className="text-xxs text-zinc-500 max-w-[280px] leading-relaxed">
                Scan QRIS di atas sebelum waktu habis. Status akan diperbarui secara otomatis secara real-time.
              </p>

              <div className="flex flex-col gap-2 w-full pt-2">
                <a
                  href={pendingPayment.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full neo-btn bg-white hover:bg-slate-50 text-black text-xs font-black py-2.5 px-3 rounded-xl border-2 border-black shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all cursor-pointer text-center flex items-center justify-center gap-1"
                >
                  Buka Halaman Checkout <ExternalLink size={12} />
                </a>

                {/* Tombol Simulasi Pembayaran (Hanya tampil di Dev Mode) */}
                {process.env.NODE_ENV === 'development' && (
                  <button
                    onClick={handleSimulatePay}
                    disabled={simulating}
                    className="w-full neo-btn bg-neoMint text-black text-xs font-black py-2.5 px-3 rounded-xl border-2 border-black shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    {simulating ? (
                      <RefreshCw className="animate-spin" size={14} />
                    ) : (
                      <Zap size={14} className="fill-black" />
                    )}
                    <span>[DEV MOCK] Simulasikan Pembayaran Berhasil</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border-3 border-black shadow-neo rounded-2xl p-6 text-center py-10 space-y-4">
              <div className="w-12 h-12 rounded-full bg-neoCream border-2 border-black flex items-center justify-center mx-auto shadow-neo-sm">
                <CreditCard size={20} className="text-black" />
              </div>
              <div>
                <h4 className="text-xs font-black text-black uppercase tracking-wider">Tidak ada tagihan tertunda</h4>
                <p className="text-xxs text-zinc-500 mt-2 max-w-[280px] mx-auto leading-relaxed">
                  Jika Anda ingin mengaktifkan kuota tak terbatas dan memicu AI penjadwalan premium, klik tombol <strong>Upgrade ke Pro</strong> di atas.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Riwayat Pembayaran & Invoice */}
      {history.length > 0 && (
        <div className="bg-white border-3 border-black shadow-neo rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b-2 border-black pb-3">
            <Receipt size={18} className="text-black" />
            <h3 className="text-sm font-black text-black uppercase tracking-wider">
              Riwayat Pembayaran & Invoice
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b-2 border-black text-[10px] font-black uppercase text-left text-zinc-600">
                  <th className="pb-2 pr-4">Order ID</th>
                  <th className="pb-2 pr-4">Plan</th>
                  <th className="pb-2 pr-4">Jumlah</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-neoCream transition-colors">
                    <td className="py-2.5 pr-4 text-zinc-700 font-bold">{item.orderId}</td>
                    <td className="py-2.5 pr-4 font-black uppercase">{item.plan}</td>
                    <td className="py-2.5 pr-4 font-black">Rp {item.amount.toLocaleString('id-ID')}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                        item.status === 'active' ? 'bg-neoMint border-black text-black' :
                        item.status === 'pending' ? 'bg-neoYellow border-black text-black' :
                        'bg-gray-100 border-gray-300 text-gray-500'
                      }`}>
                        {item.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 text-zinc-500">
                      {new Date(item.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
