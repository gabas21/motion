'use client';

import React, { useEffect, useState, useCallback } from 'react';
import API from '../../../lib/api';
import {
  Search, Shield, Loader, RefreshCw, Filter,
  User, Lock, CreditCard, Settings, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, Activity, Clock, AlertTriangle
} from 'lucide-react';

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

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  auth: { label: 'Auth', icon: <Lock size={12} />, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  admin: { label: 'Admin', icon: <Shield size={12} />, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  subscription: { label: 'Subscription', icon: <CreditCard size={12} />, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  payment: { label: 'Payment', icon: <CreditCard size={12} />, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  task: { label: 'Task', icon: <Activity size={12} />, color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  profile: { label: 'Profile', icon: <User size={12} />, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  security: { label: 'Security', icon: <AlertTriangle size={12} />, color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

function CategoryBadge({ category }: { category: string }) {
  const cfg = CATEGORY_CONFIG[category] ?? { label: category, icon: <Settings size={12} />, color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isSuccess = status === 'success';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
      isSuccess ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'
    }`}>
      {isSuccess ? <CheckCircle size={11} /> : <XCircle size={11} />}
      {isSuccess ? 'Success' : 'Failed'}
    </span>
  );
}

function formatDate(dateStr: string) {
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
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 50, pages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (filterCategory) params.set('category', filterCategory);
      if (filterStatus) params.set('status', filterStatus);

      const res = await API.get(`/admin/audit-logs?${params.toString()}`);
      setLogs(res.data.data.data ?? []);
      setMeta(res.data.data.meta ?? { total: 0, page: 1, limit: 50, pages: 1 });
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, filterCategory, filterStatus]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Client-side search filter
  const filtered = logs.filter(l =>
    !search ||
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.userId.toLowerCase().includes(search.toLowerCase()) ||
    (l.ipAddress ?? '').includes(search)
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <Shield className="text-purple-400" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
            <p className="text-sm text-zinc-500">Rekam jejak semua aksi penting di sistem Motion</p>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Log', value: meta.total, icon: <Activity size={16} className="text-purple-400" />, color: 'border-purple-500/20' },
          { label: 'Halaman', value: `${page} / ${meta.pages}`, icon: <Clock size={16} className="text-blue-400" />, color: 'border-blue-500/20' },
          { label: 'Ditampilkan', value: filtered.length, icon: <Filter size={16} className="text-cyan-400" />, color: 'border-cyan-500/20' },
          { label: 'Kategori', value: filterCategory || 'Semua', icon: <Settings size={16} className="text-zinc-400" />, color: 'border-zinc-500/20' },
        ].map((s, i) => (
          <div key={i} className={`bg-white/[0.03] rounded-xl border ${s.color} p-4 flex items-center gap-3`}>
            <div className="p-2 rounded-lg bg-white/5">{s.icon}</div>
            <div>
              <p className="text-xs text-zinc-500">{s.label}</p>
              <p className="text-lg font-bold">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input
            type="text"
            placeholder="Cari action, user ID, IP..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 focus:bg-white/8 transition-all"
          />
        </div>

        {/* Category filter */}
        <select
          value={filterCategory}
          onChange={e => { setFilterCategory(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all"
        >
          <option value="">Semua Kategori</option>
          {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all"
        >
          <option value="">Semua Status</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </select>

        {/* Refresh */}
        <button
          onClick={fetchLogs}
          className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="animate-spin text-purple-400" size={32} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
            <Shield size={40} className="mb-3 opacity-30" />
            <p className="text-sm">Tidak ada audit log yang ditemukan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Waktu</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">User ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Kategori</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">IP Address</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Detail</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log, idx) => (
                  <tr
                    key={log.id}
                    className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${idx % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
                        <Clock size={11} className="text-zinc-600" />
                        {formatDate(log.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-zinc-400">{log.userId.slice(0, 8)}...</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-white">{log.action}</span>
                      {log.resourceType && (
                        <span className="ml-1.5 text-[10px] text-zinc-600">{log.resourceType}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <CategoryBadge category={log.category} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-zinc-500">{log.ipAddress || '—'}</span>
                    </td>
                    <td className="px-4 py-3 max-w-[250px]">
                      <span className="text-xs text-zinc-500 truncate block" title={parseDetails(log.details)}>
                        {parseDetails(log.details)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {meta.pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-zinc-600">
            Menampilkan {((page - 1) * 50) + 1}–{Math.min(page * 50, meta.total)} dari {meta.total} log
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-lg bg-white/5 border border-white/10 disabled:opacity-30 hover:bg-white/10 transition-all"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-zinc-400 px-2">
              Hal {page} / {meta.pages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(meta.pages, p + 1))}
              disabled={page >= meta.pages}
              className="p-2 rounded-lg bg-white/5 border border-white/10 disabled:opacity-30 hover:bg-white/10 transition-all"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
