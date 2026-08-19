'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import NumberFlow from '../ui/NumberFlow';
import { 
  Sparkles, Calendar, Clock, Plus, Zap, CheckCircle2,
  RefreshCw, MessageSquare, BookOpen, GraduationCap,
  BrainCircuit, ShieldCheck, CheckSquare, CalendarDays,
  Send, Music, Maximize2, Minimize2, Trophy
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
import WeatherParticleCanvas from './WeatherParticleCanvas';
import PokopiaModal from '../ui/PokopiaModal';
import NextMissionCard from './NextMissionCard';
import BYOKNoticeBanner from './BYOKNoticeBanner';

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
  tasks?: Task[];
}

// â”€â”€â”€ WEATHER THEME DEFINITIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ WEATHERAPI.COM CONDITION CODE → WMO CODE MAPPER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ PERCEPTION FILTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€â”€ NIGHT MODE THEMES (DARK MODE) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€â”€ DAY MODE THEMES (LIGHT MODE) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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




// â”€â”€â”€ MAIN COMPONENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function OverviewTab({ onNavigateToTab, tasks: propTasks }: OverviewTabProps) {
  const { user } = useAuth();
  
  const { analyticsData, insights, isLoading: analyticsLoading, fetchAnalyticsData } = useAnalytics();
  const { events, connections, isLoading: calendarLoading, fetchConnections, fetchEvents, syncCalendar } = useCalendar();
  const { status: moodleStatus, upcomingAssignments: moodleAssignments, isLoading: moodleLoading, fetchStatus: fetchMoodleStatus, fetchAssignments: fetchMoodleAssignments, syncNow: syncMoodle } = useMoodle();
  const { triggerAutoSchedule, isLoading: schedulingLoading } = useScheduling();
  const { openWithContext } = useAIChatBridge();

  const [mobileZenMode, setMobileZenMode] = useState<'missions' | 'welearn' | 'asep'>('missions');
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (propTasks && propTasks.length > 0) {
      setTasks(propTasks);
      setTasksLoading(false);
    }
  }, [propTasks]);

  // Player RPG Level & XP calculation
  const completedTasksCount = useMemo(() => tasks.filter(t => t.status === 'completed').length, [tasks]);
  const playerLevel = useMemo(() => Math.floor(completedTasksCount / 3) + 1, [completedTasksCount]);
  const currentXP = useMemo(() => (completedTasksCount % 3) * 350 + 150, [completedTasksCount]);
  const maxXP = 1000;
  const xpPercent = Math.min(100, Math.round((currentXP / maxXP) * 100));
  const [showPokopiaModal, setShowPokopiaModal] = useState(false);
  const [miniChatInput, setMiniChatInput] = useState('');
  const [isSpotifyExpanded, setIsSpotifyExpanded] = useState(false);
  const [showSecondaryStats, setShowSecondaryStats] = useState(false);
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
        // â”€â”€ WeatherAPI.com (via server proxy untuk keamanan key) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        toast.success('🏆 QUEST COMPLETE! +100 XP diperoleh! ⚡');
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

  // â”€â”€â”€ Neobrutalism card styling helpers (Sidebar Menu Style) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Struktur neobrutalism TETAP: border hitam + box-shadow
  // Aksen warna berubah mengikuti tema cuaca/waktu dari `theme`
  const cardBase = 'bg-white border-3 border-black rounded-2xl shadow-[5px_5px_0px_0px_#000]';
  const metricCardBase = 'bg-white border-3 border-black rounded-xl shadow-[4px_4px_0px_0px_#000]';
  const textPrimary = 'text-black';
  const textSub = 'text-black/60 font-semibold';
  const btnPrimary = 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#000] transition-all cursor-pointer font-black';

  // â”€â”€â”€ WEATHER-ADAPTIVE ACCENT SYSTEM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Warna aksen diambil dari tema cuaca yang aktif.
  // Semua warna ini berubah otomatis saat cuaca/waktu berubah.
  const isDark = !!theme.isDark;

  // Hex warna aksen utama tema (digunakan untuk inline style)
  const themeAccentHex = theme.accent;  // misal '#FBBF24' (cerah), '#A78BFA' (malam), '#3B82F6' (hujan)

  // Warna progress bar & timeline dot mengikuti aksen tema
  const progressBarColor = themeAccentHex;
  const timelineTaskDot = themeAccentHex;

  // â”€â”€â”€ LOADING SKELETON â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (isLoading && tasks.length === 0) {
    return (
      <div className="relative w-full space-y-5 text-left animate-pulse">
        <div className="border-3 border-black rounded-2xl p-6 h-36 bg-slate-100 shadow-[5px_5px_0px_0px_#000]" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className={`${metricCardBase} p-4 h-28`} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3 space-y-5">
            <div className={`${cardBase} p-5 h-[400px]`} />
          </div>
          <div className="lg:col-span-2 space-y-5">
            <div className={`${cardBase} p-5 h-[200px]`} />
            <div className={`${cardBase} p-5 h-[180px]`} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full space-y-5 text-left">
      <BYOKNoticeBanner onOpenSettings={() => onNavigateToTab('preferences' as any)} />

      {/* ==========================================================
          SECTION 1: NEOBRUTALIST GAMIFIED HERO BANNER
          ========================================================== */}
      <div className="rounded-2xl p-5 md:p-6 bg-neoYellow border-4 border-black shadow-[6px_6px_0px_0px_#000] text-black mb-2 transition-all space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          {/* Left: Level & Greeting */}
          <div className="flex items-center gap-3.5">
            <button 
              onClick={() => setShowPokopiaModal(true)}
              className="w-13 h-13 rounded-xl bg-violet-600 border-3 border-black text-white flex items-center justify-center font-heading font-black text-base shadow-[3px_3px_0px_0px_#000] active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-none transition-all cursor-pointer hover:bg-violet-700 shrink-0"
              title="Buka Status Pokopia"
            >
              LV.<NumberFlow value={playerLevel} />
            </button>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="inline-block px-2 py-0.5 bg-black text-white font-mono text-[9px] uppercase font-black tracking-wider rounded">
                  PLAYER STATUS: ACTIVE ⚡
                </span>
                <span className="inline-block px-2 py-0.5 bg-white border-2 border-black text-black font-mono text-[9px] uppercase font-black tracking-wider rounded shadow-[1px_1px_0px_#000]">
                  <CalendarDays className="w-3 h-3 inline mr-1 text-black" />
                  {formattedDate}
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-black flex items-center gap-2">
                {timeGreeting}, {user?.name || 'Misionaris'}! ⚔️
              </h1>
            </div>
          </div>

          {/* Right: Weather & Streak Badge */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <div className="px-3 py-1.5 bg-white border-3 border-black rounded-xl font-mono text-xs font-black shadow-[2.5px_2.5px_0px_0px_#000] flex items-center gap-1.5">
              <span className="text-base">🔥</span>
              <span>7 DAYS STREAK!</span>
            </div>
            <div className="px-3 py-1.5 bg-white border-3 border-black rounded-xl font-mono text-xs font-black shadow-[2.5px_2.5px_0px_0px_#000] flex items-center gap-1.5">
              <theme.Icon size={14} className="inline opacity-80" />
              <span>{weatherData.loading ? '...' : `${weatherData.temp}°C · ${theme.name}`}</span>
            </div>
            <button
              onClick={() => setShowPokopiaModal(true)}
              className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 border-3 border-black rounded-xl font-mono text-xs font-black shadow-[2.5px_2.5px_0px_0px_#000] text-black active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5 text-black animate-spin" style={{ animationDuration: '4s' }} />
              Pokopia
            </button>
          </div>
        </div>

        {/* Progress Bar & Quest XP Indicator */}
        <div className="p-3.5 bg-white border-3 border-black rounded-xl shadow-[3px_3px_0px_0px_#000] space-y-2">
          <div className="flex justify-between items-center font-black text-[10px] md:text-xs font-mono">
            <span className="uppercase tracking-wide text-black">SCHEDULER WARRIOR · LEVEL {playerLevel + 1} PROGRESS</span>
            <span className="bg-neoYellow px-2 py-0.5 border-2 border-black rounded shadow-[1px_1px_0px_#000] text-black">
              <NumberFlow value={currentXP} /> / {maxXP} XP
            </span>
          </div>
          
          <div className="h-4 w-full bg-slate-100 border-3 border-black rounded-lg overflow-hidden p-0.5">
            <div 
              className="h-full bg-emerald-400 border-r-2 border-black rounded-sm transition-all duration-700"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* NEXT MISSION CARD (Focal Point Utama Beranda) */}
      <NextMissionCard 
        tasks={tasks} 
        onNavigateToList={() => onNavigateToTab('list')} 
      />

      {/* ==========================================================
          MOBILE ZEN SWITCHER (Mobile Only)
          ==========================================================
          ========================================================== */}
      <div className="md:hidden flex items-center justify-between bg-white border-3 border-black p-1.5 rounded-2xl shadow-[4px_4px_0px_#000]">
        {(['missions','welearn','asep'] as const).map((mode) => {
          const labels = { missions: '🎯 Misi', welearn: '📚 WeLearn', asep: '🤖 AI' };
          const activeColors = { missions: 'bg-neoYellow', welearn: 'bg-neoMint', asep: 'bg-neoViolet text-white' };
          const isActive = mobileZenMode === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => setMobileZenMode(mode)}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 min-h-[44px] ${
                isActive
                  ? `${activeColors[mode]} border-2 border-black shadow-[1.5px_1.5px_0px_#000]`
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              {labels[mode]}
            </button>
          );
        })}
      </div>

      {/* MOBILE ZEN CONTENT */}
      <div className="md:hidden">
        {mobileZenMode === 'missions' && (
          <div className={`${cardBase} p-5 space-y-3`}>
            <div className="flex items-center justify-between pb-2.5 border-b-2 border-slate-100">
              <span className="text-xs font-black uppercase flex items-center gap-1.5 text-black">
                <CheckSquare className="w-4 h-4 text-neoOrange" /> Fokus Hari Ini
              </span>
              <span className="text-[10px] font-mono font-bold bg-neoYellow border border-black px-2 py-0.5 rounded shadow-[1px_1px_0px_#000]">
                {taskCounts.pending} Pending
              </span>
            </div>
            <div className="space-y-2">
              {tasks.filter(t => t.status !== 'completed').slice(0, 5).map((task) => {
                const isBoss = task.dueDate && new Date(task.dueDate).getTime() - Date.now() < 86400000;
                const questType = isBoss ? '👾 BOSS' : task.category === 'education' ? '⚔️ MAIN' : '🛡️ SIDE';
                const badgeBg = isBoss ? 'bg-neoPink text-white' : task.category === 'education' ? 'bg-neoYellow text-black' : 'bg-neoMint text-black';
                return (
                  <div key={task.id} className={`flex items-center justify-between p-3 rounded-2xl border-2 border-black shadow-[2px_2px_0px_#000] ${isBoss ? 'bg-neoPink/10 border-neoPink' : 'bg-white'}`}>
                    <div className="min-w-0 flex-1 pr-2">
                      <span className={`text-[8px] font-mono font-black px-2 py-0.5 rounded-full border border-black ${badgeBg} mr-1`}>{questType}</span>
                      <span className="font-black text-black text-xs block truncate mt-1">{task.title}</span>
                    </div>
                    <button onClick={() => handleToggleTaskComplete(task.id, task.status)}
                      className="min-h-[44px] min-w-[44px] px-3 bg-neoMint hover:bg-neoYellow rounded-xl border-2 border-black shadow-[1.5px_1.5px_0px_#000] active:scale-90 transition-all cursor-pointer flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-black" />
                    </button>
                  </div>
                );
              })}
              {tasks.filter(t => t.status !== 'completed').length === 0 && (
                <div className="py-6 text-center text-xs font-bold text-slate-500">🎉 Semua tugas selesai!</div>
              )}
            </div>
            <button onClick={() => onNavigateToTab('list')} className={`w-full text-xs font-black min-h-[44px] py-3 ${btnPrimary} rounded-xl`}>
              Kelola Semua Tugas →
            </button>
          </div>
        )}

        {mobileZenMode === 'welearn' && (
          <div className={`${cardBase} p-5 space-y-3`}>
            <div className="flex items-center justify-between pb-2.5 border-b-2 border-slate-100">
              <span className="text-xs font-black uppercase flex items-center gap-1.5 text-black">
                <BookOpen className="w-4 h-4 text-neoBlue" /> WeLearn Radar
              </span>
              <span className="text-[10px] font-mono font-bold bg-neoMint border border-black px-2 py-0.5 rounded shadow-[1px_1px_0px_#000]">LMS</span>
            </div>
            {moodleAssignments.length > 0 ? (
              <div className="bg-[#E0F2FE] border-2 border-black p-3 rounded-xl">
                <div className="flex justify-between text-[10px] font-mono font-black text-blue-900 mb-1">
                  <span>Deadline Terdekat</span>
                  <span>{new Date(moodleAssignments[0].dueDate || Date.now()).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                </div>
                <p className="font-black text-sm text-black">{moodleAssignments[0].name}</p>
                <p className="text-xs text-slate-600 font-bold">{moodleAssignments[0].courseName}</p>
              </div>
            ) : (
              <div className="py-6 text-center text-xs font-bold text-slate-500">Tidak ada agenda WeLearn terdekat.</div>
            )}
            <button onClick={() => onNavigateToTab('welearn')} className={`w-full text-xs font-black min-h-[44px] py-3 ${btnPrimary} rounded-xl`}>
              Buka Radar WeLearn →
            </button>
          </div>
        )}

        {mobileZenMode === 'asep' && (
          <div className={`${cardBase} p-5 space-y-3`}>
            <div className="flex items-center justify-between pb-2.5 border-b-2 border-slate-100">
              <span className="text-xs font-black uppercase flex items-center gap-1.5 text-black">
                <BrainCircuit className="w-4 h-4 text-neoViolet" /> Tanya Asep AI
              </span>
              <span className="text-[10px] font-mono font-bold bg-neoYellow border border-black px-2 py-0.5 rounded shadow-[1px_1px_0px_#000]">Active</span>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (miniChatInput.trim()) { openWithContext(miniChatInput); setMiniChatInput(''); }}} className="flex gap-2">
              <input type="text" value={miniChatInput} aria-label="Pertanyaan AI" onChange={(e) => setMiniChatInput(e.target.value)}
                placeholder="Misal: Rencanakan hari ini..."
                className="flex-1 min-h-[44px] px-3 py-2 bg-slate-50 border-2 border-black rounded-xl text-xs font-bold focus:outline-none focus:bg-white text-black" />
              <button type="submit" className="min-h-[44px] min-w-[44px] p-2 bg-neoYellow border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] active:scale-95 cursor-pointer flex items-center justify-center">
                <Send className="w-4 h-4 text-black" />
              </button>
            </form>
            <button onClick={() => openWithContext('Halo Asep, bantu saya merencanakan hari ini!')}
              className={`w-full text-xs font-black min-h-[44px] py-3 ${btnPrimary} rounded-xl`}>
              Buka Chat AI Fullscreen ✨
            </button>
          </div>
        )}
      </div>

                  {/* ==========================================================
          SECTION 2: STATS ROW — 3 Compact Metric Cards (Compact & Informative)
          ========================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        
        {/* Card 1: Produktivitas */}
        <div className={`${metricCardBase} p-3.5 h-[104px] flex flex-col justify-between hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_0px_#000] transition-all`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-black/60">Produktivitas</span>
            <div className="w-6 h-6 rounded-lg bg-neoYellow border border-black flex items-center justify-center shadow-[1px_1px_0px_#000] shrink-0">
              <Zap className="w-3.5 h-3.5 text-black fill-black" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-1">
            <div className="text-xl font-black text-black leading-none">
              {analyticsData?.summary?.productivityScore.toFixed(1) || '8.5'}
              <span className="text-[10px] font-bold text-black/50 ml-0.5">/10</span>
            </div>
            <button
              onClick={handleAIReorder}
              disabled={schedulingAllLocal || schedulingLoading}
              className="px-2 py-1 text-[9px] font-black rounded-lg bg-white border border-black text-black shadow-[1px_1px_0px_#000] hover:bg-neoYellow transition-all cursor-pointer flex items-center gap-1 active:scale-95 shrink-0"
            >
              <BrainCircuit className={`w-3 h-3 ${schedulingAllLocal ? 'animate-spin' : ''}`} />
              {schedulingAllLocal ? '...' : 'AI Auto-Jadwal'}
            </button>
          </div>
        </div>

        {/* Card 2: Progress Quest */}
        <div 
          onClick={() => onNavigateToTab('list')}
          className={`${metricCardBase} p-3.5 h-[104px] flex flex-col justify-between hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_0px_#000] transition-all cursor-pointer`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-black/60">Progress Quest</span>
            <div className="w-6 h-6 rounded-lg bg-neoMint border border-black flex items-center justify-center shadow-[1px_1px_0px_#000] shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-black" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-xl font-black text-black leading-none">
              {taskCounts.completed}
              <span className="text-[10px] font-bold text-black/50 ml-1">/ {taskCounts.total} tugas</span>
            </div>
            <span className="text-[10px] font-mono font-black px-1.5 py-0.5 bg-neoYellow border border-black rounded shadow-[1px_1px_0px_#000]">
              {taskCounts.ratio}%
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 border border-black rounded-full overflow-hidden p-0.5 shadow-inner">
            <div 
              className="h-full bg-neoMint rounded-full transition-all duration-700" 
              style={{ width: `${taskCounts.ratio}%` }} 
            />
          </div>
        </div>

        {/* Card 3: Akademik & LMS */}
        <div 
          onClick={() => onNavigateToTab('welearn')}
          className={`${metricCardBase} p-3.5 h-[104px] flex flex-col justify-between hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_0px_#000] transition-all cursor-pointer`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-black/60">Akademik & LMS</span>
            <div className="w-6 h-6 rounded-lg bg-neoViolet border border-black flex items-center justify-center shadow-[1px_1px_0px_#000] shrink-0">
              <GraduationCap className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-1">
            <div className="text-xl font-black text-black leading-none">
              {moodleAssignments.filter(a => a.submissionStatus !== 'submitted').length}
              <span className="text-[10px] font-bold text-black/50 ml-1">Tugas Pending</span>
            </div>
            <span className={`px-2 py-0.5 rounded font-black border border-black text-[8px] uppercase shadow-[1px_1px_0px_#000] shrink-0 ${
              analyticsData?.mlMetrics?.graduationRisk?.status === 'High' ? 'bg-neoOrange text-white'
              : analyticsData?.mlMetrics?.graduationRisk?.status === 'Moderate' ? 'bg-neoYellow text-black'
              : 'bg-neoMint text-black'
            }`}>
              Risiko: {analyticsData?.mlMetrics?.graduationRisk?.status === 'High' ? 'Tinggi'
               : analyticsData?.mlMetrics?.graduationRisk?.status === 'Moderate' ? 'Sedang' : 'Rendah'}
            </span>
          </div>
        </div>

      </div>



      {/* ==========================================================
          SECTION 3: MAIN GRID — 5-col split (3+2)
          Kiri (3/5): Quest List + Linimasa Tergabung
          Kanan (2/5): Agenda Terdekat + AI Oracle (1 aja)
          ==========================================================
          ========================================================== */}
      <div className="hidden md:grid md:grid-cols-5 gap-5">

        {/* ==========================================================
          KIRI: Quest Focus + Timeline â”€â”€ */}
        <div className="md:col-span-3 space-y-5">

          {/* QUEST FOCUS (Fokus Hari Ini) */}
          <div className={`${cardBase} p-5 flex flex-col`}>
            <div className="flex items-center justify-between pb-3 mb-3 border-b-2 border-black">
              <h2 className="text-sm font-black uppercase tracking-wider text-black flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-neoOrange" /> Fokus Hari Ini
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold bg-neoYellow border border-black px-2 py-0.5 rounded shadow-[1px_1px_0px_#000]">
                  {taskCounts.pending} Pending
                </span>
                <button onClick={() => onNavigateToTab('list')} className="text-[10px] font-black text-black/50 hover:text-black transition-colors">
                  Semua →
                </button>
              </div>
            </div>

            {tasks.filter(t => t.status !== 'completed').length === 0 ? (
              <div className="py-6 text-center text-xs font-bold text-slate-500">🎉 Semua quest selesai!</div>
            ) : (
              <div className="space-y-2.5">
                {tasks.filter(t => t.status !== 'completed').slice(0, 4).map(task => {
                  const isBoss = task.dueDate && new Date(task.dueDate).getTime() - Date.now() < 86400000;
                  const questType = isBoss ? '👾 BOSS' : task.category === 'education' ? '⚔️ MAIN' : '🛡️ SIDE';
                  const badgeBg = isBoss ? 'bg-neoPink text-white border-neoPink' : task.category === 'education' ? 'bg-neoYellow text-black' : 'bg-neoMint text-black';
                  const xpReward = isBoss ? '+150 XP' : '+100 XP';
                  return (
                    <div key={task.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#000] ${isBoss ? 'bg-neoPink/10' : 'bg-white'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-[8px] font-mono font-black px-2 py-0.5 rounded-full border border-black ${badgeBg}`}>{questType}</span>
                          <span className="text-[8px] font-mono font-black text-black/50 bg-slate-100 border border-black/20 px-1.5 py-0.5 rounded">{xpReward}</span>
                        </div>
                        <span className="font-black text-xs text-black block truncate">{task.title}</span>
                      </div>
                      <button onClick={() => handleToggleTaskComplete(task.id, task.status)}
                        className="w-9 h-9 rounded-xl border-2 border-black shadow-[1.5px_1.5px_0px_#000] bg-white hover:bg-neoMint transition-all cursor-pointer flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-black" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* LINIMASA AGENDA HARI INI */}
          <div className={`${cardBase} p-5 flex flex-col`} style={{ height: '360px' }}>
            <div className="flex justify-between items-center mb-4 shrink-0 pb-3 border-b-2 border-black">
              <h2 className="text-sm font-black flex items-center gap-2 text-black uppercase tracking-wider">
                <Clock className="w-4 h-4" /> Linimasa Hari Ini
              </h2>
              <div className="flex items-center gap-2">
                <span className="neo-badge text-[9px] font-mono font-black px-2.5 py-1 border border-black"
                      style={{ background: themeAccentHex, color: isDark ? '#fff' : '#000' }}>
                  {todayAgenda.length} Kegiatan
                </span>
                <button onClick={() => onNavigateToTab('calendar')} className="text-[10px] font-black text-black/50 hover:text-black transition-colors">
                  Kalender →
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {todayAgenda.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <h4 className="font-black text-xs text-black uppercase">Tidak Ada Agenda</h4>
                  <p className="text-[10px] font-semibold text-black/50 mt-1 mb-3">Semua telah selesai atau belum dialokasikan AI.</p>
                  <button onClick={() => onNavigateToTab('list')} className={`text-xxs font-black px-3 py-1.5 rounded-lg border ${btnPrimary}`}>
                    Buat Tugas Baru <Plus className="w-3 h-3 inline ml-0.5" />
                  </button>
                </div>
              ) : (
                <div className="relative border-l-3 border-black pl-5 ml-4 py-1 space-y-4">
                  {todayAgenda.map((item) => {
                    const isTask = item.type === 'task';
                    const startStr = new Date(item.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    const endStr = new Date(item.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={item.id} className="relative group">
                        <div className="absolute -left-[24.5px] top-2.5 w-3.5 h-3.5 border-2 border-black rounded-full z-10 transition-all group-hover:scale-125"
                             style={{ backgroundColor: isTask ? timelineTaskDot : '#8B5CF6' }} />
                        <div className="bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] rounded-xl p-3 flex items-center justify-between gap-3 transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#000]">
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[9px] font-black px-1.5 py-0.5 bg-neoCream border border-black rounded text-black">{startStr} – {endStr}</span>
                              <span className="text-[8px] font-black uppercase px-1.5 py-0.5 border border-black rounded"
                                    style={{ backgroundColor: isTask ? timelineTaskDot : '#8B5CF6', color: isTask ? (isDark ? '#fff' : '#000') : '#fff' }}>
                                {isTask ? 'Tugas' : 'Event'}
                              </span>
                            </div>
                            <h3 className="font-black text-xs truncate text-black">{item.title}</h3>
                          </div>
                          {isTask && (
                            <button onClick={() => handleToggleTaskComplete(item.id, item.status || 'pending')}
                              className="w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center bg-white hover:bg-neoMint shadow-[2px_2px_0px_0px_#000] transition-all cursor-pointer shrink-0">
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
        </div>

        {/* ==========================================================
          KANAN: Agenda Terdekat + AI Oracle (satu saja, bukan dua) â”€â”€ */}
        <div className="md:col-span-2 space-y-5">

          {/* AGENDA TERDEKAT + NEXT MISSION */}
          <div className={`${cardBase} p-5 flex flex-col gap-3`}>
            <div className="flex items-center justify-between pb-2.5 border-b-2 border-black">
              <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2 text-black">
                <CalendarDays className="w-4 h-4 text-neoBlue" /> Agenda Terdekat
              </h3>
              <span className="text-[10px] font-mono font-bold bg-neoMint border border-black px-2 py-0.5 rounded shadow-[1px_1px_0px_#000]">
                {todayAgenda.length} Jadwal
              </span>
            </div>

            {/* Next agenda item highlight */}
            {nextAgendaItem && (
              <div className="p-3 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]"
                   style={{ background: themeAccentHex + '20', borderColor: '#000' }}>
                <div className="text-[9px] font-mono font-black text-black/60 uppercase tracking-wider mb-1">Selanjutnya</div>
                <p className="font-black text-xs text-black leading-snug">{nextAgendaItem.title}</p>
                <p className="text-[9px] font-bold text-black/50 mt-0.5">
                  {new Date(nextAgendaItem.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )}

            {/* Moodle deadline card */}
            {moodleAssignments.length > 0 ? (
              <div className="bg-[#E0F2FE] border-2 border-black p-3 rounded-xl shadow-[2px_2px_0px_#000]">
                <div className="flex justify-between text-[10px] font-mono font-black text-blue-900 mb-1">
                  <span>Deadline WeLearn</span>
                  <span>{new Date(moodleAssignments[0].dueDate || Date.now()).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                </div>
                <p className="font-black text-xs text-black truncate">{moodleAssignments[0].name}</p>
                <p className="text-[10px] text-slate-600 font-semibold truncate">{moodleAssignments[0].courseName}</p>
              </div>
            ) : events.length > 0 ? (
              <div className="bg-[#FEF08A] border-2 border-black p-3 rounded-xl shadow-[2px_2px_0px_#000]">
                <div className="flex justify-between text-[10px] font-mono font-black text-amber-900 mb-1">
                  <span>Event Kalender</span><span>Hari ini</span>
                </div>
                <p className="font-black text-xs text-black truncate">{events[0].title}</p>
              </div>
            ) : (
              <div className="py-4 text-center text-xs font-bold text-slate-500">Tidak ada agenda terdekat.</div>
            )}

            <button onClick={() => onNavigateToTab('calendar')} className={`w-full text-xs font-black min-h-[44px] py-2.5 ${btnPrimary} rounded-xl`}>
              Lihat Kalender Lengkap →
            </button>
          </div>

          {/* AI ORACLE — Satu-satunya AI input, tidak duplikat */}
          <div className={`${cardBase} p-5 flex flex-col gap-3`}>
            <div className="flex items-center justify-between pb-2.5 border-b-2 border-black">
              <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2 text-black">
                <BrainCircuit className="w-4 h-4 text-neoViolet" /> Tanya Asep AI
              </h3>
              <span className="text-[10px] font-mono font-bold bg-neoYellow border border-black px-2 py-0.5 rounded shadow-[1px_1px_0px_#000]">AI Copilot</span>
            </div>

            <p className="text-[10px] font-semibold text-black/60">Ketik instruksi atau pertanyaan cepat:</p>

            <form onSubmit={handleMiniChatSubmit} className="flex gap-2">
              <input type="text" value={miniChatInput} aria-label="Pertanyaan Asep AI"
                onChange={(e) => setMiniChatInput(e.target.value)}
                placeholder="Misal: Rencanakan hari ini..."
                className="flex-1 min-h-[44px] px-3 py-2 bg-slate-50 border-2 border-black rounded-xl text-xs font-bold focus:outline-none focus:bg-white text-black" />
              <button type="submit" className="min-h-[44px] min-w-[44px] p-2 bg-neoYellow border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] active:scale-95 cursor-pointer flex items-center justify-center">
                <Send className="w-4 h-4 text-black" />
              </button>
            </form>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => onNavigateToTab('list')} className={`text-[10px] py-2 px-2 font-black rounded-xl ${btnPrimary} text-center`}>
                🚀 Tambah Tugas
              </button>
              <button onClick={() => openWithContext('Halo Asep, bantu saya merencanakan hari ini!')}
                className={`text-[10px] py-2 px-2 font-black rounded-xl ${btnPrimary} text-center`}>
                ✨ Chat Fullscreen
              </button>
            </div>
          </div>

          {/* SPOTIFY (Collapsible, di kanan bawah) */}
          <div className={`${cardBase} p-4 flex flex-col gap-2`}>
            <div className="flex justify-between items-center pb-2 border-b-2 border-black">
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-black">
                <Music className="w-4 h-4 animate-bounce" /> Focus Music
              </h3>
              <button onClick={() => setIsSpotifyExpanded(!isSpotifyExpanded)}
                className="p-1 rounded border-2 border-black bg-white hover:bg-slate-50 shadow-[1.5px_1.5px_0px_#000] hover:translate-x-[-0.5px] hover:translate-y-[-0.5px] hover:shadow-[2px_2px_0px_#000] transition-all cursor-pointer">
                {isSpotifyExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="rounded-xl overflow-hidden">
              <iframe src="https://open.spotify.com/embed/playlist/37i9dQZF1DWWQRwui0ExPn?utm_source=generator&theme=0"
                width="100%" height={isSpotifyExpanded ? '320' : '90'}
                frameBorder="0" allowFullScreen={false}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy" className="w-full transition-all duration-300 rounded-xl" />
            </div>
          </div>
        </div>
      </div>

      {/* ==========================================================
          SECTION 4: WELEARN TERDEKAT — Conditional (hanya tampil jika ada tugas)
          ==========================================================
          ========================================================== */}
      {upcomingWeLearn.length > 0 && (
        <div className={`${cardBase} p-5`}>
          <div className="flex justify-between items-center mb-3 pb-2 border-b-2 border-black">
            <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-1.5 text-black">
              <BookOpen className="w-4 h-4" /> Tugas WeLearn Mendekat
            </h3>
            <button onClick={() => onNavigateToTab('welearn')} className="text-[10px] font-black text-black/50 hover:text-black transition-colors">
              Lihat Semua →
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upcomingWeLearn.map((assign) => (
              <div key={assign.id} className="bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] p-3 flex items-center justify-between gap-2">
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
                  <a href={assign.url} target="_blank" rel="noopener noreferrer"
                    className={`inline-flex items-center text-[8px] font-black px-2 py-0.5 rounded border-2 border-black cursor-pointer hover:bg-neoOrange hover:text-white shadow-[1px_1px_0px_#000] text-black transition-all`}>
                    LMS â†—
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Weather Recommendation Card (Directly visible) */}
      <div className="relative border-3 border-black rounded-2xl p-4 overflow-hidden shadow-[4px_4px_0px_0px_#000]"
           style={{ background: isDark ? 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)' : theme.bgGradient }}>
        <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
          <WeatherParticleCanvas type={theme.particleType} />
        </div>
        <div className="relative z-10 flex gap-3 items-center">
          <div className="w-10 h-10 rounded-xl bg-white border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0">
            <Sparkles className="w-5 h-5 text-neoOrange" />
          </div>
          <div className="flex-1">
            <span className="text-[9px] font-black uppercase tracking-wider text-black/50 block">Rekomendasi AI · {theme.name}</span>
            <p className={`text-xs font-bold leading-snug ${isDark ? 'text-white' : 'text-black'}`}>
              {theme.recommendation}{' '}
              {taskCounts.pending > 0 ? `Kamu punya ${taskCounts.pending} tugas tertunda.` : 'Luar biasa! Semua tugas selesai.'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-lg font-black ${isDark ? 'text-white' : 'text-black'}`}>{weatherData.temp}°C</div>
            <div className={`text-[9px] font-bold ${isDark ? 'text-white/60' : 'text-black/50'}`}>{weatherData.city}</div>
          </div>
        </div>
      </div>

      {/* Pokopia Game Modal Demo */}
      <PokopiaModal
        isOpen={showPokopiaModal}
        onClose={() => setShowPokopiaModal(false)}
        badge={`LEVEL ${playerLevel} REWARD`}
        title="VICTORY & REWARD!"
        subtitle={`Selamat ${user?.name || 'Warrior'}! Kamu telah menyelesaikan ${completedTasksCount} tugas & mengumpulkan ${currentXP} XP.`}
        icon={<Trophy className="w-7 h-7 text-amber-900" />}
        primaryAction={{
          label: 'KLAIM HADIAH (+350 XP)',
          onClick: () => {
            toast.success('🎉 Hadiah berhasil diklaim! +350 XP ditambahkan!');
            setShowPokopiaModal(false);
          },
          variant: 'gold',
        }}
        secondaryAction={{
          label: 'TUTUP',
          onClick: () => setShowPokopiaModal(false),
        }}
      >
        <div className="space-y-3 py-1">
          <div className="bg-amber-100/80 border-2 border-black rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 border-2 border-black flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_#000]">
              ⚡
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-mono font-black text-amber-900 uppercase">BONUS STATS</div>
              <div className="text-xs font-black text-black">Master Scheduler Title Unlocked</div>
            </div>
            <span className="text-xs font-black bg-white border-2 border-black px-2.5 py-1 rounded-xl shadow-[1.5px_1.5px_0px_#000]">
              +350 XP
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-left">
            <div className="bg-slate-50 border-2 border-black p-2.5 rounded-xl shadow-[1.5px_1.5px_0px_#000]">
              <span className="text-[9px] font-mono font-bold text-slate-500 block">TOTAL MISI</span>
              <span className="text-sm font-black text-black">{completedTasksCount} Completed</span>
            </div>
            <div className="bg-slate-50 border-2 border-black p-2.5 rounded-xl shadow-[1.5px_1.5px_0px_#000]">
              <span className="text-[9px] font-mono font-bold text-slate-500 block">PRODUCTIVITY</span>
              <span className="text-sm font-black text-emerald-600">{analyticsData?.summary?.productivityScore.toFixed(1) || '8.5'} / 10</span>
            </div>
          </div>
        </div>
      </PokopiaModal>

    </div>
  );
}
