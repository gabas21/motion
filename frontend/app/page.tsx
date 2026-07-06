// @ts-nocheck
'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Sparkles, Calendar, Clock, ArrowRight, Zap, CheckCircle, AlertTriangle } from 'lucide-react';
import { MotiClock, KofiMug, ZappyBolt, StarrySparkle, CloudyCalm } from '../components/Landing/Mascots';
import { animate, createTimeline, stagger, splitText, scrambleText, spring, onScroll } from 'animejs';

export default function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Text Splitting & Entrance Hero Timeline
    const titleSplit = splitText('#hero-title', {
      words: true,
      chars: true,
    });

    const entryTimeline = createTimeline({
      autoplay: true,
    });

    entryTimeline
      .add('.header-nav', { 
        opacity: [0, 1], 
        translateY: [-30, 0], 
        duration: 800, 
        ease: 'outQuad' 
      })
      .add('.hero-badge', { 
        opacity: [0, 1], 
        scale: [0.5, 1], 
        duration: 700, 
        ease: spring({ stiffness: 100, damping: 10 }) 
      }, '-=600')
      .add('#hero-title', {
        opacity: 1,
        duration: 1
      }, '-=600')
      .add(titleSplit.chars, { 
        opacity: [0, 1], 
        translateY: [40, 0], 
        rotate: [-12, 0], 
        delay: stagger(25), 
        duration: 800, 
        ease: 'outQuad' 
      }, '-=600')
      .add('.hero-desc', { 
        opacity: [0, 1], 
        translateY: [25, 0], 
        duration: 650, 
        ease: 'outQuad' 
      }, '-=650')
      .add('.hero-btn', { 
        opacity: [0, 1], 
        scale: [0.9, 1], 
        delay: stagger(100), 
        duration: 600, 
        ease: spring({ stiffness: 120, damping: 10 }) 
      }, '-=550')
      .add('.mascot-wrapper', { 
        opacity: [0, 1], 
        scale: [0, 1], 
        delay: stagger(150), 
        duration: 900, 
        ease: spring({ stiffness: 80, damping: 8 }) 
      }, '-=700');

    // 2. Global Scroll Progress Bar
    const progressAnim = animate('#scroll-progress', {
      width: ['0%', '100%'],
      autoplay: false,
    });

    onScroll({
      target: '#landing-container',
      enter: 'top top',
      leave: 'bottom bottom',
      sync: true,
    }).link(progressAnim);

    // 3. Parallax Mascot Sticker Movements based on Page Scroll
    const sparkleAnim = animate('#mascot-sparkle', { translateY: [0, -180], rotate: [0, 60], ease: 'linear', autoplay: false });
    const kofiAnim = animate('#mascot-kofi', { translateY: [0, -120], rotate: [0, -45], ease: 'linear', autoplay: false });
    const zappyAnim = animate('#mascot-zappy', { translateY: [0, -250], rotate: [0, 120], ease: 'linear', autoplay: false });
    const cloudyAnim = animate('#mascot-cloudy', { translateY: [0, -150], rotate: [0, -80], ease: 'linear', autoplay: false });

    onScroll({
      target: '#landing-container',
      enter: 'top top',
      leave: 'bottom bottom',
      sync: 0.15,
    })
      .link(sparkleAnim)
      .link(kofiAnim)
      .link(zappyAnim)
      .link(cloudyAnim);

    // 4. Chaos-to-Order Interactive Storytelling Scroll Trigger (Sticky Track)
    const card1Translate = animate('#chaos-card-1', {
      translateX: ['-35px', '75px'],
      translateY: ['-20px', '25px'],
      rotate: [8, 0],
      scale: [0.95, 1],
      ease: 'linear',
      autoplay: false,
    });

    const card2Translate = animate('#chaos-card-2', {
      translateX: ['45px', '75px'],
      translateY: ['15px', '115px'],
      rotate: [-10, 0],
      scale: [0.95, 1],
      ease: 'linear',
      autoplay: false,
    });

    const card3Translate = animate('#chaos-card-3', {
      translateX: ['-25px', '75px'],
      translateY: ['60px', '205px'],
      rotate: [6, 0],
      scale: [0.95, 1],
      ease: 'linear',
      autoplay: false,
    });

    const chaosHeading = animate('#chaos-heading-wrap', {
      opacity: [1, 0],
      translateY: [0, -30],
      ease: 'linear',
      autoplay: false,
    });

    const neatHeading = animate('#neat-heading-wrap', {
      opacity: [0, 1],
      translateY: [30, 0],
      ease: 'linear',
      autoplay: false,
    });

    const boardFrame = animate('#calendar-board-frame', {
      borderColor: ['#1D2A44', '#0E86D4'],
      boxShadow: ['4px 4px 0px 0px #1D2A44', '8px 8px 0px 0px #0E86D4'],
      ease: 'linear',
      autoplay: false,
    });

    const statusBadge = animate('#neat-status-badge', {
      opacity: [0, 1],
      scale: [0.7, 1],
      ease: 'linear',
      autoplay: false,
    });

    onScroll({
      target: '#story-track',
      enter: 'top top',
      leave: 'bottom bottom',
      sync: 0.1,
    })
      .link(card1Translate)
      .link(card2Translate)
      .link(card3Translate)
      .link(chaosHeading)
      .link(neatHeading)
      .link(boardFrame)
      .link(statusBadge);

    // 5. Staggered Feature Cards Entrance Trigger
    const cardsReveal = animate('.feature-card', {
      opacity: [0, 1],
      translateY: [60, 0],
      rotate: [5, 0],
      autoplay: false,
      delay: stagger(120),
    });

    onScroll({
      target: '#features-section',
      enter: 'top bottom',
      leave: 'center center',
      sync: 0.1,
    }).link(cardsReveal);

    // 6. Climax CTA Scramble Trigger
    let isScrambled = false;
    onScroll({
      target: '#cta-section',
      enter: 'top bottom',
      leave: 'center center',
      onUpdate: (self) => {
        if (self.progress > 0.1 && !isScrambled) {
          isScrambled = true;
          animate('#cta-scramble-title', {
            innerHTML: scrambleText({
              text: 'SIAP MERAPIKAN HARI ANDA?',
              chars: '01X!#$*MOTION',
              duration: 1200,
              settleDuration: 300,
            }),
            duration: 1500,
            ease: 'linear',
          });
        } else if (self.progress < 0.05 && isScrambled) {
          isScrambled = false;
        }
      }
    });

    // 7. Interactive Hover Springs for Buttons & Cards (Tactile Spring Physics)
    const initSpringHover = (selector: string, scaleTo = 1.05, rotateTo = 1) => {
      const els = document.querySelectorAll(selector);
      els.forEach((el) => {
        el.addEventListener('mouseenter', () => {
          animate(el, {
            scale: scaleTo,
            rotate: rotateTo,
            duration: 600,
            ease: spring({ stiffness: 150, damping: 8 }),
          });
        });
        el.addEventListener('mouseleave', () => {
          animate(el, {
            scale: 1,
            rotate: 0,
            duration: 500,
            ease: spring({ stiffness: 100, damping: 10 }),
          });
        });
      });
    };

    initSpringHover('.spring-hover-btn', 1.03, -1);
    initSpringHover('.spring-hover-card', 1.02, 1);

    return () => {
      titleSplit.revert();
    };
  }, []);

  return (
    <div ref={containerRef} id="landing-container" className="relative min-h-screen flex flex-col justify-between overflow-x-hidden bg-transparent">
      
      {/* Scroll Progress Bar */}
      <div 
        id="scroll-progress" 
        className="scroll-progress-bar fixed top-0 left-0 h-1.5 bg-neoPink z-50 shadow-[0_1px_5px_rgba(236,72,153,0.5)]"
      ></div>

      {/* Floating Mascot Stickers (Managed via Anime.js Scroll Parallax) */}
      <div id="mascot-sparkle" className="mascot-wrapper hidden lg:block absolute top-48 left-12 z-20">
        <StarrySparkle size={70} speechBubble="Let's Optimize!" bubblePosition="right" />
      </div>
      <div id="mascot-kofi" className="mascot-wrapper hidden lg:block absolute top-[520px] right-12 z-20">
        <KofiMug size={85} speechBubble="Fokus yuk! ☕" bubblePosition="left" />
      </div>
      <div id="mascot-zappy" className="mascot-wrapper hidden lg:block absolute bottom-[600px] left-14 z-20">
        <ZappyBolt size={75} speechBubble="Fast & Auto! ⚡" bubblePosition="right" />
      </div>
      <div id="mascot-cloudy" className="mascot-wrapper hidden xl:block absolute bottom-[250px] right-20 z-20">
        <CloudyCalm size={80} speechBubble="Time to relax..." bubblePosition="left" />
      </div>

      {/* Header Neobrutalisme */}
      <header className="fixed top-0 left-0 right-0 z-40 px-3 sm:px-6 py-3 sm:py-4">
        <nav className="header-nav max-w-7xl mx-auto bg-white border-3 border-black rounded-2xl px-3 sm:px-6 py-2.5 sm:py-4 flex items-center justify-between shadow-neo opacity-0">
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
            <a href="#fitur-story" className="hover:underline decoration-neoOrange decoration-3">Alur Kerja</a>
            <a href="#features-section" className="hover:underline decoration-neoMint decoration-3">Fitur Utama</a>
            <a href="#cta-section" className="hover:underline decoration-neoPink decoration-3">Mulai</a>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/auth/login" className="text-xs sm:text-sm font-black text-black hover:underline decoration-neoPink decoration-3">
              Masuk
            </Link>
            <Link 
              href="/auth/signup" 
              className="spring-hover-btn neo-btn bg-neoPink text-black px-3.5 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold shadow-neo-sm"
            >
              Mulai
            </Link>
          </div>
        </nav>
      </header>

      {/* BABAK 1: Intro Climax (Hero Section) */}
      <main className="flex-grow pt-28 sm:pt-36 pb-20 px-4 sm:px-6 max-w-7xl mx-auto w-full flex flex-col items-center">
        <div className="text-center max-w-3xl mt-4 sm:mt-8 flex flex-col items-center">
          
          {/* Lencana Keren Neobrutalist */}
          <div className="hero-badge inline-flex items-center gap-2 bg-neoMint border-2 border-black rounded-lg px-4 py-1.5 text-xxs sm:text-xs font-black text-black mb-6 sm:mb-8 shadow-neo transform rotate-1 opacity-0">
            <Sparkles className="w-4 h-4" />
            <span>PENJADWALAN AUTOMATIC AI 2.0 KINI HADIR</span>
          </div>

          <div className="relative w-full max-w-lg md:max-w-3xl flex justify-center">
            {/* Mascot next to main title */}
            <div className="hidden md:block absolute -top-16 -right-12 md:-right-20 z-10 animate-wiggle-delayed">
              <MotiClock size={95} speechBubble="Ayo mulai! ⏰" bubblePosition="top" />
            </div>

            <h1 id="hero-title" className="text-3xl sm:text-5xl md:text-7xl font-black tracking-tight mb-6 sm:mb-8 leading-none text-black w-full text-center opacity-0">
              Hari Anda,<br />
              <span className="bg-neoYellow border-2 sm:border-3 border-black shadow-neo px-3 sm:px-4 py-1 sm:py-2 rotate-[-2deg] inline-block mt-3 mb-3">
                direncanakan otomatis
              </span><br />oleh AI
            </h1>
          </div>

          <p className="hero-desc text-sm sm:text-base md:text-lg text-black font-bold border-3 border-black bg-white p-4 sm:p-5 rounded-2xl shadow-neo max-w-2xl mt-4 mb-8 sm:mb-10 leading-relaxed text-left opacity-0">
            ⚡ <strong>Motion</strong> adalah asisten kalender cerdas yang menata tugas harian Anda ke dalam slot terbaik, menyelaraskan pertemuan eksternal, dan menjaga waktu fokus kerja tanpa bentrokan jadwal.
          </p>

          <div className="hero-btn flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-5 w-full sm:w-auto mb-12 sm:mb-16 opacity-0">
            <Link 
              href="/auth/signup" 
              className="spring-hover-btn neo-btn bg-neoOrange text-white w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4.5 text-sm sm:text-base font-extrabold shadow-neo"
            >
              Mulai Uji Coba Gratis <ArrowRight className="w-4.5 h-4.5 ml-1.5" />
            </Link>
            <a 
              href="#fitur-story" 
              className="spring-hover-btn neo-btn bg-white text-black w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4.5 text-sm sm:text-base font-bold shadow-neo"
            >
              Lihat Cara Kerjanya
            </a>
          </div>
        </div>
      </main>

      {/* BABAK 2 & 3: Interactive Chaos-to-Order Story Section */}
      <section id="fitur-story" className="w-full border-t-3 border-black bg-transparent">
        <div id="story-track" className="relative h-[200vh] w-full">
          <div className="sticky top-0 h-screen w-full flex flex-col md:flex-row items-center justify-center overflow-hidden px-4 sm:px-8 md:px-16 gap-10">
            
            {/* Panel Kiri: Narrative Narasi (Berubah status seiring scroll) */}
            <div className="w-full md:w-1/2 flex flex-col justify-center text-left relative h-[25vh] md:h-auto">
              
              {/* Chaos Title Block */}
              <div id="chaos-heading-wrap" className="absolute top-0 left-0 w-full flex flex-col pointer-events-none">
                <span className="neo-badge bg-neoPink text-xs px-3 py-1 mb-4 w-fit transform -rotate-1">
                  SEBELUM MENGGUNAKAN MOTION
                </span>
                <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-black leading-tight mb-4">
                  Kalender Lama Anda Adalah <br />
                  <span className="bg-neoPink text-white border-2 border-black px-2 shadow-neo-sm inline-block rotate-1 mt-1.5">
                    Kekacauan Murni.
                  </span>
                </h2>
                <p className="text-sm sm:text-base text-black/80 font-bold max-w-md">
                  Rapat eksternal bertabrakan, waktu fokus kerja terpecah-pecah, dan tugas penting terlewatkan. Kalender biasa tidak peduli tentang kapasitas mental Anda.
                </p>
              </div>

              {/* Neat Title Block */}
              <div id="neat-heading-wrap" className="absolute top-0 left-0 w-full flex flex-col opacity-0 pointer-events-none">
                <span className="neo-badge bg-neoMint text-xs px-3 py-1 mb-4 w-fit transform rotate-1">
                  SETELAH MOTION AI BEKERJA
                </span>
                <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-black leading-tight mb-4">
                  AI Merombak Jadwal <br />
                  <span className="bg-neoMint text-black border-2 border-black px-2 shadow-neo-sm inline-block -rotate-1 mt-1.5">
                    Secara Otomatis!
                  </span>
                </h2>
                <p className="text-sm sm:text-base text-black/80 font-bold max-w-md">
                  Semua tugas ditata rapi dalam slot kosong yang tepat. Jika ada rapat baru masuk, AI langsung menyusun ulang jadwal Anda secara instan tanpa stres.
                </p>
              </div>

            </div>

            {/* Panel Kanan: Interactive Calendar Visualization */}
            <div className="w-full md:w-1/2 flex items-center justify-center relative">
              
              {/* Calendar Board Container Frame */}
              <div 
                id="calendar-board-frame" 
                className="w-full max-w-[450px] aspect-[4/5] bg-white border-3 border-black rounded-3xl p-5 md:p-7 relative shadow-neo"
              >
                {/* Header Frame Browser */}
                <div className="flex items-center justify-between mb-6 border-b-2 border-black pb-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded-full bg-neoOrange border-2 border-black"></div>
                    <div className="w-3.5 h-3.5 rounded-full bg-neoYellow border-2 border-black"></div>
                    <div className="w-3.5 h-3.5 rounded-full bg-neoMint border-2 border-black"></div>
                  </div>
                  
                  {/* Status Badge AI */}
                  <div 
                    id="neat-status-badge" 
                    className="opacity-0 flex items-center gap-1.5 px-3 py-1 bg-neoMint border-2 border-black rounded-lg text-xxs font-black text-black shadow-neo-sm scale-70 animate-pulse"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-black shrink-0" />
                    <span>AI OPTIMIZED</span>
                  </div>
                </div>

                {/* Vertical Timeline Axis Indicator */}
                <div className="absolute top-20 bottom-10 left-10 w-0.5 border-l-2 border-dashed border-black/40 z-0"></div>

                {/* Timeline Hours Grid Labels */}
                <div className="flex flex-col justify-between h-[80%] absolute top-20 left-4 z-10 text-[10px] font-mono font-bold text-black/60">
                  <div>09:00 AM</div>
                  <div>11:00 AM</div>
                  <div>01:30 PM</div>
                </div>

                {/* Simulated Floating Task Cards (Animated between chaotic overlap and orderly list) */}
                <div className="relative w-full h-[85%] z-20">
                  
                  {/* Task Card 1 */}
                  <div 
                    id="chaos-card-1" 
                    className="absolute w-[240px] left-0 top-[20%] bg-neoPink border-3 border-black rounded-xl p-3.5 shadow-neo-sm transform translate-x-[-35px] translate-y-[-20px] rotate-[8deg]"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xxs sm:text-xs font-black text-black">Blok Fokus Pagi</span>
                      <AlertTriangle className="w-3.5 h-3.5 text-black shrink-0" />
                    </div>
                    <p className="text-[10px] font-bold text-black/85">Terpotong oleh rapat internal</p>
                  </div>

                  {/* Task Card 2 */}
                  <div 
                    id="chaos-card-2" 
                    className="absolute w-[240px] left-0 top-[35%] bg-neoOrange border-3 border-black rounded-xl p-3.5 shadow-neo-sm transform translate-x-[45px] translate-y-[15px] rotate-[-10deg]"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xxs sm:text-xs font-black text-black">Rapat Urgent Client</span>
                      <AlertTriangle className="w-3.5 h-3.5 text-black shrink-0" />
                    </div>
                    <p className="text-[10px] font-bold text-black/85">Bentrok dengan waktu coding</p>
                  </div>

                  {/* Task Card 3 */}
                  <div 
                    id="chaos-card-3" 
                    className="absolute w-[240px] left-0 top-[50%] bg-neoYellow border-3 border-black rounded-xl p-3.5 shadow-neo-sm transform translate-x-[-25px] translate-y-[60px] rotate-[6deg]"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xxs sm:text-xs font-black text-black">Review Pitch Deck</span>
                      <CheckCircle className="w-3.5 h-3.5 text-black shrink-0" />
                    </div>
                    <p className="text-[10px] font-bold text-black/85">Tenggat waktu jam 3 sore</p>
                  </div>

                </div>

              </div>

            </div>

          </div>
        </div>
      </section>

      {/* BABAK 4: Detailed Features Section */}
      <section id="features-section" className="w-full border-t-3 border-black bg-white py-24 px-4 sm:px-6 relative z-30 shadow-[0_-4px_0_0_#000]">
        <div className="max-w-7xl mx-auto w-full text-center">
          
          <span className="neo-badge bg-neoYellow text-xs px-3.5 py-1.5 mb-6 transform -rotate-1">
            FITUR UTAMA ASISTEN AI
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-black mb-16 leading-tight">
            Dirancang Cerdas Untuk Produktivitas Anda
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            
            {/* Feature Card 1 */}
            <div className="feature-card spring-hover-card bg-neoMint border-3 border-black rounded-2xl p-6 shadow-neo opacity-0">
              <div className="mb-6 h-16 flex items-center">
                <ZappyBolt size={68} speechBubble="Woohoo!" bubblePosition="right" />
              </div>
              <h3 className="text-xl font-black mb-3 text-black">AI Auto-Scheduling</h3>
              <p className="text-black/80 text-sm font-semibold leading-relaxed">
                Tulis tugas Anda dan biarkan AI menempatkannya di waktu senggang terbaik secara otomatis. Menghitung jeda istirahat dan jam fokus secara dinamis.
              </p>
            </div>

            {/* Feature Card 2 */}
            <div className="feature-card spring-hover-card bg-neoBlue border-3 border-black rounded-2xl p-6 shadow-neo opacity-0">
              <div className="mb-6 h-16 flex items-center">
                <MotiClock size={68} speechBubble="Syncing... 🔄" bubblePosition="right" />
              </div>
              <h3 className="text-xl font-black mb-3 text-black">Real-time Calendar Sync</h3>
              <p className="text-black/80 text-sm font-semibold leading-relaxed">
                Hubungkan Google Calendar Anda secara langsung. AI memantau jadwal pertemuan masuk di luar dan langsung merombak ulang penempatan tugas agar tidak tumpang tindih.
              </p>
            </div>

            {/* Feature Card 3 */}
            <div className="feature-card spring-hover-card bg-neoViolet border-3 border-black rounded-2xl p-6 shadow-neo opacity-0">
              <div className="mb-6 h-16 flex items-center">
                <CloudyCalm size={68} speechBubble="Relax... ☕" bubblePosition="right" />
              </div>
              <h3 className="text-xl font-black mb-3 text-black">Lindungi Jam Kerja</h3>
              <p className="text-black/80 text-sm font-semibold leading-relaxed">
                Kustomisasi jam operasional harian Anda. AI menjamin tidak akan ada penempatan tugas di luar jam produktif Anda demi menjaga kebugaran mental.
              </p>
            </div>

          </div>

        </div>
      </section>

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
