'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight, Zap } from 'lucide-react';
import { motion, useScroll, useSpring } from 'framer-motion';

export default function LandingPage() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  return (
    <div id="landing-container" className="relative min-h-screen flex flex-col justify-between overflow-x-hidden bg-transparent">
      
      {/* Scroll Progress Bar */}
      <motion.div 
        id="scroll-progress" 
        className="fixed top-0 left-0 right-0 h-1.5 bg-neoPink z-50 shadow-[0_1px_5px_rgba(236,72,153,0.5)]"
        style={{ scaleX, transformOrigin: '0%' }}
      />

      {/* Header Neobrutalisme */}
      <header className="fixed top-0 left-0 right-0 z-40 px-3 sm:px-6 py-3 sm:py-4">
        <motion.nav 
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="header-nav max-w-7xl mx-auto bg-white border-3 border-black rounded-2xl px-3 sm:px-6 py-2.5 sm:py-4 flex items-center justify-between shadow-neo"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            {/* High-Fidelity Brand Wave SVG Logo */}
            <svg width="36" height="28" viewBox="0 0 50 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 select-none sm:w-[44px] sm:h-[34px]">
              <path d="M4 24C12 12 20 34 28 22C31 17 35 14 38 18" stroke="var(--neo-mint)" strokeWidth="3" strokeLinecap="round" />
              <path d="M6 20C14 8 22 30 30 18C33 13 37 10 40 14" stroke="var(--neo-blue)" strokeWidth="4.5" strokeLinecap="round" />
              <circle cx="41" cy="9" r="4.5" fill="var(--neo-pink)" />
              <circle cx="44" cy="16" r="3" fill="var(--neo-violet)" />
              <circle cx="37" cy="6" r="2.5" fill="var(--neo-blue)" />
            </svg>
            <span className="font-heading text-lg sm:text-2xl font-black tracking-tight text-black">
              Motion
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-extrabold text-black">
            <a href="#cta-section" className="hover:underline decoration-neoPink decoration-3">Mulai</a>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/auth/login" className="text-xs sm:text-sm font-black text-black hover:underline decoration-neoPink decoration-3">
              Masuk
            </Link>
            <motion.div whileHover={{ scale: 1.03, rotate: -1 }} whileTap={{ scale: 0.97 }}>
              <Link 
                href="/auth/signup" 
                className="neo-btn bg-neoPink text-black px-3.5 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold shadow-neo-sm block"
              >
                Mulai
              </Link>
            </motion.div>
          </div>
        </motion.nav>
      </header>

      {/* BABAK 1: Intro Climax (Hero Section) */}
      <main className="flex-grow pt-28 sm:pt-36 pb-20 px-4 sm:px-6 max-w-7xl mx-auto w-full flex flex-col items-center">
        <div className="text-center max-w-3xl mt-4 sm:mt-8 flex flex-col items-center">
          
          {/* Lencana Keren Neobrutalist */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="hero-badge inline-flex items-center gap-2 bg-neoMint border-2 border-black rounded-lg px-4 py-1.5 text-xxs sm:text-xs font-black text-black mb-6 sm:mb-8 shadow-neo transform rotate-1"
          >
            <Sparkles className="w-4 h-4" />
            <span>PENJADWALAN AUTOMATIC AI 2.0 KINI HADIR</span>
          </motion.div>

          <div className="relative w-full max-w-lg md:max-w-3xl flex justify-center">
            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              id="hero-title" 
              className="text-3xl sm:text-5xl md:text-7xl font-black tracking-tight mb-6 sm:mb-8 leading-none text-black w-full text-center"
            >
              Hari Anda,<br />
              <span className="bg-neoYellow border-2 sm:border-3 border-black shadow-neo px-3 sm:px-4 py-1 sm:py-2 rotate-[-2deg] inline-block mt-3 mb-3">
                direncanakan otomatis
              </span><br />oleh AI
            </motion.h1>
          </div>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="hero-desc text-sm sm:text-base md:text-lg text-black font-bold border-3 border-black bg-white p-4 sm:p-5 rounded-2xl shadow-neo max-w-2xl mt-4 mb-8 sm:mb-10 leading-relaxed text-left"
          >
            ⚡ <strong>Motion</strong> adalah asisten kalender cerdas yang menata tugas harian Anda ke dalam slot terbaik, menyelaraskan pertemuan eksternal, dan menjaga waktu fokus kerja tanpa bentrokan jadwal.
          </motion.p>
        </div>
      </main>

      {/* BABAK 5: Climax CTA Section */}
      <section id="cta-section" className="w-full border-t-3 border-black bg-neoCream py-24 px-4 sm:px-6 relative z-30">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          
          <div className="inline-flex items-center gap-2 bg-neoPink border-2 border-black rounded-lg px-4 py-1.5 text-xs font-black text-black mb-8 shadow-neo transform rotate-1">
            <Zap className="w-4.5 h-4.5" />
            <span>MULAI BEBAS STRES HARI INI</span>
          </div>

          <h2 id="cta-scramble-title" className="text-3xl sm:text-5xl md:text-6xl font-black text-black mb-8 leading-tight w-full text-center">
            SIAP MERAPIKAN HARI ANDA?
          </h2>

          <p className="text-sm sm:text-base md:text-lg text-black font-bold border-3 border-black bg-white p-5 rounded-2xl shadow-neo max-w-xl mb-12 leading-relaxed text-left">
            Bergabunglah sekarang dan rasakan kemudahan mengelola agenda kerja dengan bantuan asisten kalender cerdas otomatis. Nikmati uji coba gratis 14 hari tanpa kartu kredit!
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-5 w-full sm:w-auto">
            <Link 
              href="/auth/signup" 
              className="spring-hover-btn neo-btn bg-neoOrange text-white w-full sm:w-auto px-8 py-4 text-base font-extrabold shadow-neo hover:translate-x-[2px] hover:translate-y-[2px]"
            >
              Mulai Uji Coba Gratis <ArrowRight className="w-4.5 h-4.5 ml-1.5" />
            </Link>
            <Link 
              href="/auth/login" 
              className="spring-hover-btn neo-btn bg-white text-black w-full sm:w-auto px-8 py-4 text-base font-bold shadow-neo hover:translate-x-[2px] hover:translate-y-[2px]"
            >
              Masuk ke Akun
            </Link>
          </div>

        </div>
      </section>

      {/* Footer Neobrutalisme */}
      <footer className="w-full border-t-3 border-black py-12 px-6 bg-white shadow-[0_-4px_0_0_#000] relative z-30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2.5">
            {/* Small Footer Brand Wave SVG Logo */}
            <svg width="28" height="22" viewBox="0 0 50 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 select-none">
              <path d="M4 24C12 12 20 34 28 22C31 17 35 14 38 18" stroke="var(--neo-mint)" strokeWidth="3" strokeLinecap="round" />
              <path d="M6 20C14 8 22 30 30 18C33 13 37 10 40 14" stroke="var(--neo-blue)" strokeWidth="4.5" strokeLinecap="round" />
              <circle cx="41" cy="9" r="4.5" fill="var(--neo-pink)" />
              <circle cx="44" cy="16" r="3" fill="var(--neo-violet)" />
              <circle cx="37" cy="6" r="2.5" fill="var(--neo-blue)" />
            </svg>
            <span className="font-heading text-base font-black text-black">
              Motion Inc.
            </span>
          </div>

          <p className="text-xs font-bold text-black">
            &copy; {new Date().getFullYear()} Motion AI. Dibuat dengan presisi untuk produktivitas optimal Anda.
          </p>

          <div className="flex gap-6 text-xs font-bold text-black">
            <a href="#" className="hover:underline">Kebijakan Privasi</a>
            <a href="#" className="hover:underline">Ketentuan Layanan</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
