'use client';

import React, { useEffect, useState } from 'react';
import API from '../../../lib/api';
import { 
  Key, ShieldAlert, CheckCircle, RefreshCw, Trash2, Search,
  Filter, Sparkles, User, AlertCircle, Loader
} from 'lucide-react';
import { toast } from '../../../hooks/useToast';

interface ProviderStatus {
  configured: boolean;
  keyLast4?: string;
  isValid?: boolean;
  validatedAt?: string;
}

interface AdminAIKeyItem {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  providers: {
    gemini?: ProviderStatus;
    groq?: ProviderStatus;
    openrouter?: ProviderStatus;
  };
  updatedAt: string;
}

export default function AdminAIKeysPage() {
  const [keysData, setKeysData] = useState<AdminAIKeyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState<'all' | 'gemini' | 'groq' | 'openrouter'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchKeys = async () => {
    setIsLoading(true);
    try {
      const response = await API.get('/admin/ai-keys');
      setKeysData(response.data?.data?.keys || response.data?.keys || []);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal memuat daftar API Key pengguna');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleRevalidate = async (userId: string, provider: string) => {
    const keyId = `${userId}-${provider}`;
    setActionLoading(keyId);
    try {
      const res = await API.post(`/admin/ai-keys/validate/${userId}/${provider}`);
      toast.success(res.data?.message || `API Key ${provider} terbukti valid!`);
      await fetchKeys();
    } catch (err: any) {
      toast.error(err.response?.data?.error || `Tes validasi ${provider} gagal! Key dinonaktifkan.`);
      await fetchKeys();
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (userId: string, provider: string, userName: string) => {
    if (!confirm(`Apakah Anda yakin ingin mencabut API Key ${provider.toUpperCase()} milik ${userName}?`)) {
      return;
    }
    const keyId = `${userId}-${provider}`;
    setActionLoading(keyId);
    try {
      const res = await API.delete(`/admin/ai-keys/${userId}/${provider}`);
      toast.success(res.data?.message || `API Key ${provider} berhasil dicabut.`);
      await fetchKeys();
    } catch (err: any) {
      toast.error(err.response?.data?.error || `Gagal mencabut API Key ${provider}.`);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredKeys = keysData.filter((item) => {
    const matchesSearch = 
      item.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.userEmail.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (providerFilter === 'all') return matchesSearch;
    return matchesSearch && item.providers[providerFilter]?.configured;
  });

  return (
    <div className="space-y-6 text-left max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white border-3 border-black rounded-3xl p-6 shadow-neo flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border border-black bg-neoYellow text-black">
              Keamanan Platform
            </span>
            <span className="text-xs font-semibold text-slate-500">BYOK Key Audit</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-black mt-1 flex items-center gap-2">
            <Key className="w-6 h-6 text-neoOrange" /> Audit API Key Pengguna (Admin Only)
          </h1>
          <p className="text-xs text-slate-600 font-bold mt-1 max-w-2xl">
            Pantau seluruh API key pribadi (BYOK) yang terdaftar oleh pengguna. Jalankan pengujian koneksi (*test-call*) atau cabut key yang rusak/berbahaya.
          </p>
        </div>

        <button
          onClick={fetchKeys}
          disabled={isLoading}
          className="px-4 py-2.5 rounded-xl border-2 border-black bg-white hover:bg-slate-50 font-black text-xs flex items-center gap-2 shadow-neo-sm active:scale-95 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Muat Ulang Data</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border-3 border-black rounded-2xl p-4 shadow-neo-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama atau email user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs font-semibold border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-neoMint"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="text-xs font-bold text-slate-600 shrink-0">Filter Provider:</span>
          <select
            value={providerFilter}
            onChange={(e: any) => setProviderFilter(e.target.value)}
            className="px-3 py-2 text-xs font-extrabold border-2 border-black rounded-xl bg-white cursor-pointer"
          >
            <option value="all">Semua Provider</option>
            <option value="gemini">Gemini Only</option>
            <option value="groq">Groq Only</option>
            <option value="openrouter">OpenRouter Only</option>
          </select>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border-3 border-black rounded-3xl shadow-neo overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center space-y-3">
            <Loader className="w-8 h-8 animate-spin mx-auto text-neoMint" />
            <p className="text-xs font-bold text-slate-500">Memuat audit log API key pengguna...</p>
          </div>
        ) : filteredKeys.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="w-10 h-10 mx-auto text-amber-500" />
            <h4 className="text-sm font-black text-black">Tidak Ada API Key Ditemukan</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Belum ada pengguna yang mendaftarkan API key atau hasil filter tidak cocok.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-black text-[11px] font-black text-black uppercase tracking-wider">
                  <th className="p-4">Pengguna</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Google Gemini</th>
                  <th className="p-4">Groq AI</th>
                  <th className="p-4">OpenRouter</th>
                  <th className="p-4 text-right">Diperbarui</th>
                </tr>
              </thead>
              <tbody className="divide-y border-black/10 text-xs font-semibold">
                {filteredKeys.map((item) => (
                  <tr key={item.userId} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="font-extrabold text-slate-900">{item.userName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{item.userEmail}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded border border-black ${
                        item.userRole === 'admin' ? 'bg-purple-200 text-purple-900' : 'bg-slate-200 text-slate-800'
                      }`}>
                        {item.userRole}
                      </span>
                    </td>

                    {/* Gemini Provider Cell */}
                    <td className="p-4">
                      {item.providers.gemini?.configured ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold bg-neoMint/30 border border-neoMint/60 px-1.5 py-0.5 rounded text-black">
                              ••••{item.providers.gemini.keyLast4 || 'XXXX'}
                            </span>
                            {item.providers.gemini.isValid ? (
                              <span title="Terverifikasi Aktif"><CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /></span>
                            ) : (
                              <span title="Key Tidak Valid / Terblokir"><ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" /></span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => handleRevalidate(item.userId, 'gemini')}
                              disabled={actionLoading === `${item.userId}-gemini`}
                              className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                            >
                              <RefreshCw className="w-3 h-3" /> Tes Re-validate
                            </button>
                            <button
                              onClick={() => handleRevoke(item.userId, 'gemini', item.userName)}
                              disabled={actionLoading === `${item.userId}-gemini`}
                              className="text-[10px] font-bold text-red-600 hover:underline flex items-center gap-0.5"
                            >
                              <Trash2 className="w-3 h-3" /> Cabut
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Belum diisi</span>
                      )}
                    </td>

                    {/* Groq Provider Cell */}
                    <td className="p-4">
                      {item.providers.groq?.configured ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold bg-amber-200/50 border border-amber-400 px-1.5 py-0.5 rounded text-black">
                              ••••{item.providers.groq.keyLast4 || 'XXXX'}
                            </span>
                            {item.providers.groq.isValid ? (
                              <span title="Terverifikasi Aktif"><CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /></span>
                            ) : (
                              <span title="Key Tidak Valid / Terblokir"><ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" /></span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => handleRevalidate(item.userId, 'groq')}
                              disabled={actionLoading === `${item.userId}-groq`}
                              className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                            >
                              <RefreshCw className="w-3 h-3" /> Tes Re-validate
                            </button>
                            <button
                              onClick={() => handleRevoke(item.userId, 'groq', item.userName)}
                              disabled={actionLoading === `${item.userId}-groq`}
                              className="text-[10px] font-bold text-red-600 hover:underline flex items-center gap-0.5"
                            >
                              <Trash2 className="w-3 h-3" /> Cabut
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Belum diisi</span>
                      )}
                    </td>

                    {/* OpenRouter Provider Cell */}
                    <td className="p-4">
                      {item.providers.openrouter?.configured ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold bg-cyan-200/50 border border-cyan-400 px-1.5 py-0.5 rounded text-black">
                              ••••{item.providers.openrouter.keyLast4 || 'XXXX'}
                            </span>
                            {item.providers.openrouter.isValid ? (
                              <span title="Terverifikasi Aktif"><CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /></span>
                            ) : (
                              <span title="Key Tidak Valid / Terblokir"><ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" /></span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => handleRevalidate(item.userId, 'openrouter')}
                              disabled={actionLoading === `${item.userId}-openrouter`}
                              className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                            >
                              <RefreshCw className="w-3 h-3" /> Tes Re-validate
                            </button>
                            <button
                              onClick={() => handleRevoke(item.userId, 'openrouter', item.userName)}
                              disabled={actionLoading === `${item.userId}-openrouter`}
                              className="text-[10px] font-bold text-red-600 hover:underline flex items-center gap-0.5"
                            >
                              <Trash2 className="w-3 h-3" /> Cabut
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Belum diisi</span>
                      )}
                    </td>

                    <td className="p-4 text-right text-[11px] text-slate-500">
                      {new Date(item.updatedAt).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
