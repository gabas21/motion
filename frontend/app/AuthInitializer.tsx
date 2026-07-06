'use client';

import { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

// AuthInitializer: komponen client ringan yang memicu validasi sesi ke backend
// satu kali saat aplikasi pertama dimuat. Ini yang mengubah isInitialized → true
// sehingga skeleton loading di halaman login bisa hilang.
export default function AuthInitializer() {
  const { initializeAuth } = useAuth();

  useEffect(() => {
    initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
