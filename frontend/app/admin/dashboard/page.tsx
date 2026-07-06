'use client';

import React, { useEffect, useState } from 'react';
import API from '../../../lib/api';
import { 
  Users, CheckSquare, Activity, ShieldAlert, Sparkles, Database,
  Brain, Mail, Loader, ArrowRight, TrendingUp, Clock
} from 'lucide-react';
import Link from 'next/link';
import { 
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, 
  PieChart, Pie, CartesianGrid
} from 'recharts';

interface SystemHealth {
  go_api: string;
  postgresql: string;
  ml_service: string;
  redis: string;
  mailpit: string;
}

interface UserGrowthItem {
  date: string;
  count: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface StatsData {
  totalUsers: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  activeUsers24h: number;
  systemHealth: SystemHealth;
  userGrowth: UserGrowthItem[];
  recentUsers: User[];
}

// Custom Tooltip for User Growth BarChart
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border-2 border-black p-3 rounded-xl shadow-neo-sm">
        <p className="font-black text-[10px] uppercase tracking-wider text-black/55 mb-1">{label}</p>
        <p className="font-extrabold text-sm text-black">
          Registrasi: <span className="font-mono text-purple-600 font-black">{payload[0].value} User</span>
        </p>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Task Status PieChart
const PieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white border-2 border-black p-3 rounded-xl shadow-neo-sm">
        <p className="font-extrabold text-sm text-black" style={{ color: data.color }}>
          {data.name}: <span className="font-mono text-black font-black">{data.value} Misi</span>
        </p>
      </div>
    );
  }
  return null;
};

// Custom Neobrutalist Bar Shape
const NeobrutalistBar = (props: any) => {
  const { fill, x, y, width, height } = props;
  if (!height || height <= 0) return null;
  return (
    <g className="group cursor-pointer">
      {/* Shadow */}
      <rect x={x + 4} y={y + 4} width={width} height={height} fill="#1D2A44" rx={4} />
      {/* Main Bar */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="#1D2A44"
        strokeWidth={2}
        rx={4}
        className="transition-all duration-150 group-hover:-translate-y-1.5 group-hover:-translate-x-1.5"
      />
    </g>
  );
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await API.get('/admin/stats');
      setStats(response.data.data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Gagal mengambil data statistik admin.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader className="w-10 h-10 animate-spin text-black" />
        <p className="font-extrabold text-sm text-black/60 uppercase tracking-wider">Memuat Dashboard Stats...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-neoOrange border-3 border-black p-8 rounded-2xl shadow-neo text-white text-center max-w-xl mx-auto mt-10">
        <ShieldAlert className="w-12 h-12 mx-auto mb-4 stroke-[2.5]" />
        <h3 className="font-black text-lg mb-2">Terjadi Kesalahan</h3>
        <p className="font-bold mb-4">{error || 'Gagal memuat data.'}</p>
        <button 
          onClick={fetchStats}
          className="px-6 py-2.5 bg-white text-black border-2 border-black rounded-xl font-black shadow-neo-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all cursor-pointer"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  // Data for Task Status Donut PieChart
  const totalTasks = stats.completedTasks + stats.pendingTasks;
  const taskPieData = totalTasks === 0
    ? [{ name: 'Belum Ada Misi', value: 1, color: '#E2E8F0' }]
    : [
        { name: 'Selesai', value: stats.completedTasks, color: '#38BDF8' }, // Neo Mint (Bright Sky Blue)
        { name: 'Tertunda', value: stats.pendingTasks, color: '#FF7A00' }  // Neo Orange
      ];

  const completionRate = totalTasks > 0 
    ? Math.round((stats.completedTasks / totalTasks) * 100) 
    : 0;

  // Rotating Neobrutalist accents for the growth bars
  const barColors = ['#FBBF24', '#38BDF8', '#EC4899', '#FF7A00', '#8B5CF6', '#30E3CA', '#EF4444'];

  return (
    <div className="space-y-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Total Users */}
        <div className="bg-white border-3 border-black p-6 rounded-2xl shadow-neo flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-black/50 uppercase tracking-wider">TOTAL PENGGUNA</span>
            <p className="text-4xl font-black font-mono leading-none">{stats.totalUsers}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-neoYellow border-2 border-black flex items-center justify-center shadow-neo-sm shrink-0">
            <Users className="w-6 h-6 text-black" />
          </div>
        </div>

        {/* Card 2: Total Misi */}
        <div className="bg-white border-3 border-black p-6 rounded-2xl shadow-neo flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-black/50 uppercase tracking-wider">MISI TERDAFTAR</span>
            <p className="text-4xl font-black font-mono leading-none">{stats.totalTasks}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-neoBlue border-2 border-black flex items-center justify-center shadow-neo-sm shrink-0">
            <CheckSquare className="w-6 h-6 text-black" />
          </div>
        </div>

        {/* Card 3: Misi Selesai */}
        <div className="bg-white border-3 border-black p-6 rounded-2xl shadow-neo flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-black/50 uppercase tracking-wider">MISI DISELESAIKAN</span>
            <p className="text-4xl font-black font-mono leading-none text-emerald-600">{stats.completedTasks}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-neoPink border-2 border-black flex items-center justify-center shadow-neo-sm shrink-0">
            <Activity className="w-6 h-6 text-black" />
          </div>
        </div>

        {/* Card 4: Sesi Aktif 24h */}
        <div className="bg-white border-3 border-black p-6 rounded-2xl shadow-neo flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-black/50 uppercase tracking-wider">USER AKTIF 24 JAM</span>
            <p className="text-4xl font-black font-mono leading-none text-purple-600">{stats.activeUsers24h}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-neoViolet border-2 border-black flex items-center justify-center shadow-neo-sm shrink-0">
            <Sparkles className="w-6 h-6 text-black" />
          </div>
        </div>
      </div>

      {/* Row 1: Charts Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* User Growth Chart */}
        <div className="lg:col-span-2 bg-white border-3 border-black p-6 rounded-2xl shadow-neo flex flex-col justify-between min-h-[360px]">
          <div>
            <h3 className="font-black text-base border-b-2 border-black pb-3 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-black" /> Pertumbuhan Registrasi User (7 Hari Terakhir)
            </h3>
          </div>
          <div className="h-64 w-full relative pt-6 flex-1 overflow-visible">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%" className="overflow-visible">
                <BarChart
                  data={stats.userGrowth}
                  margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                  style={{ overflow: 'visible' }}
                >
                  <CartesianGrid stroke="rgba(29, 42, 68, 0.08)" strokeWidth={1} strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#1D2A44" 
                    strokeWidth={1.5} 
                    tickLine={false} 
                    className="font-extrabold text-[10px] uppercase font-mono" 
                  />
                  <YAxis 
                    stroke="#1D2A44" 
                    strokeWidth={1.5} 
                    tickLine={false} 
                    className="font-extrabold text-[10px] font-mono" 
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                  <Bar 
                    dataKey="count" 
                    shape={<NeobrutalistBar />}
                  >
                    {stats.userGrowth.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={barColors[index % barColors.length]} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full bg-slate-100 animate-pulse border-2 border-dashed border-black/10 rounded-xl" />
            )}
          </div>
        </div>

        {/* Task Completion Donut Chart */}
        <div className="lg:col-span-1 bg-white border-3 border-black p-6 rounded-2xl shadow-neo flex flex-col justify-between min-h-[360px]">
          <div>
            <h3 className="font-black text-base border-b-2 border-black pb-3 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-5 h-5 text-black" /> Status Penyelesaian Misi
            </h3>
            
            <div className="h-44 w-full flex items-center justify-center relative mt-4">
              {mounted ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip content={<PieTooltip />} />
                      <Pie
                        data={taskPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {taskPieData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.color} 
                            stroke="#1D2A44" 
                            strokeWidth={2} 
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute text-center bg-white border-2 border-black px-4 py-2.5 rounded-xl shadow-neo-sm">
                    <span className="text-[9px] font-black uppercase text-black/50 tracking-wider block">Rasio Selesai</span>
                    <span className="text-2xl font-mono font-black text-black block leading-none mt-0.5">
                      {completionRate}%
                    </span>
                  </div>
                </>
              ) : (
                <div className="w-32 h-32 rounded-full border-8 border-dashed border-slate-200 animate-spin" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4 border-t-2 border-black mt-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-black rounded bg-[#38BDF8] shadow-neo-sm shrink-0" />
              <div className="text-[10px] leading-tight">
                <span className="font-black text-black block uppercase">Selesai</span>
                <span className="font-mono text-black/60 font-bold block">{stats.completedTasks} Misi</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-black rounded bg-[#FF7A00] shadow-neo-sm shrink-0" />
              <div className="text-[10px] leading-tight">
                <span className="font-black text-black block uppercase">Tertunda</span>
                <span className="font-mono text-black/60 font-bold block">{stats.pendingTasks} Misi</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Health Indicators & Recent Users */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: System Services Health */}
        <div className="lg:col-span-2 bg-white border-3 border-black p-6 rounded-2xl shadow-neo space-y-5">
          <h3 className="font-black text-base border-b-2 border-black pb-3 uppercase tracking-wider">
            🖥️ Status Kesehatan Layanan & Infrastruktur
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Go Api */}
            <div className="border-2 border-black p-4 rounded-xl flex items-center justify-between bg-neoCream shadow-neo-sm">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-black" />
                <span className="font-extrabold text-sm uppercase tracking-wide">Go backend</span>
              </div>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-black animate-pulse" />
                <span className="text-[10px] font-black text-emerald-700 uppercase">ONLINE</span>
              </span>
            </div>

            {/* PostgreSQL */}
            <div className="border-2 border-black p-4 rounded-xl flex items-center justify-between bg-neoCream shadow-neo-sm">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-black" />
                <span className="font-extrabold text-sm uppercase tracking-wide">PostgreSQL</span>
              </div>
              <span className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full border border-black ${stats.systemHealth.postgresql === 'healthy' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span className={`text-[10px] font-black uppercase ${stats.systemHealth.postgresql === 'healthy' ? 'text-emerald-700' : 'text-red-700'}`}>
                  {stats.systemHealth.postgresql === 'healthy' ? 'ONLINE' : 'OFFLINE'}
                </span>
              </span>
            </div>

            {/* ML Service */}
            <div className="border-2 border-black p-4 rounded-xl flex items-center justify-between bg-neoCream shadow-neo-sm">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-black" />
                <span className="font-extrabold text-sm uppercase tracking-wide">Python ML</span>
              </div>
              <span className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full border border-black ${stats.systemHealth.ml_service === 'healthy' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span className={`text-[10px] font-black uppercase ${stats.systemHealth.ml_service === 'healthy' ? 'text-emerald-700' : 'text-red-700'}`}>
                  {stats.systemHealth.ml_service === 'healthy' ? 'ONLINE' : 'OFFLINE'}
                </span>
              </span>
            </div>

            {/* Redis */}
            <div className="border-2 border-black p-4 rounded-xl flex items-center justify-between bg-neoCream shadow-neo-sm">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-black" />
                <span className="font-extrabold text-sm uppercase tracking-wide">Redis Queue</span>
              </div>
              <span className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full border border-black ${stats.systemHealth.redis === 'healthy' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span className={`text-[10px] font-black uppercase ${stats.systemHealth.redis === 'healthy' ? 'text-emerald-700' : 'text-red-700'}`}>
                  {stats.systemHealth.redis === 'healthy' ? 'ONLINE' : 'OFFLINE'}
                </span>
              </span>
            </div>

            {/* Mailpit */}
            <div className="border-2 border-black p-4 rounded-xl flex items-center justify-between bg-neoCream shadow-neo-sm">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-black" />
                <span className="font-extrabold text-sm uppercase tracking-wide">Mailpit</span>
              </div>
              <span className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full border border-black ${stats.systemHealth.mailpit === 'healthy' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span className={`text-[10px] font-black uppercase ${stats.systemHealth.mailpit === 'healthy' ? 'text-emerald-700' : 'text-red-700'}`}>
                  {stats.systemHealth.mailpit === 'healthy' ? 'ONLINE' : 'OFFLINE'}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Recent Registered Users */}
        <div className="bg-white border-3 border-black p-6 rounded-2xl shadow-neo flex flex-col h-full min-h-[420px]">
          <h3 className="font-black text-base border-b-2 border-black pb-3 uppercase tracking-wider mb-4">
            👥 Pengguna Baru Terdaftar
          </h3>
          
          <div className="flex-1 space-y-4">
            {stats.recentUsers.map((usr) => (
              <div 
                key={usr.id} 
                className="flex items-center justify-between p-3 border-2 border-black rounded-xl bg-neoCream transition-all hover:-translate-y-0.5 hover:shadow-neo-sm"
              >
                <div className="min-w-0">
                  <p className="font-black text-sm truncate leading-none mb-1">{usr.name}</p>
                  <p className="font-semibold text-xs text-black/55 truncate mb-1.5">{usr.email}</p>
                  <span className="neo-badge bg-neoViolet text-[8px] px-2 py-0.5 font-black uppercase tracking-wider shadow-neo-sm">
                    {usr.role}
                  </span>
                </div>
                <div className="text-right text-[10px] font-mono text-black/45 font-black shrink-0 ml-2">
                  {new Date(usr.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t-2 border-dashed border-black/10">
            <Link 
              href="/admin/users" 
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-neoBlue text-black border-2 border-black rounded-xl font-black shadow-neo-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all text-sm select-none"
            >
              <span>Kelola Semua Pengguna</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
