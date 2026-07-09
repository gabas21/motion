'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { 
  Sparkles, Calendar, Clock, Plus, Zap, CheckCircle2,
  RefreshCw, MessageSquare, BookOpen, GraduationCap,
  BrainCircuit, ShieldCheck, CheckSquare, CalendarDays,
  Send, Music, Maximize2, Minimize2
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useCalendar } from '../../hooks/useCalendar';
import { useMoodle } from '../../hooks/useMoodle';
import { useScheduling } from '../../hooks/useScheduling';
import { useAIChatBridge } from '../../hooks/useAIChatBridge';
import API from '../../lib/api';
import { toast } from '../../hooks/useToast';
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
} from '../ui/animated-weather-icons';
import QuotaWidget from './QuotaWidget';

interface Task {
  id: string;
  title: string;
  description: string;
  timeEstimateMinutes: number;
  dueDate: string | null;
  priority: number;
  status: string;
  category: string;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
}

interface OverviewTabProps {
  onNavigateToTab: (tab: 'list' | 'calendar' | 'analytics' | 'integrations' | 'preferences' | 'welearn' | 'excuse-letter') => void;
}

// ─── WEATHER THEME DEFINITIONS ───────────────────────────────────────────────
type WeatherTheme = {
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
function mapWeatherAPICode(code: number, isDay: number): number {
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
function applyPerceptionFilter(
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

function getWeatherTheme(code: number, hour: number): WeatherTheme {
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


// ─── PARTICLE CANVAS ──────────────────────────────────────────────────────────
const WeatherParticleCanvas = React.memo(function WeatherParticleCanvas({ type }: { type: WeatherTheme['particleType'] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let resizeTimeout: NodeJS.Timeout;

    const resize = () => {
      if (!canvas) return;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    resize();

    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resize, 150);
    };

    window.addEventListener('resize', handleResize);

    // Create particles based on weather type (optimized counts)
    interface Particle {
      x: number; y: number; vx: number; vy: number;
      size: number; opacity: number; color?: string; angle?: number;
    }
    const particles: Particle[] = [];

    if (type === 'rain') {
      for (let i = 0; i < 60; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: -1.5,
          vy: 14 + Math.random() * 8,
          size: 1 + Math.random() * 1.2,
          opacity: 0.15 + Math.random() * 0.3,
        });
      }
    } else if (type === 'snow') {
      for (let i = 0; i < 40; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: 0.5 + Math.random() * 1.5,
          size: 2 + Math.random() * 4,
          opacity: 0.5 + Math.random() * 0.4,
        });
      }
    } else if (type === 'sun') {
      // Floating golden motes
      for (let i = 0; i < 20; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: -0.2 - Math.random() * 0.5,
          size: 2 + Math.random() * 5,
          opacity: 0.08 + Math.random() * 0.18,
          color: '#FBBF24',
        });
      }
    } else if (type === 'clear-night') {
      // Twinkling stars
      for (let i = 0; i < 60; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: 0,
          vy: 0,
          size: 0.5 + Math.random() * 2.5,
          opacity: 0.2 + Math.random() * 0.8,
          color: i % 5 === 0 ? '#A78BFA' : '#FFFFFF',
        });
      }
    } else if (type === 'fog') {
      // Drifting fog blobs
      for (let i = 0; i < 6; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: 20 + Math.random() * canvas.height * 0.8,
          vx: 0.2 + Math.random() * 0.4,
          vy: 0,
          size: 80 + Math.random() * 120,
          opacity: 0.04 + Math.random() * 0.07,
        });
      }
    } else if (type === 'wind') {
      // Diagonal streaks
      for (let i = 0; i < 30; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: 3 + Math.random() * 4,
          vy: (Math.random() - 0.5) * 0.5,
          size: 40 + Math.random() * 80,
          opacity: 0.04 + Math.random() * 0.08,
        });
      }
    } else if (type === 'thunder') {
      // Sparse dark rain + lightning flashes handled in DOM
      for (let i = 0; i < 50; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: -2,
          vy: 16 + Math.random() * 10,
          size: 1 + Math.random() * 0.8,
          opacity: 0.08 + Math.random() * 0.15,
          color: '#6B7280',
        });
      }
    } else if (type === 'partly-cloudy') {
      // Light floating particles
      for (let i = 0; i < 12; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -0.1 - Math.random() * 0.3,
          size: 3 + Math.random() * 6,
          opacity: 0.07 + Math.random() * 0.12,
          color: '#38BDF8',
        });
      }
    // FIX #7: Cloud particles — drifting blobs (sebelumnya array kosong)
    } else if (type === 'cloud') {
      for (let i = 0; i < 6; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: 10 + Math.random() * canvas.height * 0.7,
          vx: 0.15 + Math.random() * 0.25,
          vy: 0,
          size: 60 + Math.random() * 100,
          opacity: 0.06 + Math.random() * 0.09,
        });
      }
    }

    let lightningTimer = 0;
    let lightningFlash = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Lightning flash effect for thunder
      if (type === 'thunder') {
        lightningTimer++;
        if (lightningTimer > 180 + Math.random() * 300) {
          lightningFlash = 8;
          lightningTimer = 0;
        }
        if (lightningFlash > 0) {
          ctx.fillStyle = `rgba(255, 240, 180, ${lightningFlash * 0.03})`;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          lightningFlash--;
        }
      }

      for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = p.opacity;

        if (type === 'rain' || type === 'thunder') {
          // Draw rain drop lines
          ctx.strokeStyle = p.color || '#93C5FD';
          ctx.lineWidth = p.size;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 2, p.y + p.vy * 2);
          ctx.stroke();
          p.x += p.vx;
          p.y += p.vy;
          if (p.y > canvas.height) {
            p.y = -20;
            p.x = Math.random() * canvas.width;
          }
        } else if (type === 'snow') {
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          p.x += p.vx + Math.sin(Date.now() * 0.001 + p.y * 0.05) * 0.3;
          p.y += p.vy;
          if (p.y > canvas.height) {
            p.y = -10;
            p.x = Math.random() * canvas.width;
          }
        } else if (type === 'sun') {
          ctx.fillStyle = p.color || '#FBBF24';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          p.x += p.vx;
          p.y += p.vy;
          if (p.y < -20) {
            p.y = canvas.height + 10;
            p.x = Math.random() * canvas.width;
          }
        } else if (type === 'clear-night') {
          // Twinkling star
          const twinkle = 0.5 + 0.5 * Math.sin(Date.now() * 0.002 + p.x * 0.01 + p.y * 0.01);
          ctx.globalAlpha = p.opacity * twinkle;
          ctx.fillStyle = p.color || '#FFFFFF';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (type === 'fog') {
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          grad.addColorStop(0, 'rgba(209, 213, 219, 0.8)');
          grad.addColorStop(1, 'rgba(209, 213, 219, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          p.x += p.vx;
          if (p.x > canvas.width + p.size) {
            p.x = -p.size;
          }
        } else if (type === 'wind') {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.size, p.y + p.vy * 10);
          ctx.stroke();
          p.x += p.vx;
          if (p.x > canvas.width + p.size) {
            p.x = -p.size;
            p.y = Math.random() * canvas.height;
          }
        } else if (type === 'partly-cloudy') {
          ctx.fillStyle = p.color || '#93C5FD';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          p.x += p.vx;
          p.y += p.vy;
          if (p.y < -20) {
            p.y = canvas.height + 10;
            p.x = Math.random() * canvas.width;
          }
        } else if (type === 'cloud') {
          // FIX #7: Cloud blob dengan gerakan
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          grad.addColorStop(0, 'rgba(148, 163, 184, 0.7)');
          grad.addColorStop(1, 'rgba(148, 163, 184, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          p.x += p.vx;
          if (p.x > canvas.width + p.size) {
            p.x = -p.size;
            p.y = 10 + Math.random() * canvas.height * 0.7;
          }
        }

        ctx.restore();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [type]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 1 }}
    />
  );
});

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function OverviewTab({ onNavigateToTab }: OverviewTabProps) {
  const { user } = useAuth();
  
  const { analyticsData, insights, isLoading: analyticsLoading, fetchAnalyticsData } = useAnalytics();
  const { events, connections, isLoading: calendarLoading, fetchConnections, fetchEvents, syncCalendar } = useCalendar();
  const { status: moodleStatus, upcomingAssignments: moodleAssignments, isLoading: moodleLoading, fetchStatus: fetchMoodleStatus, fetchAssignments: fetchMoodleAssignments, syncNow: syncMoodle } = useMoodle();
  const { triggerAutoSchedule, isLoading: schedulingLoading } = useScheduling();
  const { openWithContext } = useAIChatBridge();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [miniChatInput, setMiniChatInput] = useState('');
  const [isSpotifyExpanded, setIsSpotifyExpanded] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [syncingCalendarLocal, setSyncingCalendarLocal] = useState(false);
  const [syncingMoodleLocal, setSyncingMoodleLocal] = useState(false);
  const [schedulingAllLocal, setSchedulingAllLocal] = useState(false);

  const [weatherData, setWeatherData] = useState<{
    temp: number; code: number; city: string; loading: boolean;
    humidity?: number; wind?: number; feelsLike?: number;
    precip?: number; cloud?: number;
  }>({ temp: 28, code: 0, city: 'Samarinda', loading: true });

  // FIX #2: currentHour sebagai state agar tema malam/siang update otomatis tiap jam
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());

  useEffect(() => {
    // Update jam setiap menit agar transisi siang/malam akurat
    const hourInterval = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60 * 1000);
    return () => clearInterval(hourInterval);
  }, []);

  useEffect(() => {
    let active = true;

    const getWeather = async () => {
      // FIX #8: Tambah mapping kota Indonesia yang lebih lengkap
      let lat = -0.5022, lon = 117.1536, city = 'Samarinda';
      const tz = user?.timezone || '';
      if (tz.includes('Jakarta'))           { lat = -6.2088;  lon = 106.8456; city = 'Jakarta'; }
      else if (tz.includes('Surabaya'))     { lat = -7.2504;  lon = 112.7688; city = 'Surabaya'; }
      else if (tz.includes('Bandung'))      { lat = -6.9175;  lon = 107.6191; city = 'Bandung'; }
      else if (tz.includes('Medan'))        { lat = 3.5952;   lon = 98.6722;  city = 'Medan'; }
      else if (tz.includes('Semarang'))     { lat = -6.9932;  lon = 110.4203; city = 'Semarang'; }
      else if (tz.includes('Palembang'))    { lat = -2.9761;  lon = 104.7754; city = 'Palembang'; }
      else if (tz.includes('Makassar') || tz.includes('Ujung_Pandang')) { lat = -5.1477; lon = 119.4327; city = 'Makassar'; }
      else if (tz.includes('Balikpapan'))   { lat = -1.2654;  lon = 116.8312; city = 'Balikpapan'; }
      else if (tz.includes('Pontianak'))    { lat = -0.0226;  lon = 109.3324; city = 'Pontianak'; }
      else if (tz.includes('Jayapura'))     { lat = -2.5337;  lon = 140.7181; city = 'Jayapura'; }
      else if (tz.includes('Manado'))       { lat = 1.4748;   lon = 124.8421; city = 'Manado'; }
      else if (tz.includes('Denpasar') || tz.includes('Bali')) { lat = -8.6705; lon = 115.2126; city = 'Denpasar'; }

      const getCoords = () => new Promise<{ lat: number; lon: number; city: string }>((resolve) => {
        if (typeof window !== 'undefined' && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, city: 'Lokasi Anda' }),
            () => resolve({ lat, lon, city }),
            { timeout: 3500 }
          );
        } else resolve({ lat, lon, city });
      });

      const coords = await getCoords();
      if (!active) return;

      try {
        // ── WeatherAPI.com (via server proxy untuk keamanan key) ────────────
        const query = `${coords.lat},${coords.lon}`;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const resp = await fetch(
          `${apiUrl}/weather?city=${query}`,
          { credentials: 'include' }
        );
        if (!resp.ok) throw new Error(`WeatherAPI error: ${resp.status}`);
        const data = await resp.json();
        if (active && data.current) {
          const rawCode = mapWeatherAPICode(
            data.current.condition.code,
            data.current.is_day
          );
          // Terapkan perception filter agar tema sesuai kondisi visual nyata
          const wCode = applyPerceptionFilter(
            rawCode,
            data.current.precip_mm ?? 0,
            data.current.cloud ?? 0,
            data.current.is_day
          );
          setWeatherData({
            temp: Math.round(data.current.temp_c),
            code: wCode,
            city: data.location?.name || coords.city,
            humidity: data.current.humidity,
            wind: Math.round(data.current.wind_kph),
            feelsLike: Math.round(data.current.feelslike_c),
            precip: data.current.precip_mm,
            cloud: data.current.cloud,
            loading: false,
          });
        }
      } catch {
        if (active) setWeatherData(prev => ({ ...prev, loading: false }));
      }
    };

    getWeather();

    // Auto-refresh cuaca setiap 15 menit
    // FIX #4: Hapus active = true dari dalam interval (mencegah race condition)
    const interval = setInterval(getWeather, 15 * 60 * 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user]);

  const theme = useMemo(() => getWeatherTheme(weatherData.code, currentHour), [weatherData.code, currentHour]);

  const fetchLocalTasks = useCallback(async () => {
    setTasksLoading(true);
    setTasksError(null);
    try {
      const response = await API.get('/tasks');
      const responseData = response.data.data;
      setTasks(responseData?.tasks || responseData || []);
    } catch (err: any) {
      setTasksError(err.response?.data?.error || 'Gagal memuat tugas.');
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalyticsData();
    fetchConnections();
    fetchEvents();
    fetchMoodleStatus();
    fetchMoodleAssignments('upcoming');
    fetchLocalTasks();
  }, [fetchAnalyticsData, fetchConnections, fetchEvents, fetchMoodleStatus, fetchMoodleAssignments, fetchLocalTasks]);

  const handleToggleTaskComplete = async (taskId: string, currentStatus: string) => {
    try {
      if (currentStatus === 'completed') {
        await API.patch(`/tasks/${taskId}`, { status: 'pending' });
      } else {
        await API.patch(`/tasks/${taskId}/complete`);
      }
      fetchLocalTasks();
      fetchAnalyticsData();
      fetchEvents();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal memperbarui tugas.');
    }
  };

  const handleSyncCalendar = async () => {
    setSyncingCalendarLocal(true);
    try {
      const ok = await syncCalendar();
      if (ok) { toast.success('Kalender Google berhasil diselaraskan!'); fetchEvents(); }
    } catch { /* silent */ } finally { setSyncingCalendarLocal(false); }
  };

  const handleSyncMoodle = async () => {
    setSyncingMoodleLocal(true);
    try {
      const ok = await syncMoodle();
      if (ok) { toast.success('Tugas WeLearn berhasil diselaraskan!'); fetchMoodleAssignments('upcoming'); fetchLocalTasks(); }
    } catch { /* silent */ } finally { setSyncingMoodleLocal(false); }
  };

  const handleAIReorder = async () => {
    setSchedulingAllLocal(true);
    try {
      const firstPending = tasks.find(t => t.status === 'pending');
      if (!firstPending) { toast.warning('Tidak ada tugas tertunda!'); return; }
      const ok = await triggerAutoSchedule(firstPending.id);
      if (ok) {
        toast.success('AI Auto-Scheduler berhasil menjadwal ulang semua tugas!');
        fetchLocalTasks(); fetchEvents(); fetchAnalyticsData();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menjadwal ulang.');
    } finally { setSchedulingAllLocal(false); }
  };

  const handleMiniChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!miniChatInput.trim()) return;
    openWithContext(miniChatInput.trim());
    setMiniChatInput('');
  };

  const timeGreeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 11) return 'Selamat Pagi';
    if (h < 15) return 'Selamat Siang';
    if (h < 19) return 'Selamat Sore';
    return 'Selamat Malam';
  }, []);

  const formattedDate = useMemo(() => new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), []);

  const todayAgenda = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    interface AgendaItem { id: string; title: string; startTime: string; endTime: string; type: 'event' | 'task'; priority?: number; status?: string; timeEstimate?: number; source?: string; description?: string; category?: string; }
    const calendarEvents: AgendaItem[] = events.filter(e => { const s = new Date(e.startTime); return s >= todayStart && s <= todayEnd; }).map(e => ({ id: e.id, title: e.title, startTime: e.startTime, endTime: e.endTime, type: 'event', description: e.description, source: e.calendarSource }));
    const scheduledTasks: AgendaItem[] = tasks.filter(t => { if (!t.scheduledStart || t.status === 'completed') return false; const s = new Date(t.scheduledStart); return s >= todayStart && s <= todayEnd; }).map(t => ({ id: t.id, title: t.title, startTime: t.scheduledStart!, endTime: t.scheduledEnd || new Date(new Date(t.scheduledStart!).getTime() + t.timeEstimateMinutes * 60000).toISOString(), type: 'task', priority: t.priority, category: t.category, status: t.status, timeEstimate: t.timeEstimateMinutes }));
    return [...calendarEvents, ...scheduledTasks].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [events, tasks]);

  const taskCounts = useMemo(() => {
    const pending = tasks.filter(t => t.status === 'pending').length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const total = tasks.length;
    const ratio = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { pending, completed, total, ratio };
  }, [tasks]);

  const nextAgendaItem = useMemo(() => {
    const now = Date.now();
    return todayAgenda.find(item => new Date(item.startTime).getTime() > now);
  }, [todayAgenda]);

  const upcomingWeLearn = useMemo(() => moodleAssignments.filter(a => a.submissionStatus !== 'submitted').slice(0, 2), [moodleAssignments]);
  const isLoading = analyticsLoading || tasksLoading || calendarLoading || moodleLoading;

  // ─── Neobrutalism card styling helpers (Sidebar Menu Style) ─────────────
  // Struktur neobrutalism TETAP: border hitam + box-shadow
  // Aksen warna berubah mengikuti tema cuaca/waktu dari `theme`
  const cardBase = 'bg-white border-3 border-black rounded-2xl shadow-[5px_5px_0px_0px_#000]';
  const metricCardBase = 'bg-white border-3 border-black rounded-xl shadow-[4px_4px_0px_0px_#000]';
  const textPrimary = 'text-black';
  const textSub = 'text-black/60 font-semibold';
  const btnPrimary = 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#000] transition-all cursor-pointer font-black';

  // ─── WEATHER-ADAPTIVE ACCENT SYSTEM ─────────────────────────────────────
  // Warna aksen diambil dari tema cuaca yang aktif.
  // Semua warna ini berubah otomatis saat cuaca/waktu berubah.
  const isDark = !!theme.isDark;

  // Hex warna aksen utama tema (digunakan untuk inline style)
  const themeAccentHex = theme.accent;  // misal '#FBBF24' (cerah), '#A78BFA' (malam), '#3B82F6' (hujan)

  // Warna progress bar & timeline dot mengikuti aksen tema
  const progressBarColor = themeAccentHex;
  const timelineTaskDot = themeAccentHex;

  if (isLoading && tasks.length === 0) {
    return (
      <div className="relative w-full space-y-5 text-left animate-pulse">
        <div className="border-3 border-black rounded-2xl p-6 h-36 bg-slate-100" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className={`${metricCardBase} p-4 h-28`} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <div className={`${cardBase} p-5 h-[360px]`} />
            <div className={`${cardBase} p-5 h-[180px]`} />
          </div>
          <div className="space-y-5">
            <div className={`${cardBase} p-5 h-[230px]`} />
            <div className={`${cardBase} p-5 h-[230px]`} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full space-y-5 text-left">
      
      {/* ─── SECTION 1: HEADER & GREETING (Minimalist & Clean) ─── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-1">
        <div>
          <h1 className="text-2xl md:text-3.5xl font-black uppercase tracking-tight text-black flex items-center gap-2">
            {timeGreeting}, {user?.name || 'Misionaris'}! ✨
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="neo-badge text-[10px] uppercase tracking-wider font-black px-2.5 py-0.5 bg-neoYellow border-2 border-black shadow-[1.5px_1.5px_0px_0px_#000] text-black">
              <CalendarDays className="w-3.5 h-3.5 inline mr-1 text-black" />
              {formattedDate}
            </span>
            <span className="neo-badge text-[10px] uppercase tracking-wider font-black px-2.5 py-0.5 bg-neoCream border-2 border-black shadow-[1.5px_1.5px_0px_0px_#000] text-black">
              <theme.Icon size={14} className="inline mr-1 text-black animate-pulse" />
              {weatherData.loading ? '...' : `${weatherData.temp}°C · ${theme.name}`}
            </span>
            <span className="text-[10px] font-mono font-bold text-black/50">
              📍 {weatherData.city}
            </span>
          </div>
        </div>
      </div>

      {/* AI RECOMMENDATION TIP CARD (Glassmorphism, Subtle Weather Backdrop) */}
      <div 
        className="relative border-3 border-black rounded-2xl p-4 overflow-hidden shadow-[4px_4px_0px_0px_#000] transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_0px_#000]"
        style={{ background: isDark ? 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)' : theme.bgGradient }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
          <WeatherParticleCanvas type={theme.particleType} />
        </div>
        <div className="relative z-10 flex gap-3 items-center">
          <div className="w-10 h-10 rounded-xl bg-white border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000] shrink-0">
            <Sparkles className="w-5 h-5 text-neoOrange" />
          </div>
          <div className="flex-1 text-left">
            <span className="text-[9px] font-black uppercase tracking-wider text-black/50 block">Rekomendasi AI Harian</span>
            <p className={`text-xs font-bold leading-snug ${isDark ? 'text-white' : 'text-black'}`}>
              {theme.recommendation}{' '}
              {taskCounts.pending > 0
                ? `Kamu memiliki ${taskCounts.pending} tugas tertunda. Yuk selesaikan sambil mendengarkan musik fokus!`
                : 'Luar biasa! Semua tugas harianmu selesai. Santai dulu dan nikmati harimu.'}
            </p>
          </div>
        </div>
      </div>

      {/* ─── SECTION 2: CORE METRICS GRID (4 Cards) ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Productivity Score */}
        <div className={`${metricCardBase} p-4 flex flex-col justify-between hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_#000] transition-all`}>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-wider text-black/60">Skor Produktivitas</span>
            <div className="p-1.5 rounded-lg border border-black" style={{ background: themeAccentHex }}>
              <Zap className="w-3.5 h-3.5" style={{ color: isDark ? '#fff' : '#000' }} />
            </div>
          </div>
          <div className="my-2">
            <h3 className="text-2xl font-black leading-none text-black">
              {analyticsData?.summary?.productivityScore.toFixed(1) || '8.5'}
              <span className="text-xs font-bold ml-1 text-black/60">/10</span>
            </h3>
          </div>
          <button
            onClick={handleAIReorder}
            disabled={schedulingAllLocal || schedulingLoading}
            className={`w-full text-[9px] font-black py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${btnPrimary}`}
          >
            <BrainCircuit className={`w-3 h-3 ${schedulingAllLocal ? 'animate-spin' : ''}`} />
            AI Jadwal Ulang
          </button>
        </div>

        {/* Card 2: Circular Progress */}
        <div className={`${metricCardBase} p-4 flex flex-col justify-between hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_#000] transition-all cursor-pointer`} onClick={() => onNavigateToTab('list')}>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-wider text-black/60">Progres Tugas</span>
            <div className="p-1.5 rounded-lg bg-neoMint border border-black">
              <CheckCircle2 className="w-3.5 h-3.5 text-black" />
            </div>
          </div>
          <div className="flex items-center gap-3 my-1">
            <div className="relative w-12 h-12 shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="24"
                  cy="24"
                  r="18"
                  className="stroke-slate-100"
                  strokeWidth="4.5"
                  fill="transparent"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="18"
                  stroke={themeAccentHex}
                  strokeWidth="4.5"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 18}
                  strokeDashoffset={2 * Math.PI * 18 * (1 - taskCounts.ratio / 100)}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black font-mono text-black">
                {taskCounts.ratio}%
              </span>
            </div>
            <div className="text-left min-w-0">
              <h3 className="text-lg font-black leading-none text-black truncate">
                {taskCounts.completed} <span className="text-xs font-bold text-black/60">Selesai</span>
              </h3>
              <p className="text-[9px] font-semibold text-black/60 mt-1">Dari {taskCounts.total} tugas</p>
            </div>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden border border-black bg-white">
            <div
              className="h-full rounded-full"
              style={{
                width: `${taskCounts.ratio}%`,
                background: progressBarColor,
              }}
            />
          </div>
        </div>

        {/* Card 3: Academic / WeLearn */}
        <div 
          className={`${metricCardBase} p-4 flex flex-col justify-between hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_#000] transition-all cursor-pointer`}
          onClick={() => onNavigateToTab('welearn')}
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-wider text-black/60">Akademik & LMS</span>
            <div className="p-1.5 rounded-lg bg-neoViolet border border-black">
              <GraduationCap className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
          <div className="my-2">
            <h3 className="text-2xl font-black leading-none text-black">
              {moodleAssignments.filter(a => a.submissionStatus !== 'submitted').length}
              <span className="text-xs font-bold ml-1 text-black/60">Tugas LMS</span>
            </h3>
          </div>
          <div className="flex items-center justify-between text-[9px] font-semibold text-black/60">
            <span>Risiko Kelulusan:</span>
            <span className={
              analyticsData?.mlMetrics?.graduationRisk?.status === 'High'
                ? 'text-rose-500 font-extrabold'
                : analyticsData?.mlMetrics?.graduationRisk?.status === 'Moderate'
                ? 'text-amber-500 font-extrabold'
                : 'text-emerald-500 font-extrabold'
            }>
              {analyticsData?.mlMetrics?.graduationRisk?.status === 'High' ? 'Tinggi' : analyticsData?.mlMetrics?.graduationRisk?.status === 'Moderate' ? 'Sedang' : 'Rendah'}
            </span>
          </div>
        </div>

        {/* Card 4: Agenda Hari Ini */}
        <div 
          className={`${metricCardBase} p-4 flex flex-col justify-between hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_#000] transition-all cursor-pointer`}
          onClick={() => onNavigateToTab('calendar')}
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-wider text-black/60">Agenda Hari Ini</span>
            <div className="p-1.5 rounded-lg bg-neoPink border border-black">
              <Calendar className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
          <div className="my-2">
            <h3 className="text-2xl font-black leading-none text-black">
              {todayAgenda.length}
              <span className="text-xs font-bold ml-1 text-black/60">Jadwal</span>
            </h3>
          </div>
          <p className="text-[9px] font-semibold truncate text-black/60 text-left">
            {nextAgendaItem ? `Next: ${nextAgendaItem.title}` : 'Tidak ada jadwal tersisa.'}
          </p>
        </div>
      </div>

      {/* ─── SECTION 3: TWO-COLUMN MAIN LAYOUT ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* KOLOM KIRI: Linimasa & Deadline WeLearn (2/3 Lebar) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Timeline Agenda Harian */}
          <div className={`${cardBase} p-5 flex flex-col`} style={{ minHeight: '360px' }}>
            <div className="flex justify-between items-center mb-4 shrink-0 pb-3 border-b-2 border-black">
              <h2 className="text-sm font-black flex items-center gap-2 text-black uppercase tracking-wider">
                <Clock className="w-4 h-4" /> Linimasa Agenda Hari Ini
              </h2>
              <span
                className="neo-badge text-[9px] font-mono font-black px-2.5 py-1"
                style={{ background: themeAccentHex, color: isDark ? '#fff' : '#000', borderColor: '#000' }}
              >
                {todayAgenda.length} Kegiatan
              </span>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {todayAgenda.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-10">
                  <h4 className="font-black text-xs mt-3 text-black uppercase">Tidak Ada Agenda Terjadwal</h4>
                  <p className="text-[10px] font-semibold max-w-xs mx-auto mt-1 mb-3 text-black/60">
                    Semua tugas telah selesai dikerjakan atau belum dialokasikan oleh AI.
                  </p>
                  <button
                    onClick={() => onNavigateToTab('list')}
                    className={`text-xxs font-black px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${btnPrimary}`}
                  >
                    Buat Tugas Baru <Plus className="w-3 h-3 inline ml-0.5" />
                  </button>
                </div>
              ) : (
                <div className="relative border-l-3 border-black pl-5 ml-4 py-1 space-y-4 text-left">
                  {todayAgenda.map((item) => {
                    const isTask = item.type === 'task';
                    const startStr = new Date(item.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    const endStr = new Date(item.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={item.id} className="relative group">
                        {/* Dot timeline stepper */}
                        <div
                          className="absolute -left-[24.5px] top-2.5 w-3.5 h-3.5 border-2 border-black rounded-full z-10 transition-all group-hover:scale-125"
                          style={{ backgroundColor: isTask ? timelineTaskDot : '#8B5CF6' }}
                        />
                        <div className="bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] rounded-xl p-3 flex items-center justify-between gap-3 transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#000]">
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[9px] font-black px-1.5 py-0.5 bg-neoCream border border-black rounded text-black">
                                {startStr} – {endStr}
                              </span>
                              <span
                                className="text-[8px] font-black uppercase px-1.5 py-0.5 border border-black rounded"
                                style={{
                                  backgroundColor: isTask ? timelineTaskDot : '#8B5CF6',
                                  color: isTask ? (isDark ? '#fff' : '#000') : '#fff',
                                }}
                              >
                                {isTask ? 'Tugas AI' : 'Event'}
                              </span>
                            </div>
                            <h3 className="font-black text-xs truncate text-black">{item.title}</h3>
                          </div>
                          {isTask && (
                            <button
                              onClick={() => handleToggleTaskComplete(item.id, item.status || 'pending')}
                              className="w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center transition-all cursor-pointer shrink-0 bg-white shadow-[2px_2px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#000]"
                              onMouseEnter={e => (e.currentTarget.style.background = `${themeAccentHex}40`)}
                              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                            >
                              <CheckSquare className="w-4 h-4 text-black" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* WeLearn Peek Card */}
          <div className={`${cardBase} p-5 flex flex-col`} style={{ minHeight: '180px' }}>
            <div className="flex justify-between items-center mb-3 pb-2 border-b-2 border-black shrink-0">
              <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-1.5 text-black">
                <BookOpen className="w-4 h-4" /> Tugas WeLearn Terdekat
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {!moodleStatus?.isConnected ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-4">
                  <p className="text-[10px] font-semibold mb-2 text-black/60">Hubungkan akun WeLearn LMS Anda untuk sinkronisasi otomatis.</p>
                  <button
                    onClick={() => onNavigateToTab('integrations')}
                    className={`text-[9px] font-black px-3 py-1.5 rounded-lg border-2 border-black cursor-pointer transition-all bg-white hover:bg-neoOrange hover:text-white shadow-[2px_2px_0px_0px_#000] text-black`}
                  >
                    Hubungkan WeLearn
                  </button>
                </div>
              ) : upcomingWeLearn.length === 0 ? (
                <div className="h-full flex items-center justify-center py-6">
                  <p className="text-xs font-semibold flex items-center gap-1.5 text-black/60">
                    <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0" /> Hore! Semua tugas WeLearn Anda aman.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {upcomingWeLearn.map((assign) => (
                    <div key={assign.id} className="bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000] p-3 flex items-center justify-between gap-2 text-left">
                      <div className="min-w-0 flex-1">
                        <span className="text-[8px] font-mono font-bold block truncate text-black/50">
                          {assign.courseName.split('_').pop()?.replace(/_/g, ' ')}
                        </span>
                        <h4 className="font-black text-xs truncate text-black mt-0.5">{assign.name}</h4>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        <span className="text-[8px] font-mono font-bold text-black/60">
                          {assign.dueDate ? new Date(assign.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : 'No Date'}
                        </span>
                        <a
                          href={assign.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-[8px] font-black px-2 py-0.5 rounded border-2 border-black cursor-pointer transition-all bg-white hover:bg-neoOrange hover:text-white shadow-[1px_1px_0px_0px_#000] text-black"
                        >
                          LMS ↗
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* KOLOM KANAN: Spotify Player, AI Assistant & Quota (1/3 Lebar) */}
        <div className="lg:col-span-1 space-y-6">
          {/* Spotify Focus Player Embed */}
          <div className={`${cardBase} p-5 flex flex-col gap-3.5`}>
            <div className="flex justify-between items-center pb-2.5 border-b-2 border-black">
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-black">
                <Music className="w-4 h-4 text-black animate-bounce" /> Spotify Focus Player
              </h3>
              <button
                onClick={() => setIsSpotifyExpanded(!isSpotifyExpanded)}
                className="p-1 rounded border-2 border-black bg-white hover:bg-slate-50 text-black shadow-[1.5px_1.5px_0px_0px_#000] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none hover:translate-x-[-0.5px] hover:translate-y-[-0.5px] hover:shadow-[2px_2px_0px_0px_#000] transition-all cursor-pointer flex items-center justify-center"
                title={isSpotifyExpanded ? 'Perkecil Player' : 'Perbesar Player'}
              >
                {isSpotifyExpanded ? (
                  <Minimize2 className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5 stroke-[2.5]" />
                )}
              </button>
            </div>
            <div className="rounded-xl overflow-hidden border-2 border-black shadow-[3px_3px_0px_0px_#000]">
              <iframe
                src="https://open.spotify.com/embed/playlist/37i9dQZF1DWWQRwui0ExPn?utm_source=generator&theme=0"
                width="100%"
                height={isSpotifyExpanded ? "380" : "152"}
                frameBorder="0"
                allowFullScreen={false}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                className="w-full transition-all duration-300"
              />
            </div>
            <p className="text-[9px] font-bold text-black/50 text-center leading-snug px-1">
              Putar musik Lofi Beats atau ambient ini untuk membantumu tetap rileks dan berkonsentrasi tinggi.
            </p>
          </div>

          {/* AI Control Center & Quick Chat */}
          <div className={`${cardBase} p-5 flex flex-col gap-4`}>
            <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 pb-2.5 border-b-2 border-black text-black">
              <div className="p-1 border border-black rounded" style={{ background: themeAccentHex }}>
                <Zap className="w-3.5 h-3.5" style={{ color: isDark ? '#fff' : '#000' }} />
              </div>
              Pusat Kendali AI
            </h3>

            {/* Quick Interactive Chat Input */}
            <form onSubmit={handleMiniChatSubmit} className="space-y-2 text-left">
              <label className="text-[9px] font-black text-black/60 uppercase tracking-wider block">Tanya Asisten AI</label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="Ketik tugas / tanya AI di sini..."
                  value={miniChatInput}
                  onChange={(e) => setMiniChatInput(e.target.value)}
                  className="w-full border-2 border-black rounded-xl pl-3 pr-10 py-2.5 text-xs font-bold bg-white focus:outline-none focus:ring-0 text-black animate-none"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 p-1.5 rounded-lg border border-black bg-white hover:bg-slate-100 transition-colors cursor-pointer text-black"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>

            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t-2 border-black">
              <button
                onClick={() => onNavigateToTab('list')}
                className="text-[10px] py-2 px-2 font-black rounded-xl border-2 border-black cursor-pointer transition-all bg-white hover:bg-neoYellow shadow-[2px_2px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#000] text-black text-center"
              >
                🚀 Tambah Tugas
              </button>
              <button
                onClick={() => onNavigateToTab('excuse-letter')}
                className="text-[10px] py-2 px-2 font-black rounded-xl border-2 border-black cursor-pointer transition-all bg-white hover:bg-neoPink hover:text-white shadow-[2px_2px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#000] text-black text-center"
              >
                📄 Surat Izin
              </button>
            </div>
          </div>

          {/* Quota & Plan Widget */}
          <QuotaWidget onPlanUpgraded={() => window.location.reload()} />
        </div>

      </div>

    </div>
  );
}
