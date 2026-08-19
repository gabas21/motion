'use client';

import React from 'react';
import { LayoutDashboard, CheckCircle2, Calendar, BookOpen, User } from 'lucide-react';
import { motion } from 'framer-motion';

interface MobileBottomNavProps {
  activeTab: string;
  onTabChange: (tab: any) => void;
}

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Overview',  tab: 'overview' },
  { icon: CheckCircle2,    label: 'Tugas',     tab: 'list' },
  { icon: Calendar,        label: 'Kalender',  tab: 'calendar' },
  { icon: BookOpen,        label: 'WeLearn',   tab: 'welearn' },
  { icon: User,            label: 'Profil',    tab: 'profile' },
];

export default function MobileBottomNav({ activeTab, onTabChange }: MobileBottomNavProps) {
  return (
    <div className="fixed bottom-3 left-3 right-3 max-w-md mx-auto z-50 md:hidden safe-area-inset-bottom">
      <nav 
        aria-label="Navigasi Utama Mobile"
        className="bg-white/95 backdrop-blur-xl border-3 border-black rounded-[24px] px-1.5 py-1.5 shadow-[5px_5px_0px_#000] relative overflow-hidden"
      >
        {/* Accent line inside dock */}
        <div className="absolute top-0 left-6 right-6 h-1 bg-neoYellow/80 rounded-full" />

        <div className="flex items-center justify-around" role="tablist">
          {NAV_ITEMS.map(({ icon: Icon, label, tab }) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                role="tab"
                aria-selected={isActive}
                aria-label={`Tab ${label}`}
                onClick={() => onTabChange(tab)}
                className="flex flex-col items-center justify-center gap-0.5 py-1 px-2.5 rounded-2xl relative min-w-[48px] min-h-[44px] cursor-pointer transition-transform active:scale-90 select-none focus-visible:ring-2 focus-visible:ring-neoBlue"
              >
                {isActive && (
                  <motion.div
                    layoutId="mobile-nav-dock-pill"
                    className="absolute inset-0 bg-neoYellow rounded-2xl border-2 border-black shadow-[1.5px_1.5px_0px_#000]"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  />
                )}
                <Icon
                  className={`w-5 h-5 relative z-10 transition-transform duration-200 ${
                    isActive ? 'text-black scale-110 stroke-[2.5]' : 'text-gray-600 hover:text-black'
                  }`}
                />
                <span
                  className={`text-[10px] font-black tracking-tight relative z-10 ${
                    isActive ? 'text-black font-heading' : 'text-gray-600 font-bold'
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
