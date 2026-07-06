'use client';

import React, { useEffect, useState } from 'react';
import API from '../../../lib/api';
import { 
  Users, CheckSquare, Calendar, BookOpen, Clock, Loader,
  ShieldAlert, RefreshCw, Filter, Search
} from 'lucide-react';
import { toast } from '../../../hooks/useToast';
import { ToastContainer } from '../../../components/ui/Toast';

interface ActivityItem {
  timestamp: string;
  user: string;
  action: string;
  category: string;
  details: string;
}

export default function AdminActivity() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchActivities();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [categoryFilter, search, activities]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const response = await API.get('/admin/activity');
      setActivities(response.data.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal mengambil log aktivitas sistem.');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...activities];

    if (categoryFilter !== '') {
      result = result.filter(act => act.category === categoryFilter);
    }

    if (search.trim() !== '') {
      const q = search.toLowerCase();
      result = result.filter(act => 
        act.user.toLowerCase().includes(q) || 
        act.action.toLowerCase().includes(q) || 
        act.details.toLowerCase().includes(q)
      );
    }

    setFilteredActivities(result);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'user':
        return {
          icon: Users,
          bgColor: 'bg-neoViolet',
        };
      case 'task':
        return {
          icon: CheckSquare,
          bgColor: 'bg-neoBlue',
        };
      case 'moodle':
        return {
          icon: BookOpen,
          bgColor: 'bg-neoPink',
        };
      case 'calendar':
        return {
          icon: Calendar,
          bgColor: 'bg-neoYellow',
        };
      default:
        return {
          icon: Clock,
          bgColor: 'bg-neoCream',
        };
    }
  };

  return (
    <div className="space-y-6">
      <ToastContainer />

      {/* Filters bar */}
      <div className="bg-white border-3 border-black p-4 rounded-2xl shadow-neo flex flex-wrap gap-4 items-center justify-between">
        <div className="flex-1 min-w-[280px] relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-black" />
          <input
            type="text"
            placeholder="Cari log berdasarkan pengguna, aksi, atau rincian..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full neo-input pl-10 pr-4 py-2.5 text-sm font-bold"
          />
        </div>

        <div className="flex gap-3 flex-wrap items-center">
          <div className="flex items-center gap-1.5 text-xs font-black uppercase text-black">
            <Filter className="w-4 h-4" /> Filter
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="neo-input px-4 py-2.5 text-sm font-bold bg-white"
          >
            <option value="">Semua Kategori</option>
            <option value="user">Pengguna</option>
            <option value="task">Misi Kerja</option>
            <option value="moodle">WeLearn Moodle</option>
            <option value="calendar">Kalender</option>
          </select>

          <button
            onClick={fetchActivities}
            className="p-2.5 bg-neoCream border-2 border-black rounded-xl shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all cursor-pointer"
            title="Refresh Logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Logs container */}
      <div className="bg-white border-3 border-black p-6 rounded-2xl shadow-neo space-y-6">
        <div className="border-b-2 border-black pb-3 flex items-center justify-between">
          <h3 className="font-black text-base uppercase tracking-wider">
            ⚡ Audit System Activity Logs
          </h3>
          <span className="neo-badge bg-neoCream text-[9px] font-black py-0.5 px-2.5 border-2 border-black shadow-neo-sm">
            Total {filteredActivities.length} Aktivitas
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader className="w-8 h-8 animate-spin text-black" />
            <p className="font-extrabold text-xs text-black/60 uppercase tracking-wider">Mengambil logs terbaru...</p>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="text-center py-16 px-4">
            <ShieldAlert className="w-10 h-10 mx-auto text-black/50 mb-3" />
            <h3 className="font-black text-base">Tidak Ada Log Aktivitas</h3>
            <p className="text-sm text-black/50 font-semibold max-w-xs mx-auto mt-1">
              Gunakan kata kunci pencarian lain atau ubah filter kategori.
            </p>
          </div>
        ) : (
          <div className="relative border-l-3 border-black ml-4 pl-6 space-y-8 py-2">
            {filteredActivities.map((act, index) => {
              const meta = getCategoryIcon(act.category);
              const Icon = meta.icon;

              return (
                <div key={index} className="relative group">
                  {/* Timeline Dot Icon */}
                  <div className={`absolute -left-[38px] top-1.5 w-7 h-7 rounded-lg border-2 border-black ${meta.bgColor} flex items-center justify-center shadow-neo-sm shrink-0 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                  </div>

                  {/* Log Content Card */}
                  <div className="border-2 border-black bg-neoCream rounded-xl p-4 shadow-neo-sm group-hover:-translate-y-0.5 group-hover:shadow-neo transition-all text-left">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-black">{act.action}</span>
                        <span className="text-xs text-black/45">• oleh <b className="text-black font-black">{act.user}</b></span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-xxs font-mono text-black/55 bg-white border border-black px-1.5 py-0.2 rounded font-black">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>
                          {new Date(act.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} {new Date(act.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-gray-700 font-semibold leading-relaxed">
                      {act.details}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
