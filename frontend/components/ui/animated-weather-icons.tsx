"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface WeatherIconProps {
  size?: number;
  className?: string;
}

/* ─── SUN ─── */
export function SunIcon({ size = 48, className }: WeatherIconProps) {
  return (
    <motion.svg viewBox="0 0 48 48" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <motion.g animate={{ rotate: 360 }} transition={{ duration: 12, ease: "linear", repeat: Infinity }}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <motion.line key={deg} x1="24" y1="6" x2="24" y2="10" stroke="#D97706" strokeWidth={2} strokeLinecap="round"
            style={{ transformOrigin: "24px 24px", rotate: deg }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, delay: deg / 360 }} />
        ))}
      </motion.g>
      <motion.circle cx="24" cy="24" r="8" fill="#FBBF24" opacity={0.35}
        animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} />
      <circle cx="24" cy="24" r="8" stroke="#B45309" strokeWidth={2.5} />
    </motion.svg>
  );
}

/* ─── MOON ─── */
export function MoonIcon({ size = 48, className }: WeatherIconProps) {
  const stars = [
    { cx: 34, cy: 10, d: 0 }, { cx: 38, cy: 18, d: 0.5 },
    { cx: 30, cy: 6, d: 1 }, { cx: 40, cy: 12, d: 1.5 },
  ];
  return (
    <svg viewBox="0 0 48 48" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <path d="M28 8a14 14 0 100 28 10 10 0 01 0-28z" fill="#FBBF24" opacity={0.25} />
      <path d="M28 8a14 14 0 100 28 10 10 0 01 0-28z" stroke="#FBBF24" strokeWidth={2.5} strokeLinecap="round" />
      {stars.map((s) => (
        <motion.circle key={s.cx + s.cy} cx={s.cx} cy={s.cy} r="1" fill="#A78BFA"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.3, 0.8] }}
          transition={{ duration: 2, repeat: Infinity, delay: s.d }} />
      ))}
    </svg>
  );
}

/* ─── CLOUD ─── */
export function CloudIcon({ size = 48, className }: WeatherIconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <motion.g animate={{ x: [0, 2, 0, -2, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
        <path d="M36 32H14a8 8 0 01-.5-16A10 10 0 0134 18a7 7 0 012 14z" fill="#E2E8F0" opacity={0.4} />
        <path d="M36 32H14a8 8 0 01-.5-16A10 10 0 0134 18a7 7 0 012 14z" stroke="#475569" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
    </svg>
  );
}

/* ─── RAIN ─── */
export function RainIcon({ size = 48, className }: WeatherIconProps) {
  const drops = [
    { x: 16, d: 0 }, { x: 22, d: 0.3 }, { x: 28, d: 0.6 }, { x: 34, d: 0.15 },
  ];
  return (
    <svg viewBox="0 0 48 48" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <path d="M36 26H14a7 7 0 01-.5-14A9 9 0 0134 14a6 6 0 012 12z" fill="#E2E8F0" opacity={0.15} />
      <path d="M36 26H14a7 7 0 01-.5-14A9 9 0 0134 14a6 6 0 012 12z" stroke="#E2E8F0" strokeWidth={2.5} strokeLinecap="round" />
      {drops.map((drop) => (
        <motion.line key={drop.x} x1={drop.x} y1={30} x2={drop.x} y2={34} stroke="#38BDF8" strokeWidth={2} strokeLinecap="round"
          animate={{ y: [0, 10], opacity: [1, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: drop.d, ease: "easeIn" }} />
      ))}
    </svg>
  );
}

/* ─── HEAVY RAIN ─── */
export function HeavyRainIcon({ size = 48, className }: WeatherIconProps) {
  const drops = [
    { x: 14, d: 0 }, { x: 19, d: 0.15 }, { x: 24, d: 0.3 },
    { x: 29, d: 0.1 }, { x: 34, d: 0.4 }, { x: 37, d: 0.25 },
  ];
  return (
    <svg viewBox="0 0 48 48" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <path d="M36 24H14a7 7 0 01-.5-14A9 9 0 0134 12a6 6 0 012 12z" fill="#E2E8F0" opacity={0.15} />
      <path d="M36 24H14a7 7 0 01-.5-14A9 9 0 0134 12a6 6 0 012 12z" stroke="#E2E8F0" strokeWidth={2.5} strokeLinecap="round" />
      {drops.map((drop) => (
        <motion.line key={drop.x} x1={drop.x} y1={28} x2={drop.x - 2} y2={34} stroke="#38BDF8" strokeWidth={1.8} strokeLinecap="round"
          animate={{ y: [0, 10], opacity: [1, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: drop.d, ease: "easeIn" }} />
      ))}
    </svg>
  );
}

/* ─── SNOW ─── */
export function SnowIcon({ size = 48, className }: WeatherIconProps) {
  const flakes = [
    { x: 16, d: 0 }, { x: 22, d: 0.5 }, { x: 28, d: 0.2 },
    { x: 34, d: 0.7 }, { x: 19, d: 1.0 }, { x: 31, d: 0.4 },
  ];
  return (
    <svg viewBox="0 0 48 48" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <path d="M36 26H14a7 7 0 01-.5-14A9 9 0 0134 14a6 6 0 012 12z" fill="#E2E8F0" opacity={0.4} />
      <path d="M36 26H14a7 7 0 01-.5-14A9 9 0 0134 14a6 6 0 012 12z" stroke="#475569" strokeWidth={2.5} strokeLinecap="round" />
      {flakes.map((f, i) => (
        <motion.circle key={i} cx={f.x} cy={30} r={1.8} fill="#38BDF8"
          animate={{ y: [0, 12], x: [0, i % 2 === 0 ? 3 : -3, 0], opacity: [1, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: f.d, ease: "easeIn" }} />
      ))}
    </svg>
  );
}

/* ─── THUNDER ─── */
export function ThunderIcon({ size = 48, className }: WeatherIconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <path d="M36 24H14a7 7 0 01-.5-14A9 9 0 0134 12a6 6 0 012 12z" fill="#E2E8F0" opacity={0.15} />
      <path d="M36 24H14a7 7 0 01-.5-14A9 9 0 0134 12a6 6 0 012 12z" stroke="#E2E8F0" strokeWidth={2.5} strokeLinecap="round" />
      <motion.path d="M26 24l-3 8h6l-3 10" stroke="#FBBF24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
        animate={{ opacity: [0, 1, 1, 0, 0, 0, 1, 0, 0, 0] }}
        transition={{ duration: 3, repeat: Infinity }} />
      <motion.path d="M26 24l-3 8h6l-3 10" fill="#FBBF24" opacity={0}
        animate={{ opacity: [0, 0.4, 0, 0, 0, 0, 0.3, 0, 0, 0] }}
        transition={{ duration: 3, repeat: Infinity }} />
    </svg>
  );
}

/* ─── WIND ─── */
export function WindIcon({ size = 48, className }: WeatherIconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <motion.path d="M6 18h26a4 4 0 000-8" stroke="#475569" strokeWidth={2.5} strokeLinecap="round"
        animate={{ pathLength: [0, 1] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} />
      <motion.path d="M6 24h32a3 3 0 010 6" stroke="#475569" strokeWidth={2.5} strokeLinecap="round"
        animate={{ pathLength: [0, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }} />
      <motion.path d="M10 30h18a3 3 0 000-0" stroke="#475569" strokeWidth={2} strokeLinecap="round" opacity={0.5}
        animate={{ pathLength: [0, 1] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.6 }} />
    </svg>
  );
}

/* ─── FOG ─── */
export function FogIcon({ size = 48, className }: WeatherIconProps) {
  const lines = [
    { y: 16, w: 28, d: 0 }, { y: 22, w: 32, d: 0.5 },
    { y: 28, w: 24, d: 1.0 }, { y: 34, w: 30, d: 1.5 },
  ];
  return (
    <svg viewBox="0 0 48 48" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      {lines.map((l) => (
        <motion.line key={l.y} x1={24 - l.w / 2} y1={l.y} x2={24 + l.w / 2} y2={l.y}
          stroke="#475569" strokeWidth={3} strokeLinecap="round"
          animate={{ opacity: [0.3, 0.8, 0.3], x: [0, 3, 0] }}
          transition={{ duration: 3, repeat: Infinity, delay: l.d, ease: "easeInOut" }} />
      ))}
    </svg>
  );
}

/* ─── PARTLY CLOUDY ─── */
export function PartlyCloudyIcon({ size = 48, className }: WeatherIconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <motion.g animate={{ rotate: 360 }} transition={{ duration: 20, ease: "linear", repeat: Infinity }}
        style={{ transformOrigin: "16px 16px" }}>
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <line key={deg} x1="16" y1="6" x2="16" y2="9" stroke="#D97706" strokeWidth={1.5} strokeLinecap="round"
            style={{ transformOrigin: "16px 16px", rotate: `${deg}deg` }} />
        ))}
      </motion.g>
      <circle cx="16" cy="16" r="6" stroke="#B45309" strokeWidth={1.5} fill="#FBBF24" fillOpacity={0.35} />
      <motion.g animate={{ x: [0, 1.5, 0, -1.5, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
        <path d="M38 36H18a7 7 0 01-.5-14A9 9 0 0136 24a6 6 0 012 12z" fill="#E2E8F0" opacity={0.4} />
        <path d="M38 36H18a7 7 0 01-.5-14A9 9 0 0136 24a6 6 0 012 12z" stroke="#475569" strokeWidth={2.5} strokeLinecap="round" />
      </motion.g>
    </svg>
  );
}

/* ─── SUNRISE ─── */
export function SunriseIcon({ size = 48, className }: WeatherIconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <line x1="6" y1="34" x2="42" y2="34" stroke="#475569" strokeWidth={2} strokeLinecap="round" />
      <motion.g animate={{ y: [4, 0] }} transition={{ duration: 3, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}>
        <path d="M12 34a12 12 0 0124 0" fill="#FBBF24" opacity={0.35} />
        <path d="M12 34a12 12 0 0124 0" stroke="#D97706" strokeWidth={2} strokeLinecap="round" />
        {[0, 30, 60, 90, 120, 150, 180].map((deg) => (
          <line key={deg} x1="24" y1="14" x2="24" y2="17" stroke="#D97706" strokeWidth={1.5} strokeLinecap="round"
            style={{ transformOrigin: "24px 34px", rotate: `${deg - 90}deg` }} />
        ))}
      </motion.g>
      <motion.path d="M24 42V36" stroke="#D97706" strokeWidth={2} strokeLinecap="round"
        animate={{ y: [2, -2, 2] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} />
      <motion.path d="M20 38l4-4 4 4" stroke="#D97706" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        animate={{ y: [2, -2, 2] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} />
    </svg>
  );
}

/* ─── RAINBOW ─── */
export function RainbowIcon({ size = 48, className }: WeatherIconProps) {
  const arcs = [
    { r: 16, color: "#EF4444", d: 0 },
    { r: 13, color: "#F59E0B", d: 0.1 },
    { r: 10, color: "#22C55E", d: 0.2 },
    { r: 7, color: "#3B82F6", d: 0.3 },
  ];
  return (
    <svg viewBox="0 0 48 48" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      {arcs.map((arc) => (
        <motion.path key={arc.r}
          d={`M${24 - arc.r} 34a${arc.r} ${arc.r} 0 01${arc.r * 2} 0`}
          stroke={arc.color} strokeWidth={2} strokeLinecap="round" fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.7 }}
          transition={{ duration: 1.5, delay: arc.d, repeat: Infinity, repeatType: "reverse", repeatDelay: 1 }} />
      ))}
    </svg>
  );
}
