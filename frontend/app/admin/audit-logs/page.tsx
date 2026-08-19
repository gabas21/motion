'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import API from '../../../lib/api';
import {
  Search, Shield, Loader, RefreshCw, Filter,
  User, Lock, CreditCard, Settings, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, Activity, Clock, AlertTriangle,
  FolderTree, LayoutGrid, List, Download, BookOpen, Bot, Key
} from 'lucide-react';
import { toast } from '../../../hooks/useToast';

interface AuditLog {
  id: number;
  userId: string;
  action: string;
  category: string;
  resourceType?: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  status: string;
  createdAt: string;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  auth: { label: 'Auth & Akun', icon: <Lock size={13} />, color: 'text-blue-400 border-blue-500/30', bg: 'bg-blue-500/10' },
  siak_account: { label: 'SIAK Wicida', icon: <BookOpen size={13} />, color: 'text-amber-400 border-amber-500/30', bg: 'bg-amber-500/10' },
  siak: { label: 'SIAK Wicida', icon: <BookOpen size={13} />, color: 'text-amber-400 border-amber-500/30', bg: 'bg-amber-500/10' },
  welearn: { label: 'WeLearn Moodle', icon: <BookOpen size={13} />, color: 'text-emerald-400 border-emerald-500/30', bg: 'bg-emerald-500/10' },
  ai: { label: 'AI ASEP & BYOK', icon: <Bot size={13} />, color: 'text-purple-400 border-purple-500/30', bg: 'bg-purple-500/10' },
  byok: { label: 'AI ASEP & BYOK', icon: <Key size={13} />, color: 'text-purple-400 border-purple-500/30', bg: 'bg-purple-500/10' },
  admin: { label: 'Admin & Keamanan', icon: <Shield size={13} />, color: 'text-rose-400 border-rose-500/30', bg: 'bg-rose-500/10' },
  security: { label: 'Admin & Keamanan', icon: <AlertTriangle size={13} />, color: 'text-rose-400 border-rose-500/30', bg: 'bg-rose-500/10' },
  subscription: { label: 'Subscription', icon: <CreditCard size={13} />, color: 'text-yellow-400 border-yellow-500/30', bg: 'bg-yellow-500/10' },
  payment: { label: 'Pembayaran', icon: <CreditCard size={13} />, color: 'text-yellow-400 border-yellow-500/30', bg: 'bg-yellow-500/10' },
  task: { label: 'Tugas & Misi', icon: <Activity size={13} />, color: 'text-cyan-400 border-cyan-500/30', bg: 'bg-cyan-500/10' },
  profile: { label: 'Profil User', icon: <User size={13} />, color: 'text-orange-400 border-orange-500/30', bg: 'bg-orange-500/10' },
};

function CategoryBadge({ category }: { category: string }) {
  const normalizedKey = category?.toLowerCase() || 'other';
  const cfg = CATEGORY_CONFIG[normalizedKey] ?? { 
    label: category || 'Lainnya', 
    icon: <Settings size={12} />, 
    color: 'text-zinc-400 border-zinc-500/30',
    bg: 'bg-zinc-500/10' 
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${cfg.bg} ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isSuccess = status === 'success';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
      isSuccess ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'
    }`}>
      {isSuccess ? <CheckCircle size={11} /> : <XCircle size={11} />}
      {isSuccess ? 'Success' : 'Failed'}
    </span>
  );
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function parseDetails(details?: string): string {
  if (!details) return '—';
  try {
    const obj = JSON.parse(details);
    return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—';
  } catch {
    return details;
  }
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 100, pages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters & Views
  const [search, setSearch] = useState('');
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grouped' | 'table'>('grouped');
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '100' });
      if (activeCategoryTab !== 'all') params.set('category', activeCategoryTab);
      if (filterStatus) params.set('status', filterStatus);

      const res = await API.get(`/admin/audit-logs?${params.toString()}`);
      setLogs(res.data.data.data ?? []);
      setMeta(res.data.data.meta ?? { total: 0, page: 1, limit: 100, pages: 1 });
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, activeCategoryTab, filterStatus]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Client-side search filter
  const filteredLogs = useMemo(() => {
    return logs.filter(l =>
      !search ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.userId.toLowerCase().includes(search.toLowerCase()) ||
      (l.ipAddress ?? '').includes(search) ||
      (l.details ?? '').toLowerCase().includes(search.toLowerCase())
    );
  }, [logs, search]);

  // Group logs by Category
  const groupedLogs = useMemo(() => {
    const map: Record<string, AuditLog[]> = {};
    filteredLogs.forEach(log => {
      const catKey = log.category?.toLowerCase() || 'other';
      if (!map[catKey]) map[catKey] = [];
      map[catKey].push(log);
    });
    return map;
  }, [filteredLogs]);

  // Calculate real-time category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: logs.length };
    logs.forEach(l => {
      const k = l.category?.toLowerCase() || 'other';
      counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  }, [logs]);

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error('Tidak ada data log untuk diekspor!');
      return;
    }

    const headers = ['ID', 'Waktu', 'User ID', 'Action', 'Kategori', 'Status', 'IP Address', 'Detail'];
    const rows = filteredLogs.map(l => [
      l.id,
      formatDate(l.createdAt),
      l.userId,
      l.action,
      l.category,
      l.status,
      l.ipAddress || '—',
      `"${parseDetails(l.details).replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('File Audit Logs CSV berhasil diunduh!');
  };

  const categoryTabsList = [
    { key: 'all', label: 'Semua Kategori', icon: <FolderTree size={14} /> },
    { key: 'auth', label: 'Auth & Akun', icon: <Lock size={14} /> },
    { key: 'siak_account', label: 'SIAK Wicida', icon: <BookOpen size={14} /> },
    { key: 'welearn', label: 'WeLearn Moodle', icon: <BookOpen size={14} /> },
    { key: 'ai', label: 'AI ASEP & BYOK', icon: <Bot size={14} /> },
    { key: 'admin', label: 'Admin & Keamanan', icon: <Shield size={14} /> },
    { key: 'subscription', label: 'Subscription', icon: <CreditCard size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 space-y-6 text-left">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Audit Logs System</h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Rekam jejak dan pemantauan aktivitas sistem terkelompok per kategori.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Selector */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1">
            <button
              onClick={() => setViewMode('grouped')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'grouped' ? 'bg-purple-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <LayoutGrid size={13} />
              <span>Terkelompok</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table' ? 'bg-purple-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <List size={13} />
              <span>Tabel Lengkap</span>
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            title="Muat Ulang Data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Category Pill Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categoryTabsList.map((tab) => {
          const isSelected = activeCategoryTab === tab.key;
          const count = categoryCounts[tab.key] ?? 0;

          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveCategoryTab(tab.key);
                setPage(1);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold border shrink-0 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-purple-500/20 border-purple-500/60 text-purple-300 shadow-neo-sm'
                  : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                isSelected ? 'bg-purple-500 text-white' : 'bg-white/10 text-zinc-400'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap gap-3 items-center justify-between bg-white/[0.02] border border-white/10 rounded-2xl p-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={15} />
          <input
            type="text"
            placeholder="Cari aksi, user ID, IP address, atau detail..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-zinc-500" />
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-purple-500/50 transition-all cursor-pointer"
          >
            <option value="" className="bg-zinc-900">Semua Status</option>
            <option value="success" className="bg-zinc-900">Success</option>
            <option value="failed" className="bg-zinc-900">Failed</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader className="animate-spin text-purple-400" size={32} />
          <p className="text-xs text-zinc-500 font-bold">Memuat log aktivitas terkelompok...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-600 bg-white/[0.02] border border-white/10 rounded-2xl">
          <Shield size={40} className="mb-3 opacity-30" />
          <p className="text-sm font-bold text-zinc-400">Tidak ada audit log yang ditemukan</p>
          <p className="text-xs text-zinc-500 mt-1">Coba ubah kata kunci pencarian atau filter kategori.</p>
        </div>
      ) : viewMode === 'grouped' ? (
        /* MODE TERKELOMPOK PER KATEGORI */
        <div className="space-y-6">
          {Object.entries(groupedLogs).map(([catKey, categoryLogs]) => {
            const successCount = categoryLogs.filter(l => l.status === 'success').length;
            const failedCount = categoryLogs.length - successCount;

            return (
              <div key={catKey} className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden shadow-lg">
                {/* Category Group Header */}
                <div className="p-4 bg-white/[0.04] border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CategoryBadge category={catKey} />
                    <span className="text-xs font-bold text-zinc-400">
                      Total: <strong className="text-white">{categoryLogs.length} Aktivitas</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                      {successCount} Berhasil
                    </span>
                    {failedCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-bold">
                        {failedCount} Gagal
                      </span>
                    )}
                  </div>
                </div>

                {/* Group Logs Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        <th className="px-4 py-3">Waktu</th>
                        <th className="px-4 py-3">User ID</th>
                        <th className="px-4 py-3">Aksi (Action)</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">IP Address</th>
                        <th className="px-4 py-3">Detail Aktivitas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {categoryLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-zinc-400 font-mono">
                            <div className="flex items-center gap-1">
                              <Clock size={11} className="text-zinc-600" />
                              {formatDate(log.createdAt)}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-zinc-300">
                            {log.userId ? log.userId.slice(0, 8) + '...' : '—'}
                          </td>
                          <td className="px-4 py-3 font-bold text-purple-300">
                            {log.action}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={log.status} />
                          </td>
                          <td className="px-4 py-3 font-mono text-zinc-400">
                            {log.ipAddress || '—'}
                          </td>
                          <td className="px-4 py-3 text-zinc-300 max-w-xs truncate" title={parseDetails(log.details)}>
                            {parseDetails(log.details)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* MODE TABEL LENGKAP (FLAT TABLE) */
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-white/10 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-white/[0.02]">
                  <th className="px-4 py-3.5">Waktu</th>
                  <th className="px-4 py-3.5">User ID</th>
                  <th className="px-4 py-3.5">Aksi (Action)</th>
                  <th className="px-4 py-3.5">Kategori</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">IP Address</th>
                  <th className="px-4 py-3.5">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3.5 whitespace-nowrap text-zinc-400 font-mono">
                      <div className="flex items-center gap-1.5">
                        <Clock size={11} className="text-zinc-600" />
                        {formatDate(log.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-zinc-300">
                      {log.userId ? log.userId.slice(0, 8) + '...' : '—'}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-purple-300">
                      {log.action}
                    </td>
                    <td className="px-4 py-3.5">
                      <CategoryBadge category={log.category} />
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-4 py-3.5 font-mono text-zinc-400">
                      {log.ipAddress || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-300 max-w-sm truncate" title={parseDetails(log.details)}>
                      {parseDetails(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Footer */}
      {meta.pages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <p className="text-xs text-zinc-500 font-medium">
            Menampilkan {((page - 1) * 100) + 1}–{Math.min(page * 100, meta.total)} dari total {meta.total} log aktivitas
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-xl bg-white/5 border border-white/10 disabled:opacity-30 hover:bg-white/10 transition-all cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-zinc-400 font-bold px-2">
              Halaman {page} / {meta.pages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(meta.pages, p + 1))}
              disabled={page >= meta.pages}
              className="p-2 rounded-xl bg-white/5 border border-white/10 disabled:opacity-30 hover:bg-white/10 transition-all cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
