import React from 'react';
import {
  SunIcon,
  MoonIcon,
  CloudIcon,
  PartlyCloudyIcon,
  RainIcon,
  HeavyRainIcon,
  SnowIcon,
  ThunderIcon,
  FogIcon,
  WindIcon,
} from '../components/ui/animated-weather-icons';

export type WeatherTheme = {
  name: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  bgGradient: string;           // CSS gradient string for the outer page background
  glassCard: string;            // Tailwind classes for glassmorphism card
  glassCardBorder: string;      // border color for cards
  accent: string;               // primary accent hex for text/icons
  accentTw: string;             // Tailwind accent class
  badgeBg: string;              // badge background
  badgeText: string;            // badge text color
  recommendation: string;
  particleType: 'rain' | 'snow' | 'sun' | 'thunder' | 'fog' | 'wind' | 'clear-night' | 'partly-cloudy' | 'cloud' | 'none';
  headerGlow: string;           // glow color behind the weather icon header
  textColor: string;            // primary text color (dark or light depending on bg)
  subtextColor: string;         // subtext color
  isDark: boolean;              // is this a dark/night theme (high-contrast dark mode)
};

// ─── WEATHERAPI.COM CONDITION CODE → WMO CODE MAPPER ────────────────────────
// WeatherAPI pakai kode sendiri, kita map ke kode WMO yang sudah dipakai getWeatherTheme()
export function mapWeatherAPICode(code: number, isDay: number): number {
  if (code === 1000) return isDay ? 0 : 0;             // Clear/Sunny
  if ([1003].includes(code)) return 1;                 // Partly cloudy
  if ([1006, 1009].includes(code)) return 3;           // Cloudy/Overcast
  if ([1030, 1135, 1147].includes(code)) return 45;   // Mist/Fog
  if ([1063, 1150, 1153].includes(code)) return 51;   // Light drizzle
  if ([1168, 1171].includes(code)) return 53;          // Moderate drizzle
  if ([1180, 1183].includes(code)) return 61;          // Light rain
  if ([1186, 1189].includes(code)) return 63;          // Moderate rain
  if ([1192, 1195, 1240, 1243, 1246].includes(code)) return 65; // Heavy rain
  if ([1198, 1201].includes(code)) return 65;          // Heavy freezing rain
  if ([1066, 1114, 1210, 1213].includes(code)) return 71; // Light snow
  if ([1117, 1216, 1219].includes(code)) return 73;   // Moderate snow
  if ([1222, 1225, 1237, 1255, 1258].includes(code)) return 75; // Heavy snow
  if ([1069, 1072, 1204, 1207, 1249, 1252].includes(code)) return 77; // Ice pellets
  if ([1087].includes(code)) return 95;                // Thundery
  if ([1273, 1276].includes(code)) return 95;          // Thunder with rain
  if ([1279, 1282].includes(code)) return 99;          // Thunder with snow/hail
  return 3; // fallback: cloudy
}

// ─── PERCEPTION FILTER ───────────────────────────────────────────────────────
// Jika curah hujan sangat sedikit, jangan tampilkan tema hujan.
// Pengguna yang melihat keluar hanya mendung tidak akan kebingungan.
export function applyPerceptionFilter(
  wmoCode: number,
  precip_mm: number,
  cloud: number,
  is_day: number
): number {
  const isRainCode = [51, 53, 55, 61, 63, 65].includes(wmoCode);
  if (!isRainCode) return wmoCode;

  // Curah hujan sangat ringan (< 0.5mm) → tampilkan mendung/berawan saja
  // User yang melihat keluar tidak akan melihat hujan, hanya mendung
  if (precip_mm < 0.5) {
    if (cloud >= 80) return 3;           // Mendung penuh (overcast)
    if (cloud >= 40) return 1;           // Cerah berawan
    return is_day ? 0 : 0;              // Cerah
  }

  // Gerimis ringan (0.5–1.5mm) tapi kode menunjukkan hujan lebat → turunkan ke Gerimis
  if (precip_mm < 1.5 && [61, 63, 65].includes(wmoCode)) {
    return 51; // Turunkan ke kode Gerimis
  }

  return wmoCode; // Sisanya sesuai data asli
}

export function getWeatherTheme(code: number, hour: number): WeatherTheme {
  const isNight = hour < 6 || hour >= 18;

  // ─── NIGHT MODE THEMES (DARK MODE) ──────────────────────────────────────────
  if (isNight) {
    if (code === 0) {
      return {
        name: 'Malam Cerah',
        Icon: MoonIcon,
        bgGradient: 'linear-gradient(135deg, #070410 0%, #0c0b1e 35%, #05040a 100%)',
        glassCard: 'bg-white/[0.08] backdrop-blur-xl border-white/20',
        glassCardBorder: 'border-white/20',
        accent: '#A78BFA',
        accentTw: 'text-violet-400',
        badgeBg: 'bg-violet-500/15 border-violet-500/30',
        badgeText: 'text-violet-200',
        recommendation: 'Langit malam cerah bertabur bintang. Fokus malam ini akan membawa hasil luar biasa!',
        particleType: 'clear-night',
        headerGlow: 'rgba(167, 139, 250, 0.25)',
        textColor: 'text-white',
        subtextColor: 'text-slate-300',
        isDark: true,
      };
    }
    if ([1, 2].includes(code)) {
      return {
        name: 'Malam Berawan Sebagian',
        Icon: PartlyCloudyIcon,
        bgGradient: 'linear-gradient(135deg, #030612 0%, #0a0f24 35%, #02040b 100%)',
        glassCard: 'bg-white/[0.08] backdrop-blur-xl border-white/20',
        glassCardBorder: 'border-white/20',
        accent: '#38BDF8',
        accentTw: 'text-sky-400',
        badgeBg: 'bg-sky-500/15 border-sky-500/30',
        badgeText: 'text-sky-200',
        recommendation: 'Langit malam berawan sebagian. Suasana tenang dan sejuk untuk beristirahat atau belajar dengan fokus!',
        particleType: 'partly-cloudy',
        headerGlow: 'rgba(56, 189, 248, 0.25)',
        textColor: 'text-white',
        subtextColor: 'text-slate-300',
        isDark: true,
      };
    }
    if (code === 3) {
      return {
        name: 'Malam Mendung',
        Icon: CloudIcon,
        bgGradient: 'linear-gradient(135deg, #060811 0%, #0f1322 40%, #04050a 100%)',
        glassCard: 'bg-white/[0.07] backdrop-blur-xl border-white/10',
        glassCardBorder: 'border-white/10',
        accent: '#94A3B8',
        accentTw: 'text-slate-300',
        badgeBg: 'bg-slate-700/30 border-slate-500/30',
        badgeText: 'text-slate-200',
        recommendation: 'Malam mendung dan sejuk. Sangat nyaman untuk menyelesaikan tugas di dalam ruangan!',
        particleType: 'cloud',
        headerGlow: 'rgba(148, 163, 184, 0.2)',
        textColor: 'text-white',
        subtextColor: 'text-slate-300',
        isDark: true,
      };
    }
    if ([45, 48].includes(code)) {
      return {
        name: 'Kabut Malam',
        Icon: FogIcon,
        bgGradient: 'linear-gradient(135deg, #06070a 0%, #111218 50%, #030405 100%)',
        glassCard: 'bg-white/[0.06] backdrop-blur-2xl border-white/10',
        glassCardBorder: 'border-white/10',
        accent: '#22D3EE',
        accentTw: 'text-cyan-400',
        badgeBg: 'bg-cyan-500/15 border-cyan-500/30',
        badgeText: 'text-cyan-200',
        recommendation: 'Kabut malam menyelimuti luar ruangan. Pastikan tubuh Anda tetap hangat selagi menyelesaikan tugas!',
        particleType: 'fog',
        headerGlow: 'rgba(34, 211, 238, 0.25)',
        textColor: 'text-white',
        subtextColor: 'text-slate-300',
        isDark: true,
      };
    }
    if ([51, 53, 55].includes(code)) {
      return {
        name: 'Gerimis Malam',
        Icon: RainIcon,
        bgGradient: 'linear-gradient(135deg, #030712 0%, #0a1128 40%, #02040a 100%)',
        glassCard: 'bg-white/[0.08] backdrop-blur-xl border-white/15',
        glassCardBorder: 'border-white/15',
        accent: '#60A5FA',
        accentTw: 'text-blue-400',
        badgeBg: 'bg-blue-500/15 border-blue-500/30',
        badgeText: 'text-blue-200',
        recommendation: 'Gerimis malam membawa suasana syahdu. Sempurna untuk fokus tanpa gangguan suara luar.',
        particleType: 'rain',
        headerGlow: 'rgba(96, 165, 250, 0.2)',
        textColor: 'text-white',
        subtextColor: 'text-slate-300',
        isDark: true,
      };
    }
    if ([61, 63, 65, 80, 81, 82].includes(code)) {
      return {
        name: 'Hujan Malam',
        Icon: HeavyRainIcon,
        bgGradient: 'linear-gradient(135deg, #01040f 0%, #091024 40%, #000207 100%)',
        glassCard: 'bg-white/[0.06] backdrop-blur-2xl border-white/10',
        glassCardBorder: 'border-white/10',
        accent: '#3B82F6',
        accentTw: 'text-blue-400',
        badgeBg: 'bg-blue-500/15 border-blue-500/30',
        badgeText: 'text-blue-200',
        recommendation: 'Hujan deras malam ini. Tetap di dalam ruangan yang hangat dan nyaman.',
        particleType: 'rain',
        headerGlow: 'rgba(59, 130, 246, 0.25)',
        textColor: 'text-white',
        subtextColor: 'text-slate-300',
        isDark: true,
      };
    }
    if ([71, 73, 75, 85, 86].includes(code)) {
      return {
        name: 'Salju Malam',
        Icon: SnowIcon,
        bgGradient: 'linear-gradient(135deg, #060912 0%, #111a2c 40%, #010206 100%)',
        glassCard: 'bg-white/[0.08] backdrop-blur-xl border-white/15',
        glassCardBorder: 'border-white/15',
        accent: '#93C5FD',
        accentTw: 'text-blue-300',
        badgeBg: 'bg-cyan-500/15 border-cyan-500/30',
        badgeText: 'text-cyan-200',
        recommendation: 'Malam bersalju dingin. Hangatkan diri dan mari tetap produktif di dalam.',
        particleType: 'snow',
        headerGlow: 'rgba(147, 197, 253, 0.25)',
        textColor: 'text-white',
        subtextColor: 'text-slate-300',
        isDark: true,
      };
    }
    if (code === 77) {
      return {
        name: 'Hujan Es Malam',
        Icon: SnowIcon,
        bgGradient: 'linear-gradient(135deg, #04070e 0%, #0e1628 40%, #010204 100%)',
        glassCard: 'bg-white/[0.08] backdrop-blur-xl border-cyan-400/20',
        glassCardBorder: 'border-cyan-400/20',
        accent: '#67E8F9',
        accentTw: 'text-cyan-300',
        badgeBg: 'bg-cyan-500/15 border-cyan-500/30',
        badgeText: 'text-cyan-200',
        recommendation: 'Hujan es di malam hari! Sangat dianjurkan untuk tidak bepergian ke luar.',
        particleType: 'snow',
        headerGlow: 'rgba(103, 232, 249, 0.2)',
        textColor: 'text-white',
        subtextColor: 'text-slate-300',
        isDark: true,
      };
    }
    if ([95, 96, 99].includes(code)) {
      return {
        name: 'Badai Petir Malam',
        Icon: ThunderIcon,
        bgGradient: 'linear-gradient(135deg, #010103 0%, #090614 30%, #010103 100%)',
        glassCard: 'bg-white/[0.05] backdrop-blur-xl border-amber-500/15',
        glassCardBorder: 'border-amber-500/15',
        accent: '#F59E0B',
        accentTw: 'text-amber-400',
        badgeBg: 'bg-amber-500/15 border-amber-500/30',
        badgeText: 'text-amber-202',
        recommendation: 'Badai petir malam hari. Pastikan semua colokan listrik aman dan nikmati waktu produktif di dalam.',
        particleType: 'thunder',
        headerGlow: 'rgba(245, 158, 11, 0.2)',
        textColor: 'text-white',
        subtextColor: 'text-slate-300',
        isDark: true,
      };
    }
    // Default Malam Berawan
    return {
      name: 'Malam Berawan',
      Icon: CloudIcon,
      bgGradient: 'linear-gradient(135deg, #050811 0%, #10182c 40%, #050811 100%)',
      glassCard: 'bg-white/[0.07] backdrop-blur-xl border-white/10',
      glassCardBorder: 'border-white/10',
      accent: '#94A3B8',
      accentTw: 'text-slate-300',
      badgeBg: 'bg-slate-700/30 border-slate-500/30',
      badgeText: 'text-slate-200',
      recommendation: 'Malam berawan teduh. Waktu yang baik untuk merefleksikan progres dan beristirahat cukup.',
      particleType: 'cloud',
      headerGlow: 'rgba(148, 163, 184, 0.2)',
      textColor: 'text-white',
      subtextColor: 'text-slate-300',
      isDark: true,
    };
  }

  // ─── DAY MODE THEMES (LIGHT MODE) ───────────────────────────────────────────
  if (code === 0) {
    return {
      name: 'Cerah',
      Icon: SunIcon,
      bgGradient: 'linear-gradient(135deg, #FFF3CD 0%, #FFE58A 25%, #FFF7E0 55%, #FEF3C7 80%, #FDE68A 100%)',
      glassCard: 'bg-white/60 backdrop-blur-xl border-amber-200/70',
      glassCardBorder: 'border-amber-200/70',
      accent: '#D97706',
      accentTw: 'text-amber-700',
      badgeBg: 'bg-amber-100 border-amber-300',
      badgeText: 'text-amber-800',
      recommendation: 'Langit cerah menyinari harimu! Energi terbaik untuk menyelesaikan target produktivitas.',
      particleType: 'sun',
      headerGlow: 'rgba(251, 191, 36, 0.4)',
      textColor: 'text-amber-900',
      subtextColor: 'text-amber-950/80',
      isDark: false,
    };
  }
  if ([1, 2].includes(code)) {
    return {
      name: 'Cerah Berawan',
      Icon: PartlyCloudyIcon,
      bgGradient: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 30%, #E0F7FF 60%, #F0F9FF 100%)',
      glassCard: 'bg-white/60 backdrop-blur-xl border-sky-200/70',
      glassCardBorder: 'border-sky-200/70',
      accent: '#0284C7',
      accentTw: 'text-sky-700',
      badgeBg: 'bg-sky-100 border-sky-300',
      badgeText: 'text-sky-800',
      recommendation: 'Cuaca berawan sebagian. Kondisi sejuk yang sempurna untuk produktivitas maksimal!',
      particleType: 'partly-cloudy',
      headerGlow: 'rgba(56, 189, 248, 0.3)',
      textColor: 'text-sky-950',
      subtextColor: 'text-sky-900/80',
      isDark: false,
    };
  }
  if (code === 3) {
    return {
      name: 'Mendung',
      Icon: CloudIcon,
      bgGradient: 'linear-gradient(135deg, #E2E8F0 0%, #CBD5E1 30%, #E2E8F0 65%, #F1F5F9 100%)',
      glassCard: 'bg-white/60 backdrop-blur-xl border-slate-300/60',
      glassCardBorder: 'border-slate-300/60',
      accent: '#64748B',
      accentTw: 'text-slate-600',
      badgeBg: 'bg-slate-200 border-slate-300',
      badgeText: 'text-slate-700',
      recommendation: 'Langit mendung menyelimuti hari ini. Waktu sempurna untuk fokus pada pekerjaan dalam ruangan!',
      particleType: 'cloud',
      headerGlow: 'rgba(148, 163, 184, 0.25)',
      textColor: 'text-slate-900',
      subtextColor: 'text-slate-900/80',
      isDark: false,
    };
  }
  if ([45, 48].includes(code)) {
    return {
      name: 'Berkabut',
      Icon: FogIcon,
      bgGradient: 'linear-gradient(135deg, #E5E7EB 0%, #D1D5DB 30%, #F3F4F6 65%, #E9EBEE 100%)',
      glassCard: 'bg-white/55 backdrop-blur-2xl border-gray-300/60',
      glassCardBorder: 'border-gray-300/60',
      accent: '#6B7280',
      accentTw: 'text-gray-600',
      badgeBg: 'bg-gray-200 border-gray-400',
      badgeText: 'text-gray-700',
      recommendation: 'Kondisi kabut tebal di luar. Tetap nyaman di dalam dan selesaikan misi Anda!',
      particleType: 'fog',
      headerGlow: 'rgba(156, 163, 175, 0.3)',
      textColor: 'text-gray-900',
      subtextColor: 'text-gray-900/80',
      isDark: false,
    };
  }
  if ([51, 53, 55].includes(code)) {
    return {
      name: 'Gerimis',
      Icon: RainIcon,
      bgGradient: 'linear-gradient(135deg, #DCE6F1 0%, #C9D9EB 30%, #E7EFF8 65%, #DCE6F1 100%)',
      glassCard: 'bg-white/60 backdrop-blur-xl border-blue-200/60',
      glassCardBorder: 'border-blue-200/60',
      accent: '#3B82F6',
      accentTw: 'text-blue-600',
      badgeBg: 'bg-blue-100 border-blue-300',
      badgeText: 'text-blue-700',
      recommendation: 'Gerimis halus turun. Nikmati suasana tenang dan fokus selesaikan rencanamu.',
      particleType: 'rain',
      headerGlow: 'rgba(147, 197, 253, 0.25)',
      textColor: 'text-blue-900',
      subtextColor: 'text-blue-900/80',
      isDark: false,
    };
  }
  if ([61, 63, 65, 80, 81, 82].includes(code)) {
    return {
      name: 'Hujan',
      Icon: HeavyRainIcon,
      bgGradient: 'linear-gradient(135deg, #CFDBEC 0%, #B5C9E2 30%, #DFE7F3 65%, #C2D2E9 100%)',
      glassCard: 'bg-white/60 backdrop-blur-2xl border-blue-300/60',
      glassCardBorder: 'border-blue-300/60',
      accent: '#2563EB',
      accentTw: 'text-blue-700',
      badgeBg: 'bg-blue-100 border-blue-400',
      badgeText: 'text-blue-800',
      recommendation: 'Hujan deras di luar. Waktu terbaik untuk produktivitas tanpa gangguan di dalam ruangan!',
      particleType: 'rain',
      headerGlow: 'rgba(96, 165, 250, 0.2)',
      textColor: 'text-blue-950',
      subtextColor: 'text-blue-900/80',
      isDark: false,
    };
  }
  if ([71, 73, 75, 85, 86].includes(code)) {
    return {
      name: 'Bersalju',
      Icon: SnowIcon,
      bgGradient: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 30%, #F0F9FF 65%, #E8F4FD 100%)',
      glassCard: 'bg-white/65 backdrop-blur-xl border-blue-200/60',
      glassCardBorder: 'border-blue-200/60',
      accent: '#3B82F6',
      accentTw: 'text-blue-600',
      badgeBg: 'bg-blue-100 border-blue-300',
      badgeText: 'text-blue-800',
      recommendation: 'Salju turun di luar! Hangatkan diri dan mari tetap produktif di dalam.',
      particleType: 'snow',
      headerGlow: 'rgba(147, 197, 253, 0.35)',
      textColor: 'text-blue-950',
      subtextColor: 'text-blue-900/80',
      isDark: false,
    };
  }
  if (code === 77) {
    return {
      name: 'Hujan Es',
      Icon: SnowIcon,
      bgGradient: 'linear-gradient(135deg, #ECFDF5 0%, #E0F2FE 30%, #CCFBF1 65%, #E0F2FE 100%)',
      glassCard: 'bg-white/60 backdrop-blur-xl border-cyan-200/60',
      glassCardBorder: 'border-cyan-200/60',
      accent: '#06B6D4',
      accentTw: 'text-cyan-700',
      badgeBg: 'bg-cyan-100 border-cyan-300',
      badgeText: 'text-cyan-800',
      recommendation: 'Hujan es turun di luar! Tetap di dalam dan jaga keselamatan.',
      particleType: 'snow',
      headerGlow: 'rgba(103, 232, 249, 0.25)',
      textColor: 'text-cyan-950',
      subtextColor: 'text-cyan-900/80',
      isDark: false,
    };
  }
  if ([95, 96, 99].includes(code)) {
    return {
      name: 'Badai Petir',
      Icon: ThunderIcon,
      bgGradient: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 30%, #FEF3C7 65%, #DDD6FE 100%)',
      glassCard: 'bg-white/60 backdrop-blur-xl border-violet-200/60',
      glassCardBorder: 'border-violet-200/60',
      accent: '#7C3AED',
      accentTw: 'text-violet-700',
      badgeBg: 'bg-amber-100 border-amber-300',
      badgeText: 'text-amber-800',
      recommendation: 'Badai petir di luar! Kurangi aktivitas luar dan tetap aman. Fokus pada produktivitas di rumah.',
      particleType: 'thunder',
      headerGlow: 'rgba(245, 158, 11, 0.25)',
      textColor: 'text-violet-950',
      subtextColor: 'text-violet-900/80',
      isDark: false,
    };
  }

  // Default cloudy
  return {
    name: 'Berawan',
    Icon: CloudIcon,
    bgGradient: 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 30%, #F8FAFC 65%, #EEF2F7 100%)',
    glassCard: 'bg-white/60 backdrop-blur-xl border-slate-200/70',
    glassCardBorder: 'border-slate-200/70',
    accent: '#475569',
    accentTw: 'text-slate-600',
    badgeBg: 'bg-slate-200 border-slate-300',
    badgeText: 'text-slate-700',
    recommendation: 'Cuaca mendung berawan. Tetap semangat menjalani hari produktif Anda!',
    particleType: 'cloud',
    headerGlow: 'rgba(148, 163, 184, 0.3)',
    textColor: 'text-slate-900',
    subtextColor: 'text-slate-900/80',
    isDark: false,
  };
}
