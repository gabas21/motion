/**
 * config.ts — Validasi dan ekspor semua environment variables frontend.
 *
 * Semua akses ke env vars harus melalui file ini, bukan process.env langsung.
 * Ini memastikan error langsung terdeteksi saat startup, bukan saat runtime.
 */

const requiredVars = {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
} as const;

// Validasi saat module di-load (hanya di server-side / build time)
if (typeof window === 'undefined') {
  for (const [key, value] of Object.entries(requiredVars)) {
    if (!value) {
      console.error(`[Config] ❌ Environment variable wajib tidak ditemukan: ${key}`);
      console.error(`[Config] Pastikan file .env.local sudah dikonfigurasi dengan benar.`);
      // Tidak throw agar tidak break build, tapi log error yang jelas
    }
  }
}

export const config = {
  /** Base URL untuk API backend. Default ke localhost jika tidak dikonfigurasi. */
  apiUrl: requiredVars.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1',

  /** Nama aplikasi untuk ditampilkan di UI */
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'Motion',

  /** Versi aplikasi */
  appVersion: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',

  /** True jika berjalan di environment development */
  isDevelopment: process.env.NODE_ENV === 'development',

  /** True jika berjalan di production */
  isProduction: process.env.NODE_ENV === 'production',
} as const;

export type AppConfig = typeof config;
