'use client';

import React, { useEffect, useState } from 'react';
import API from '../../../lib/api';
import { 
  Search, ShieldAlert, Loader, Trash2, X, User,
  CheckCircle, Link2, Calendar, BookOpen, Clock, AlertCircle,
  Ban, ShieldCheck, KeyRound, Check, RefreshCw
} from 'lucide-react';
import { toast } from '../../../hooks/useToast';
import { ToastContainer } from '../../../components/ui/Toast';

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  timezone: string;
  plan: string;
  createdAt: string;
  emailVerified: boolean;
  lockedUntil?: string;
  requirePasswordChange: boolean;
  lastLoginAt?: string;
  subscriptionExpiresAt?: string;
}

interface UserDetailStats {
  totalTasks: number;
  completedTasks: number;
  moodleConnected: boolean;
  calendarConnected: boolean;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Modals / Details State
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [detailStats, setDetailStats] = useState<UserDetailStats | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [suspending, setSuspending] = useState<string | null>(null);
  const [updatingPlan, setUpdatingPlan] = useState<string | null>(null);
  const [forcingReset, setForcingReset] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter, planFilter, statusFilter]);

  const fetchUsers = async (customSearch = search) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search: customSearch,
        role: roleFilter,
        plan: planFilter,
        status: statusFilter
      });
      const response = await API.get(`/admin/users?${params.toString()}`);
      const data = response.data.data;
      setUsers(data.users || []);
      const pagination = data.pagination;
      setTotalItems(pagination.total || 0);
      setTotalPages(Math.ceil(pagination.total / pagination.limit));
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal mengambil daftar pengguna.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers(search);
  };

  const isUserSuspended = (usr: UserItem) => {
    if (!usr.lockedUntil) return false;
    const lockedDate = new Date(usr.lockedUntil);
    const now = new Date();
    const diffTime = lockedDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 30; // Suspended is locks > 30 days
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      setUpdatingRole(userId);
      await API.patch(`/admin/users/${userId}/role`, { role: newRole });
      toast.success('Role pengguna berhasil diperbarui!');
      
      // Update local state
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, role: newRole } : null);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Gagal mengubah role pengguna.');
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleToggleSuspend = async (user: UserItem) => {
    try {
      setSuspending(user.id);
      const response = await API.patch(`/admin/users/${user.id}/suspend`);
      const updatedUser = response.data.data.user;
      toast.success(response.data.data.message || 'Status suspensi berhasil diperbarui!');
      
      // Update local state
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, lockedUntil: updatedUser.lockedUntil } : u));
      if (selectedUser?.id === user.id) {
        setSelectedUser(prev => prev ? { ...prev, lockedUntil: updatedUser.lockedUntil } : null);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Gagal merubah status suspensi.');
    } finally {
      setSuspending(null);
    }
  };

  const handlePlanChange = async (userId: string, newPlan: string) => {
    try {
      setUpdatingPlan(userId);
      const response = await API.patch(`/admin/users/${userId}/plan`, { plan: newPlan });
      const updatedUser = response.data.data.user;
      toast.success('Plan pengguna berhasil diperbarui!');
      
      // Update local state
      setUsers(prev => prev.map(u => u.id === userId ? { 
        ...u, 
        plan: newPlan, 
        subscriptionExpiresAt: updatedUser.subscriptionExpiresAt 
      } : u));
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { 
          ...prev, 
          plan: newPlan, 
          subscriptionExpiresAt: updatedUser.subscriptionExpiresAt 
        } : null);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Gagal mengubah plan pengguna.');
    } finally {
      setUpdatingPlan(null);
    }
  };

  const handleForcePasswordReset = async (user: UserItem) => {
    try {
      setForcingReset(user.id);
      await API.patch(`/admin/users/${user.id}/force-reset`);
      toast.success('User dipaksa reset kata sandi pada login berikutnya!');
      
      // Update local state
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, requirePasswordChange: true } : u));
      if (selectedUser?.id === user.id) {
        setSelectedUser(prev => prev ? { ...prev, requirePasswordChange: true } : null);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Gagal memicu paksa reset kata sandi.');
    } finally {
      setForcingReset(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    try {
      setDeleting(true);
      await API.delete(`/admin/users/${deleteConfirmUser.id}`);
      toast.success('Pengguna berhasil dihapus secara permanen.');
      setDeleteConfirmUser(null);
      setPage(1);
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Gagal menghapus pengguna.');
    } finally {
      setDeleting(false);
    }
  };

  const viewUserDetails = async (user: UserItem) => {
    setSelectedUser(user);
    setDetailStats(null);
    try {
      setLoadingDetails(true);
      const response = await API.get(`/admin/users/${user.id}`);
      setDetailStats(response.data.data.stats);
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal mengambil detail statistik pengguna.');
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <div className="space-y-6 relative text-black">
      <ToastContainer />

      {/* Top Filter and Search Bar */}
      <div className="bg-white border-3 border-black p-5 rounded-2xl shadow-neo flex flex-col md:flex-row gap-4 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="w-full md:flex-1 min-w-[280px]">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-black" />
            <input
              type="text"
              placeholder="Cari nama atau email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full neo-input pl-10 pr-24 py-2.5 text-sm font-bold"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-neoYellow border-2 border-black rounded-lg text-xs font-black shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all cursor-pointer text-black"
            >
              CARI
            </button>
          </div>
        </form>

        <div className="flex flex-wrap gap-3 w-full md:w-auto shrink-0 justify-end">
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="neo-input px-3 py-2 text-xs font-black bg-white cursor-pointer"
          >
            <option value="">Semua Role</option>
            <option value="user">USER</option>
            <option value="admin">ADMIN</option>
          </select>

          <select
            value={planFilter}
            onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
            className="neo-input px-3 py-2 text-xs font-black bg-white cursor-pointer"
          >
            <option value="">Semua Plan</option>
            <option value="free">FREE</option>
            <option value="pro">PRO</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="neo-input px-3 py-2 text-xs font-black bg-white cursor-pointer"
          >
            <option value="">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="suspended">Nonaktif (Suspended)</option>
          </select>

          {(roleFilter || planFilter || statusFilter || search) && (
            <button
              onClick={() => {
                setRoleFilter('');
                setPlanFilter('');
                setStatusFilter('');
                setSearch('');
                setPage(1);
              }}
              className="px-3 py-2 bg-neoOrange text-white border-2 border-black rounded-xl text-xs font-black shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> RESET
            </button>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border-3 border-black rounded-2xl shadow-neo overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader className="w-8 h-8 animate-spin text-black" />
            <p className="font-extrabold text-xs text-black/60 uppercase tracking-wider">Memuat Daftar User...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 px-4">
            <ShieldAlert className="w-10 h-10 mx-auto text-black/50 mb-3" />
            <h3 className="font-black text-base">Tidak Ada Pengguna Ditemukan</h3>
            <p className="text-sm text-black/50 font-semibold max-w-xs mx-auto mt-1">
              Gunakan kata kunci pencarian lain atau ubah filter pencarian.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#121214] text-white border-b-3 border-black text-[10px] font-black uppercase tracking-wider">
                  <th className="p-4 border-r-2 border-black">Pengguna</th>
                  <th className="p-4 border-r-2 border-black">Status</th>
                  <th className="p-4 border-r-2 border-black">Plan</th>
                  <th className="p-4 border-r-2 border-black">Role</th>
                  <th className="p-4 border-r-2 border-black">Verifikasi Email</th>
                  <th className="p-4 border-r-2 border-black">Tanggal Daftar</th>
                  <th className="p-4 text-center">Aksi Manajemen</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black text-sm font-bold">
                {users.map((usr) => {
                  const suspended = isUserSuspended(usr);
                  return (
                    <tr key={usr.id} className={`hover:bg-[#FAF9F5] transition-colors ${suspended ? 'bg-black/[0.03] text-black/50' : 'bg-white'}`}>
                      {/* Name */}
                      <td className="p-4 border-r-2 border-black flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center font-black text-xs shrink-0 select-none shadow-neo-sm ${
                          usr.role === 'admin' ? 'bg-neoPink' : 'bg-neoYellow'
                        }`}>
                          {usr.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className={`font-black truncate block max-w-[140px] ${suspended ? 'line-through text-black/40' : 'text-black'}`}>{usr.name}</span>
                          <span className="font-mono text-xxs text-black/45 block">{usr.email}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-4 border-r-2 border-black">
                        {suspended ? (
                          <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 bg-neoOrange text-white border-2 border-black rounded-lg font-black shadow-neo-sm">
                            <Ban className="w-3 h-3" /> SUSPENDED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 bg-neoMint text-black border-2 border-black rounded-lg font-black shadow-neo-sm">
                            <ShieldCheck className="w-3 h-3" /> AKTIF
                          </span>
                        )}
                      </td>

                      {/* Plan Selector */}
                      <td className="p-4 border-r-2 border-black">
                        <select
                          value={usr.plan}
                          disabled={updatingPlan === usr.id}
                          onChange={(e) => handlePlanChange(usr.id, e.target.value)}
                          className={`px-2 py-1 bg-white border-2 border-black rounded-lg text-xxs font-black cursor-pointer shadow-neo-sm uppercase ${
                            usr.plan === 'pro' ? 'text-purple-700 border-purple-900 bg-purple-50' : 'text-black'
                          }`}
                        >
                          <option value="free">FREE</option>
                          <option value="pro">PRO</option>
                        </select>
                      </td>

                      {/* Role Selector */}
                      <td className="p-4 border-r-2 border-black">
                        <select
                          value={usr.role}
                          disabled={updatingRole === usr.id}
                          onChange={(e) => handleRoleChange(usr.id, e.target.value)}
                          className="px-2 py-1 bg-white border-2 border-black rounded-lg text-xxs font-black cursor-pointer shadow-neo-sm uppercase"
                        >
                          <option value="user">USER</option>
                          <option value="admin">ADMIN</option>
                        </select>
                      </td>

                      {/* Email Verification Status */}
                      <td className="p-4 border-r-2 border-black text-center">
                        {usr.emailVerified ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-extrabold text-xs">
                            <CheckCircle className="w-4 h-4 fill-emerald-100 text-emerald-600 shrink-0" />
                            <span>Terverifikasi</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-black/40 font-extrabold text-xs">
                            <AlertCircle className="w-4 h-4 text-black/45 shrink-0" />
                            <span>Pending</span>
                          </span>
                        )}
                      </td>

                      {/* Join Date */}
                      <td className="p-4 border-r-2 border-black font-mono text-xs text-black/55">
                        {new Date(usr.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => viewUserDetails(usr)}
                            className="px-2.5 py-1.5 bg-neoCream text-black border-2 border-black rounded-lg text-xxs font-black shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all cursor-pointer"
                          >
                            DETAIL
                          </button>

                          <button
                            onClick={() => handleToggleSuspend(usr)}
                            disabled={suspending === usr.id}
                            className={`px-2.5 py-1.5 border-2 border-black rounded-lg text-xxs font-black shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all cursor-pointer flex items-center gap-1 ${
                              suspended ? 'bg-neoMint text-black' : 'bg-neoYellow text-black'
                            }`}
                            title={suspended ? "Aktifkan Akun" : "Suspend Akun"}
                          >
                            {suspending === usr.id ? (
                              <Loader className="w-3 h-3 animate-spin" />
                            ) : suspended ? (
                              <>
                                <Check className="w-3 h-3" /> AKTIFKAN
                              </>
                            ) : (
                              <>
                                <Ban className="w-3 h-3" /> SUSPEND
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleForcePasswordReset(usr)}
                            disabled={forcingReset === usr.id || usr.requirePasswordChange}
                            className={`p-1.5 border-2 border-black rounded-lg shadow-neo-sm transition-all flex items-center gap-1 ${
                              usr.requirePasswordChange 
                                ? 'bg-black/10 text-black/40 border-black/20 shadow-none cursor-not-allowed' 
                                : 'bg-white text-black hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none cursor-pointer'
                            }`}
                            title={usr.requirePasswordChange ? "Sandi sudah dipaksa diubah" : "Paksa Ganti Sandi"}
                          >
                            {forcingReset === usr.id ? (
                              <Loader className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <KeyRound className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            onClick={() => setDeleteConfirmUser(usr)}
                            className="p-1.5 bg-neoOrange text-white border-2 border-black rounded-lg shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all cursor-pointer"
                            title="Hapus Akun"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white border-3 border-black p-4 rounded-2xl shadow-neo font-black text-xs select-none">
          <button
            disabled={page === 1}
            onClick={() => setPage(prev => Math.max(prev - 1, 1))}
            className="px-4 py-2 bg-white border-2 border-black rounded-xl shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-neo-sm transition-all cursor-pointer text-black"
          >
            PREV
          </button>
          <span>HALAMAN {page} DARI {totalPages} ({totalItems} USER)</span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
            className="px-4 py-2 bg-white border-2 border-black rounded-xl shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-neo-sm transition-all cursor-pointer text-black"
          >
            NEXT
          </button>
        </div>
      )}

      {/* User Details Modal (Drawer) */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
          <div className="bg-white border-3 border-black rounded-2xl shadow-neo max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-black">
            {/* Modal Header */}
            <div className="bg-[#121214] text-white p-4 border-b-3 border-black flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-neoPink" />
                <h3 className="font-black text-sm uppercase tracking-wide text-white">Detail & Sesi Pengguna</h3>
              </div>
              <button 
                onClick={() => setSelectedUser(null)}
                className="p-1 rounded-lg border-2 border-white/20 hover:bg-white/10 text-white cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* User Bio */}
              <div className="flex items-center gap-4 border-b-2 border-black/10 pb-4">
                <div className="w-14 h-14 rounded-2xl bg-neoYellow border-2 border-black flex items-center justify-center font-black text-2xl shadow-neo-sm">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="font-black text-lg text-black leading-none mb-1.5">{selectedUser.name}</h4>
                  <p className="font-mono text-xs text-black/55 mb-2">{selectedUser.email}</p>
                  <div className="flex gap-2 flex-wrap">
                    <span className="neo-badge bg-neoViolet text-[8px] px-2 py-0.5 font-black uppercase shadow-neo-sm border-2 border-black text-white">
                      Role: {selectedUser.role}
                    </span>
                    <span className="neo-badge bg-purple-500 text-white text-[8px] px-2 py-0.5 font-black uppercase shadow-neo-sm border-2 border-black">
                      Plan: {selectedUser.plan}
                    </span>
                    {isUserSuspended(selectedUser) && (
                      <span className="neo-badge bg-neoOrange text-white text-[8px] px-2 py-0.5 font-black uppercase shadow-neo-sm border-2 border-black">
                        NONAKTIF
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Personal Statistics */}
              <div className="space-y-3">
                <h5 className="font-black text-xs uppercase tracking-wider text-black/50">📊 Statistik Penggunaan</h5>
                
                {loadingDetails ? (
                  <div className="flex justify-center py-6">
                    <Loader className="w-6 h-6 animate-spin text-black" />
                  </div>
                ) : detailStats ? (
                  <div className="grid grid-cols-2 gap-3">
                    {/* Stat 1: Total Tasks */}
                    <div className="border-2 border-black bg-neoCream p-3 rounded-xl shadow-neo-sm flex items-center gap-3">
                      <BookOpen className="w-5 h-5 text-black shrink-0" />
                      <div>
                        <p className="text-[9px] font-black text-black/40 uppercase">Total Tugas</p>
                        <p className="text-base font-black font-mono leading-none">{detailStats.totalTasks}</p>
                      </div>
                    </div>

                    {/* Stat 2: Completed Tasks */}
                    <div className="border-2 border-black bg-neoCream p-3 rounded-xl shadow-neo-sm flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-[9px] font-black text-black/40 uppercase">Tugas Selesai</p>
                        <p className="text-base font-black font-mono leading-none text-emerald-600">
                          {detailStats.completedTasks}
                        </p>
                      </div>
                    </div>

                    {/* Stat 3: Moodle Connected */}
                    <div className="border-2 border-black bg-neoCream p-3 rounded-xl shadow-neo-sm flex items-center gap-3">
                      <Clock className="w-5 h-5 text-black shrink-0" />
                      <div>
                        <p className="text-[9px] font-black text-black/40 uppercase">WeLearn Moodle</p>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border-2 border-black shadow-neo-sm ${
                          detailStats.moodleConnected ? 'bg-emerald-400 text-black' : 'bg-red-400 text-white'
                        }`}>
                          {detailStats.moodleConnected ? 'TERHUBUNG' : 'TERPUTUS'}
                        </span>
                      </div>
                    </div>

                    {/* Stat 4: Calendar Connected */}
                    <div className="border-2 border-black bg-neoCream p-3 rounded-xl shadow-neo-sm flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-black shrink-0" />
                      <div>
                        <p className="text-[9px] font-black text-black/40 uppercase">Google Calendar</p>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border-2 border-black shadow-neo-sm ${
                          detailStats.calendarConnected ? 'bg-emerald-400 text-black' : 'bg-red-400 text-white'
                        }`}>
                          {detailStats.calendarConnected ? 'TERHUBUNG' : 'TERPUTUS'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-bold text-red-500">
                    <AlertCircle className="w-4 h-4" />
                    <span>Gagal mengambil detail statistik</span>
                  </div>
                )}
              </div>

              {/* Security & Access Info */}
              <div className="space-y-3">
                <h5 className="font-black text-xs uppercase tracking-wider text-black/50">🔒 Informasi Keamanan</h5>
                <div className="bg-neoCream border-2 border-black p-3.5 rounded-xl space-y-2.5 font-bold text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-black/60">Verifikasi Email:</span>
                    <span className={`font-black ${selectedUser.emailVerified ? 'text-emerald-600' : 'text-red-500'}`}>
                      {selectedUser.emailVerified ? 'TERVERIFIKASI ✓' : 'PENDING ✗'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t border-black/10 pt-2.5">
                    <span className="text-black/60">Ganti Sandi Paksa:</span>
                    <span className={`font-black ${selectedUser.requirePasswordChange ? 'text-neoOrange' : 'text-black/40'}`}>
                      {selectedUser.requirePasswordChange ? 'PENGGANTIAN SANDI DIWAJIBKAN' : 'STATUS NORMAL'}
                    </span>
                  </div>
                  {selectedUser.subscriptionExpiresAt && (
                    <div className="flex justify-between items-center border-t border-black/10 pt-2.5">
                      <span className="text-black/60">Subskripsi Expires:</span>
                      <span className="font-mono text-black">
                        {new Date(selectedUser.subscriptionExpiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Area */}
              <div className="space-y-3 pt-3 border-t-2 border-black/10">
                <h5 className="font-black text-xs uppercase tracking-wider text-black/50">🛠️ Aksi Cepat Admin</h5>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => handleToggleSuspend(selectedUser)}
                    disabled={suspending === selectedUser.id}
                    className={`px-4 py-2 border-2 border-black rounded-xl text-xs font-black shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all cursor-pointer flex items-center gap-1.5 ${
                      isUserSuspended(selectedUser) ? 'bg-neoMint text-black' : 'bg-neoOrange text-white'
                    }`}
                  >
                    {isUserSuspended(selectedUser) ? (
                      <>
                        <Check className="w-4 h-4" /> AKTIFKAN AKUN
                      </>
                    ) : (
                      <>
                        <Ban className="w-4 h-4" /> SUSPEND/NONAKTIFKAN
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleForcePasswordReset(selectedUser)}
                    disabled={forcingReset === selectedUser.id || selectedUser.requirePasswordChange}
                    className={`px-4 py-2 border-2 border-black rounded-xl text-xs font-black shadow-neo-sm transition-all flex items-center gap-1.5 ${
                      selectedUser.requirePasswordChange 
                        ? 'bg-black/10 text-black/40 border-black/20 shadow-none cursor-not-allowed' 
                        : 'bg-white text-black hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none cursor-pointer'
                    }`}
                  >
                    <KeyRound className="w-4 h-4" /> PAKSA RESET KATA SANDI
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-[#121214]/5 p-4 border-t-3 border-black flex justify-end">
              <button 
                onClick={() => setSelectedUser(null)}
                className="px-5 py-2 bg-white border-2 border-black text-black rounded-xl font-black shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all cursor-pointer text-xs"
              >
                TUTUP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
          <div className="bg-white border-3 border-black rounded-2xl shadow-neo max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-center text-black">
            <div className="bg-neoOrange text-white p-4 border-b-3 border-black flex flex-col items-center gap-2">
              <ShieldAlert className="w-10 h-10 stroke-[2.5]" />
              <h3 className="font-black text-sm uppercase tracking-wide text-white">Konfirmasi Hapus</h3>
            </div>

            <div className="p-6 space-y-3">
              <p className="font-bold text-sm">
                Apakah Anda yakin ingin menghapus akun pengguna secara permanen?
              </p>
              <div className="bg-[#FAF9F5] border-2 border-black p-3 rounded-xl font-mono text-xs">
                <p className="font-black truncate">{deleteConfirmUser.name}</p>
                <p className="text-black/55 truncate">{deleteConfirmUser.email}</p>
              </div>
              <p className="text-red-500 font-extrabold text-[10px] uppercase">
                ⚠️ Seluruh data tugas, integrasi, dan chat history akan ikut dihapus secara permanen!
              </p>
            </div>

            <div className="bg-[#121214]/5 p-4 border-t-3 border-black flex justify-center gap-4">
              <button 
                disabled={deleting}
                onClick={() => setDeleteConfirmUser(null)}
                className="px-5 py-2 bg-white border-2 border-black rounded-xl font-black shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none disabled:opacity-50 transition-all cursor-pointer text-xs text-black"
              >
                BATAL
              </button>
              <button 
                disabled={deleting}
                onClick={handleDeleteUser}
                className="px-5 py-2 bg-neoOrange text-white border-2 border-black rounded-xl font-black shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none disabled:opacity-50 transition-all cursor-pointer text-xs flex items-center gap-2"
              >
                {deleting ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>YA, HAPUS</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
