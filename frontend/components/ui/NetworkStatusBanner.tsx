'use client';

import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, X } from 'lucide-react';

export default function NetworkStatusBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 animate-bounce">
      <div className="bg-amber-400 border-3 border-black text-black px-4 py-3 rounded-2xl shadow-neo flex items-center gap-3 text-xs font-black">
        <WifiOff className="w-5 h-5 text-black shrink-0 animate-pulse" />
        <div>
          <p className="leading-tight">Koneksi Terputus!</p>
          <p className="text-[10px] font-bold text-black/70">Anda sedang dalam Mode Offline (PWA Cache)</p>
        </div>
        <button
          onClick={() => setIsOffline(false)}
          className="p-1 hover:bg-black/10 rounded-lg transition-colors cursor-pointer ml-2"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
