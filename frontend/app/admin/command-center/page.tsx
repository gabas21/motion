'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import API from '../../../lib/api';
import {
  Radio, ShieldAlert, Users, Laptop, Ban, RefreshCw, Loader, Search,
  Eye, CheckCircle, AlertTriangle, ToggleLeft, ToggleRight, ClipboardList, ShieldCheck
} from 'lucide-react';
import { toast } from '../../../hooks/useToast';
import { ToastContainer } from '../../../components/ui/Toast';

interface ThreatRadarData {
  totalUsers: number;
  activeSessions: number;
  suspendedUsers: number;
  securityThreats24h: number;
}

interface AdminAuditItem {
  id: number;
  adminId: string;
  admin?: { name: string; email: string };
  targetUserId: string;
  targetUser?: { name: string; email: string };
  action: string;
  reason: string;
  beforeState?: string;
  afterState?: string;
  ipAddress?: string;
  createdAt: string;
}

interface SecurityLogItem {
  id: number;
  userId: string;
  action: string;
  category: string;
  details?: string;
  ipAddress?: string;
  createdAt: string;
}

export default function MasterCommandCenter() {
  const [activeTab, setActiveTab] = useState<'monitor' | 'radar' | 'audit'>('monitor');
  const [loading, setLoading] = useState(true);
  const [threatRadar, setThreatRadar] = useState<ThreatRadarData>({
    totalUsers: 0,
    activeSessions: 0,
    suspendedUsers: 0,
    securityThreats24h: 0,
  });
  const [recentAdminAudit, setRecentAdminAudit] = useState<AdminAuditItem[]>([]);
  const [recentSecurityLogs, setRecentSecurityLogs] = useState<SecurityLogItem[]>([]);

  // Emergency Switches state (Simulated master controls)
  const [switches, setSwitches] = useState({
    maintenanceMode: false,
    lockRegistrations: false,
    strictBYOK: true,
  });

  // Admin Audit Log Tab State
  const [adminLogs, setAdminLogs] = useState<AdminAuditItem[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [totalAuditLogs, setTotalAuditLogs] = useState(0);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);

  // User search state for live monitor
  const [userSearch, setUserSearch] = useState('');
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    fetchCommandCenterData();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAdminAuditLogs(auditPage);
    }
  }, [activeTab, auditPage]);

  const fetchCommandCenterData = async () => {
    try {
      setLoading(true);
      const res = await API.get('/admin/command-center/overview');
      const data = res.data.data;
      setThreatRadar(data.threatRadar || {});
      setRecentAdminAudit(data.recentAdminAudit || []);
      setRecentSecurityLogs(data.recentSecurityLogs || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal memuat data Master Command Center.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (query = userSearch) => {
    try {
      setLoadingUsers(true);
      const res = await API.get(`/admin/users?limit=6&search=${query}`);
      setUsersList(res.data.data.users || []);
    } catch (err) {
      console.error(err);
    } fontally: {
      setLoadingUsers(false);
    }
  };

  const fetchAdminAuditLogs = async (p = 1) => {
    try {
      setLoadingAuditLogs(true);
      const res = await API.get(`/admin/admin-audit-logs?page=${p}&limit=15`);
      setAdminLogs(res.data.data.logs || []);
      setTotalAuditLogs(res.data.data.total || 0);
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengambil log audit admin.');
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  const handleToggleSwitch = (key: keyof typeof switches) => {
    setSwitches((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      toast.success(`Emergency Switch "${key}" diperbarui!`);
      return updated;
    });
  };

  return (
    <div className="space-y-8 text-black relative">
      <ToastContainer />

      {/* Header Command Center */}
      <div className="bg-[#121214] text-white p-6 rounded-2xl border-3 border-black shadow-neo flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-neoYellow border-2 border-black flex items-center justify-center text-black shadow-neo-sm shrink-0">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-neoYellow uppercase tracking-wider">OMNIPRESENT CONTROL</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <h1 className="font-black text-2xl tracking-tight text-white">Master Command Center</h1>
          </div>
        </div>

        <button
          onClick={() => {
            fetchCommandCenterData();
            fetchUsers();
            if (activeTab === 'audit') fetchAdminAuditLogs(auditPage);
          }}
          className="px-4 py-2 bg-neoYellow text-black border-2 border-black rounded-xl font-black text-xs shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all cursor-pointer flex items-center gap-2 self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>REFRESH REALTIME</span>
        </button>
      </div>

      {/* Threat Radar & Stat Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border-3 border-black p-5 rounded-2xl shadow-neo flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-neoYellow border-2 border-black flex items-center justify-center font-black shadow-neo-sm">
            <Users className="w-6 h-6 text-black" />
          </div>
          <div>
            <p className="text-[10px] font-black text-black/50 uppercase">Total Terdaftar</p>
            <h3 className="text-2xl font-black font-mono leading-none">{threatRadar.totalUsers}</h3>
          </div>
        </div>

        <div className="bg-white border-3 border-black p-5 rounded-2xl shadow-neo flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-neoMint border-2 border-black flex items-center justify-center font-black shadow-neo-sm">
            <Laptop className="w-6 h-6 text-black" />
          </div>
          <div>
            <p className="text-[10px] font-black text-black/50 uppercase">Sesi Perangkat Aktif</p>
            <h3 className="text-2xl font-black font-mono leading-none text-emerald-600">{threatRadar.activeSessions}</h3>
          </div>
        </div>

        <div className="bg-white border-3 border-black p-5 rounded-2xl shadow-neo flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-neoOrange border-2 border-black flex items-center justify-center font-black shadow-neo-sm">
            <Ban className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-black text-black/50 uppercase">User Suspended</p>
            <h3 className="text-2xl font-black font-mono leading-none text-neoOrange">{threatRadar.suspendedUsers}</h3>
          </div>
        </div>

        <div className="bg-white border-3 border-black p-5 rounded-2xl shadow-neo flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-neoPink border-2 border-black flex items-center justify-center font-black shadow-neo-sm">
            <ShieldAlert className="w-6 h-6 text-black" />
          </div>
          <div>
            <p className="text-[10px] font-black text-black/50 uppercase">Events Keamanan (24h)</p>
            <h3 className="text-2xl font-black font-mono leading-none">{threatRadar.securityThreats24h}</h3>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b-3 border-black gap-2 select-none">
        <button
          onClick={() => setActiveTab('monitor')}
          className={`px-5 py-3 font-black text-xs rounded-t-xl border-t-3 border-x-3 border-black transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'monitor'
              ? 'bg-neoYellow text-black -mb-[3px] shadow-neo-sm'
              : 'bg-gray-100 text-black/60 hover:bg-gray-200'
          }`}
        >
          <Radio className="w-4 h-4" /> LIVE MONITOR & SWITCHES
        </button>

        <button
          onClick={() => setActiveTab('radar')}
          className={`px-5 py-3 font-black text-xs rounded-t-xl border-t-3 border-x-3 border-black transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'radar'
              ? 'bg-neoYellow text-black -mb-[3px] shadow-neo-sm'
              : 'bg-gray-100 text-black/60 hover:bg-gray-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4" /> THREAT RADAR FEED
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-5 py-3 font-black text-xs rounded-t-xl border-t-3 border-x-3 border-black transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'bg-neoYellow text-black -mb-[3px] shadow-neo-sm'
              : 'bg-gray-100 text-black/60 hover:bg-gray-200'
          }`}
        >
          <ClipboardList className="w-4 h-4" /> ADMIN AUDIT LOGS
        </button>
      </div>

      {/* TAB 1: Live Monitor & Master Switches */}
      {activeTab === 'monitor' && (
        <div className="space-y-8">
          {/* Emergency Master Switches Card */}
          <div className="bg-white border-3 border-black p-6 rounded-2xl shadow-neo space-y-4">
            <h3 className="font-black text-base uppercase flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-neoOrange" />
              Emergency Master Controls
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Switch 1 */}
              <div className="p-4 bg-[#FAF9F5] border-2 border-black rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-black text-xs uppercase">Mode Pemeliharaan</h4>
                  <p className="text-[10px] text-black/60 font-bold">Kunci akses publik non-admin</p>
                </div>
                <button
                  onClick={() => handleToggleSwitch('maintenanceMode')}
                  className="cursor-pointer text-black"
                >
                  {switches.maintenanceMode ? (
                    <ToggleRight className="w-8 h-8 text-neoOrange" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-gray-400" />
                  )}
                </button>
              </div>

              {/* Switch 2 */}
              <div className="p-4 bg-[#FAF9F5] border-2 border-black rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-black text-xs uppercase">Kunci Pendaftaran</h4>
                  <p className="text-[10px] text-black/60 font-bold">Tolak pendaftaran user baru</p>
                </div>
                <button
                  onClick={() => handleToggleSwitch('lockRegistrations')}
                  className="cursor-pointer text-black"
                >
                  {switches.lockRegistrations ? (
                    <ToggleRight className="w-8 h-8 text-neoOrange" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-gray-400" />
                  )}
                </button>
              </div>

              {/* Switch 3 */}
              <div className="p-4 bg-[#FAF9F5] border-2 border-black rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-black text-xs uppercase">Enforce BYOK Strict</h4>
                  <p className="text-[10px] text-black/60 font-bold">Wajibkan key pribadi AI</p>
                </div>
                <button
                  onClick={() => handleToggleSwitch('strictBYOK')}
                  className="cursor-pointer text-black"
                >
                  {switches.strictBYOK ? (
                    <ToggleRight className="w-8 h-8 text-emerald-600" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Quick User Inspector Finder */}
          <div className="bg-white border-3 border-black p-6 rounded-2xl shadow-neo space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h3 className="font-black text-base uppercase flex items-center gap-2">
                <Search className="w-5 h-5 text-black" />
                Live User Inspector Search
              </h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  fetchUsers(userSearch);
                }}
                className="relative w-full sm:w-80"
              >
                <input
                  type="text"
                  placeholder="Cari user untuk diinspeksi..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full neo-input py-2 pl-3 pr-20 text-xs font-bold"
                />
                <button
                  type="submit"
                  className="absolute right-1 top-1/2 -translate-y-1/2 px-3 py-1 bg-neoYellow border border-black rounded text-[10px] font-black cursor-pointer"
                >
                  CARI
                </button>
              </form>
            </div>

            {loadingUsers ? (
              <div className="flex justify-center py-8">
                <Loader className="w-6 h-6 animate-spin text-black" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {usersList.map((usr) => (
                  <div key={usr.id} className="p-4 bg-[#FAF9F5] border-2 border-black rounded-xl shadow-neo-sm flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-black text-sm truncate">{usr.name}</h4>
                      <p className="font-mono text-xxs text-black/55 truncate">{usr.email}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[8px] font-black px-1.5 py-0.5 bg-neoCream border border-black rounded uppercase">
                          {usr.role}
                        </span>
                        <span className="text-[8px] font-black px-1.5 py-0.5 bg-purple-100 text-purple-800 border border-black rounded uppercase">
                          {usr.plan}
                        </span>
                      </div>
                    </div>

                    <Link
                      href={`/admin/users/${usr.id}/inspect`}
                      className="px-3 py-2 bg-neoYellow border-2 border-black rounded-xl text-xs font-black shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" /> INSPEKSI
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Threat Radar Feed */}
      {activeTab === 'radar' && (
        <div className="bg-white border-3 border-black p-6 rounded-2xl shadow-neo space-y-4">
          <h3 className="font-black text-base uppercase flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-neoOrange" />
            Live Security Threat Log Feed (24 Hours)
          </h3>

          {recentSecurityLogs.length === 0 ? (
            <p className="text-xs font-bold text-black/50 text-center py-8">Tidak ada ancaman keamanan terdeteksi dalam 24 jam terakhir.</p>
          ) : (
            <div className="space-y-3">
              {recentSecurityLogs.map((log) => (
                <div key={log.id} className="p-3.5 bg-red-50/60 border-2 border-red-900 rounded-xl text-xs flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-neo-sm">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black px-2 py-0.5 bg-red-600 text-white rounded border border-black uppercase">
                        {log.action}
                      </span>
                      <span className="font-mono text-xxs text-black/60">Category: {log.category}</span>
                    </div>
                    <p className="font-bold text-black">{log.details || 'Aktivitas keamanan tercatat'}</p>
                  </div>

                  <div className="font-mono text-xxs text-black/50 text-right shrink-0">
                    <div>{new Date(log.createdAt).toLocaleString('id-ID')}</div>
                    {log.ipAddress && <div>IP: {log.ipAddress}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Admin Audit Logs (Symmetric Accountability) */}
      {activeTab === 'audit' && (
        <div className="bg-white border-3 border-black rounded-2xl shadow-neo overflow-hidden">
          <div className="bg-[#121214] text-white p-4 border-b-3 border-black flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-neoYellow" />
              <h3 className="font-black text-sm uppercase text-white">Akuntabilitas Admin Audit Log ({totalAuditLogs} Records)</h3>
            </div>
            <span className="text-[9px] font-black px-2 py-0.5 bg-neoYellow text-black rounded border border-black uppercase">
              IMMUTABLE TABLE
            </span>
          </div>

          {loadingAuditLogs ? (
            <div className="flex justify-center py-16">
              <Loader className="w-8 h-8 animate-spin text-black" />
            </div>
          ) : adminLogs.length === 0 ? (
            <p className="text-xs font-bold text-black/50 text-center py-12">Belum ada tindakan administratif tercatat di log audit.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-bold">
                <thead>
                  <tr className="bg-[#121214] text-white border-b-3 border-black text-[10px] font-black uppercase">
                    <th className="p-3.5 border-r-2 border-black">Waktu</th>
                    <th className="p-3.5 border-r-2 border-black">Admin Aktor</th>
                    <th className="p-3.5 border-r-2 border-black">Target User</th>
                    <th className="p-3.5 border-r-2 border-black">Tindakan</th>
                    <th className="p-3.5 border-r-2 border-black">Alasan Audit</th>
                    <th className="p-3.5">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-black">
                  {adminLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-amber-50/50 transition-colors">
                      <td className="p-3.5 font-mono text-xxs text-black/60 border-r-2 border-black">
                        {new Date(log.createdAt).toLocaleString('id-ID')}
                      </td>
                      <td className="p-3.5 border-r-2 border-black font-black">
                        {log.admin?.name || 'Admin'}
                        <span className="block font-mono text-xxs text-black/50">{log.admin?.email}</span>
                      </td>
                      <td className="p-3.5 border-r-2 border-black font-black">
                        {log.targetUser?.name || log.targetUserId || 'System'}
                        {log.targetUser?.email && (
                          <span className="block font-mono text-xxs text-black/50">{log.targetUser.email}</span>
                        )}
                      </td>
                      <td className="p-3.5 border-r-2 border-black">
                        <span className="text-[9px] font-black px-2 py-0.5 bg-neoOrange text-white border border-black rounded uppercase">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3.5 border-r-2 border-black font-bold text-black/80 max-w-xs break-words">
                        {log.reason}
                      </td>
                      <td className="p-3.5 font-mono text-xxs text-black/60">
                        {log.ipAddress || 'Internal'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
