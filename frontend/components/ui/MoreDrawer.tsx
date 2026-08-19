'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Link2, Sliders, CreditCard, FileText, LogOut, X } from 'lucide-react';

interface MoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  onLogout: () => void;
  user: { name: string; email?: string } | null;
}

export default function MoreDrawer({ isOpen, onClose, onNavigate, onLogout, user }: MoreDrawerProps) {
  const menuItems = [
    { icon: User,       label: 'Profil Pengguna',    tab: 'profile' },
    { icon: Link2,      label: 'Integrasi',          tab: 'integrations' },
    { icon: Sliders,    label: 'Preferensi AI',      tab: 'preferences' },
    { icon: CreditCard, label: 'Langganan Pro',      tab: 'billing' },
    { icon: FileText,   label: 'Surat Izin Praktikum', tab: 'excuse-letter' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] md:hidden"
          />

          {/* Bottom Drawer Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            className="fixed bottom-0 left-0 right-0 bg-white border-t-3 border-black rounded-t-[28px] shadow-neo-lg z-[201] p-5 max-w-md mx-auto md:hidden select-none safe-area-inset-bottom"
          >
            {/* Top Drag Handle */}
            <div className="w-12 h-1.5 bg-black/20 rounded-full mx-auto mb-4" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-2 border-b-2 border-black/10">
              <h3 className="font-heading font-black text-base text-black">Menu Lainnya</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-black hover:bg-gray-200 transition-colors"
                aria-label="Tutup Menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation List */}
            <div className="space-y-1 my-3">
              {menuItems.map(({ icon: Icon, label, tab }) => (
                <button
                  key={tab}
                  onClick={() => onNavigate(tab)}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl hover:bg-neoYellow/20 active:bg-neoYellow border border-transparent hover:border-black/20 transition-all text-left font-bold text-sm text-black"
                >
                  <div className="w-8 h-8 rounded-xl bg-neoYellow/40 border border-black/20 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-black" />
                  </div>
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Logout button */}
            <div className="pt-3 border-t-2 border-black/10 mt-2">
              <button
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-red-50 hover:bg-red-100 text-red-700 font-black text-sm border-2 border-red-200 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar Sesi</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
