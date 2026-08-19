'use client';

import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!localStorage.getItem('motion_pwa_dismissed')) {
        setTimeout(() => setShow(true), 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShow(false);
      localStorage.setItem('motion_pwa_installed', 'true');
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('motion_pwa_dismissed', 'true');
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed bottom-20 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:w-84 z-50
                     bg-white border-3 border-black shadow-neo rounded-2xl p-4 flex items-center gap-3"
        >
          <div className="w-10 h-10 bg-neoYellow border-2 border-black rounded-xl flex items-center justify-center shrink-0 shadow-neo-sm">
            <Download className="w-5 h-5 text-black font-extrabold" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="font-black text-xs text-black leading-tight">Install Motion App 📱</p>
            <p className="text-[11px] text-gray-600 font-semibold mt-0.5">Akses lebih cepat dari layar utama HP kamu!</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstall}
              className="neo-btn px-3 py-1.5 text-xs font-black bg-neoYellow hover:bg-amber-400 border-black"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="p-1 text-gray-400 hover:text-black transition-colors"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
