'use client';

import React, { useState, useEffect } from 'react';
import { 
  Home, Target, Calendar, BarChart2, 
  GraduationCap, Building2, FileText, 
  User, Link2, Sliders, CreditCard, 
  LogOut, Sparkles, ChevronLeft, ChevronRight,
  Menu, PanelLeftClose, PanelLeftOpen, Bot
} from 'lucide-react';

interface DashboardSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  user: { name: string; email?: string } | null;
  onLogout: () => void;
}

export default function DashboardSidebar({ activeTab, onTabChange, user, onLogout }: DashboardSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  useEffect(() => {
    const saved = localStorage.getItem('motion_sidebar_collapsed');
    if (saved === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('motion_sidebar_collapsed', String(next));
      return next;
    });
  };

  const isTabActive = (tab: string) => activeTab === tab;

  return (
    <aside 
      className={`${
        isCollapsed ? 'w-16' : 'w-64'
      } h-screen bg-white border-r-2 border-black flex flex-col p-3 select-none transition-all duration-300 relative shrink-0`}
    >
      {/* Brand Header & Toggle Button */}
      <div className={`flex items-center ${isCollapsed ? 'justify-center py-2' : 'justify-between px-1 py-3'} mb-2`}>
        {isCollapsed ? (
          <button
            onClick={toggleCollapse}
            className="w-9 h-9 rounded-xl bg-neoYellow border-2 border-black flex items-center justify-center shadow-neo-sm hover:scale-105 active:scale-95 transition-transform cursor-pointer"
            title="Buka Sidebar"
            aria-label="Buka Sidebar"
          >
            <Sparkles className="w-5 h-5 text-black" />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2.5 min-w-0">
              <div 
                onClick={toggleCollapse}
                className="w-8 h-8 rounded-lg bg-neoYellow border-2 border-black flex items-center justify-center shadow-neo-sm shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                title="Tutup Sidebar"
              >
                <Sparkles className="w-4 h-4 text-black" />
              </div>
              <span className="font-heading font-black text-xl tracking-tight text-black truncate">Motion</span>
            </div>

            <button
              onClick={toggleCollapse}
              className="w-7 h-7 rounded-lg border-2 border-black bg-white hover:bg-neoYellow/30 flex items-center justify-center text-black shadow-neo-sm transition-all cursor-pointer shrink-0"
              title="Tutup Sidebar"
              aria-label="Tutup Sidebar"
            >
              <ChevronLeft size={14} className="stroke-[3]" />
            </button>
          </>
        )}
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto space-y-1 px-1 py-1 custom-scrollbar">
        {/* Beranda */}
        <button
          onClick={() => onTabChange('overview')}
          title="Beranda"
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3 py-2.5'} rounded-xl text-sm font-bold transition-all text-left cursor-pointer ${
            isTabActive('overview')
              ? 'bg-neoYellow border-2 border-black shadow-neo-sm text-black'
              : 'hover:bg-neoYellow/20 text-gray-700 hover:text-black'
          }`}
        >
          <Home className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Beranda</span>}
        </button>

        {/* PRODUKTIVITAS */}
        <div className="pt-3 pb-1">
          {!isCollapsed ? (
            <p className="text-[9px] font-black uppercase tracking-widest text-black/40 px-3">Produktivitas</p>
          ) : (
            <div className="h-px bg-black/10 my-1" />
          )}
        </div>

        <button
          onClick={() => onTabChange('list')}
          title="Misi"
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3 py-2.5'} rounded-xl text-sm font-bold transition-all text-left cursor-pointer ${
            isTabActive('list')
              ? 'bg-neoYellow border-2 border-black shadow-neo-sm text-black'
              : 'hover:bg-neoYellow/20 text-gray-700 hover:text-black'
          }`}
        >
          <Target className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Misi</span>}
        </button>

        <button
          onClick={() => onTabChange('calendar')}
          title="Agenda"
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3 py-2.5'} rounded-xl text-sm font-bold transition-all text-left cursor-pointer ${
            isTabActive('calendar')
              ? 'bg-neoYellow border-2 border-black shadow-neo-sm text-black'
              : 'hover:bg-neoYellow/20 text-gray-700 hover:text-black'
          }`}
        >
          <Calendar className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Agenda</span>}
        </button>

        <button
          onClick={() => onTabChange('analytics')}
          title="Analitik"
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3 py-2.5'} rounded-xl text-sm font-bold transition-all text-left cursor-pointer ${
            isTabActive('analytics')
              ? 'bg-neoYellow border-2 border-black shadow-neo-sm text-black'
              : 'hover:bg-neoYellow/20 text-gray-700 hover:text-black'
          }`}
        >
          <BarChart2 className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Analitik</span>}
        </button>

        {/* AKADEMIK */}
        <div className="pt-3 pb-1">
          {!isCollapsed ? (
            <p className="text-[9px] font-black uppercase tracking-widest text-black/40 px-3">Akademik</p>
          ) : (
            <div className="h-px bg-black/10 my-1" />
          )}
        </div>

        <button
          onClick={() => onTabChange('welearn')}
          title="WeLearn"
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3 py-2.5'} rounded-xl text-sm font-bold transition-all text-left cursor-pointer ${
            isTabActive('welearn')
              ? 'bg-neoYellow border-2 border-black shadow-neo-sm text-black'
              : 'hover:bg-neoYellow/20 text-gray-700 hover:text-black'
          }`}
        >
          <GraduationCap className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>WeLearn</span>}
        </button>

        <button
          onClick={() => onTabChange('siak')}
          title="SIAK Wicida"
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3 py-2.5'} rounded-xl text-sm font-bold transition-all text-left cursor-pointer ${
            isTabActive('siak')
              ? 'bg-neoYellow border-2 border-black shadow-neo-sm text-black'
              : 'hover:bg-neoYellow/20 text-gray-700 hover:text-black'
          }`}
        >
          <Building2 className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>SIAK Wicida</span>}
        </button>

        <button
          onClick={() => onTabChange('excuse-letter')}
          title="Surat Izin Praktikum"
          className={`flex items-center ${
            isCollapsed 
              ? 'w-full justify-center px-2 py-2.5' 
              : 'w-[calc(100%-0.75rem)] ml-3 gap-2 px-3 py-2 text-xs'
          } rounded-xl font-bold transition-all text-left cursor-pointer ${
            isTabActive('excuse-letter')
              ? 'bg-neoYellow border-2 border-black shadow-neo-sm text-black'
              : 'hover:bg-neoYellow/20 text-gray-700 hover:text-black'
          }`}
        >
          <FileText className="w-3.5 h-3.5 shrink-0" />
          {!isCollapsed && <span>Surat Izin</span>}
        </button>

        {/* AI ASISTEN */}
        <div className="pt-3 pb-1">
          {!isCollapsed ? (
            <p className="text-[9px] font-black uppercase tracking-widest text-black/40 px-3">AI Asisten</p>
          ) : (
            <div className="h-px bg-black/10 my-1" />
          )}
        </div>

        <button
          onClick={() => onTabChange('asep-ai')}
          title="Asep AI Workspace"
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3 py-2.5'} rounded-xl text-sm font-bold transition-all text-left cursor-pointer ${
            isTabActive('asep-ai')
              ? 'bg-neoYellow border-2 border-black shadow-neo-sm text-black'
              : 'hover:bg-neoYellow/20 text-gray-700 hover:text-black'
          }`}
        >
          <Bot className="w-4 h-4 shrink-0 text-purple-600" />
          {!isCollapsed && <span>Asep AI</span>}
        </button>

        {/* PENGATURAN */}
        <div className="pt-3 pb-1">
          {!isCollapsed ? (
            <p className="text-[9px] font-black uppercase tracking-widest text-black/40 px-3">Pengaturan</p>
          ) : (
            <div className="h-px bg-black/10 my-1" />
          )}
        </div>

        <button
          onClick={() => onTabChange('profile')}
          title="Profil"
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3 py-2.5'} rounded-xl text-sm font-bold transition-all text-left cursor-pointer ${
            isTabActive('profile')
              ? 'bg-neoYellow border-2 border-black shadow-neo-sm text-black'
              : 'hover:bg-neoYellow/20 text-gray-700 hover:text-black'
          }`}
        >
          <User className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Profil</span>}
        </button>

        <button
          onClick={() => onTabChange('integrations')}
          title="Integrasi"
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3 py-2.5'} rounded-xl text-sm font-bold transition-all text-left cursor-pointer ${
            isTabActive('integrations')
              ? 'bg-neoYellow border-2 border-black shadow-neo-sm text-black'
              : 'hover:bg-neoYellow/20 text-gray-700 hover:text-black'
          }`}
        >
          <Link2 className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Integrasi</span>}
        </button>

        <button
          onClick={() => onTabChange('preferences')}
          title="Preferensi AI"
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3 py-2.5'} rounded-xl text-sm font-bold transition-all text-left cursor-pointer ${
            isTabActive('preferences')
              ? 'bg-neoYellow border-2 border-black shadow-neo-sm text-black'
              : 'hover:bg-neoYellow/20 text-gray-700 hover:text-black'
          }`}
        >
          <Sliders className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Preferensi AI</span>}
        </button>

        <button
          onClick={() => onTabChange('billing')}
          title="Langganan"
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3 py-2.5'} rounded-xl text-sm font-bold transition-all text-left cursor-pointer ${
            isTabActive('billing')
              ? 'bg-neoYellow border-2 border-black shadow-neo-sm text-black'
              : 'hover:bg-neoYellow/20 text-gray-700 hover:text-black'
          }`}
        >
          <CreditCard className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Langganan</span>}
        </button>
      </div>

      {/* User Section at Bottom */}
      <div className="pt-3 border-t-2 border-black/10 mt-auto">
        {user && (
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5 px-2'} py-1.5 mb-1.5`}>
            <div 
              className="w-7 h-7 rounded-full bg-neoMint border-2 border-black font-black text-xs flex items-center justify-center shrink-0"
              title={user.name}
            >
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-black truncate">{user.name}</p>
                {user.email && <p className="text-[10px] text-gray-500 truncate">{user.email}</p>}
              </div>
            )}
          </div>
        )}
        <button
          onClick={onLogout}
          title="Keluar Sesi"
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-2 px-3'} py-2 rounded-xl text-xs font-bold text-gray-600 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer`}
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          {!isCollapsed && <span>Keluar Sesi</span>}
        </button>
      </div>
    </aside>
  );
}
