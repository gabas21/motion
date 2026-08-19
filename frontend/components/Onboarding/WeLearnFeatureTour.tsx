'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight, ArrowLeft, Check, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface TourStep {
  targetId: string; // HTML ID of the element to highlight. If empty, show center modal.
  title: string;
  content: string;
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
  imageUrl?: string; // Optional illustration image to show inside the card
}

interface WeLearnFeatureTourProps {
  isConnected: boolean;
  onClose: () => void;
}

export default function WeLearnFeatureTour({ isConnected, onClose }: WeLearnFeatureTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  
  // Define steps dynamically based on isConnected state
  const steps: TourStep[] = isConnected
    ? [
        {
          targetId: '',
          title: 'Selamat Datang di WeLearn Tab! 🎓',
          content: 'Ini adalah pusat kendali tugas kuliah Anda. Semua tugas dari LMS WeLearn disinkronkan otomatis ke sini untuk Anda kelola dengan mudah.',
          placement: 'center',
          imageUrl: '/tour_welcome.png',
        },
        {
          targetId: 'welearn-tour-sync',
          title: 'Sinkronisasi Latar Belakang Aktif ⚡',
          content: 'Di sini Anda dapat melihat status sinkronisasi terakhir. AI Motion melakukan sinkronisasi latar belakang setiap 2 jam. Klik tombol ini jika ingin sinkronisasi instan secara manual.',
          placement: 'bottom',
        },
        {
          targetId: 'welearn-tour-courses',
          title: 'Daftar Mata Kuliah (Bento Cards) 🧪',
          content: 'Mata kuliah Anda dikelompokkan dalam kartu-kartu cantik. Anda bisa klik kartu untuk melihat detail tugas, atau seret & taruh (drag-and-drop) untuk menyusun prioritas belajar Anda.',
          placement: 'top',
        },
        {
          targetId: 'welearn-tour-assignments-header',
          title: 'Indikator & Badge Status Tugas 🚨',
          content: 'Status tugas dibedakan dengan jelas:\n• BELUM: Tugas belum dikumpulkan.\n• TERKUMPUL: Tugas selesai.\n• PENGINGAT: Informasi/kuis non-tugas.\n• Urgensi warna: Hijau (Selesai), Kuning (Segera), Merah (Terlambat).',
          placement: 'top',
          imageUrl: '/tour_badge_preview.png',
        },
        {
          targetId: 'welearn-tour-asep-btn',
          title: 'Tanya Asep AI 🤖',
          content: 'Butuh bantuan mengerjakan tugas? Klik ikon asisten AI Asep di samping tugas untuk membuka draf solusi, penjelasan materi, atau outline pengerjaan instan.',
          placement: 'left',
        },
        {
          targetId: 'welearn-tour-filters',
          title: 'Pencarian & Penyaringan Pintar 🔍',
          content: 'Cari tugas tertentu berdasarkan nama atau saring berdasarkan status pengerjaan dan mata kuliah tertentu agar lebih fokus.',
          placement: 'bottom',
        },
        {
          targetId: '',
          title: 'Semua Siap! 🚀',
          content: 'Sekarang Anda sudah memahami dasar-dasar WeLearn Tab. Mulailah mengoptimalkan waktu belajar Anda dengan panduan AI Motion!',
          placement: 'center',
          imageUrl: '/tour_complete.png',
        }
      ]
    : [
        {
          targetId: '',
          title: 'Selamat Datang di WeLearn Tab! 🎓',
          content: 'Ini adalah pusat sinkronisasi otomatis tugas kuliah Anda dari LMS WeLearn WICIDA langsung ke dashboard dan kalender belajar Anda.',
          placement: 'center',
        },
        {
          targetId: 'welearn-tour-connect-btn',
          title: 'Hubungkan WeLearn Sekarang ⚙️',
          content: 'Akun Anda saat ini belum terhubung. Klik tombol ini untuk masuk ke halaman pengaturan integrasi, masukkan kredensial WeLearn Anda, dan biarkan AI kami mengurus sisanya!',
          placement: 'bottom',
        },
        {
          targetId: '',
          title: 'Siap Memulai? 🚀',
          content: 'Sangat disarankan untuk menghubungkan WeLearn sekarang untuk membuka potensi penuh dari RAG Auto-Ingestion dan panduan tugas otomatis.',
          placement: 'center',
        }
      ];

  const activeStep = steps[currentStep] || steps[0];

  // Update spotlight element position
  useEffect(() => {
    if (!activeStep.targetId) {
      setSpotlightRect(null);
      return;
    }

    const updateRect = () => {
      const el = document.getElementById(activeStep.targetId);
      if (el) {
        setSpotlightRect(el.getBoundingClientRect());
        // Scroll element into view if not visible
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setSpotlightRect(null);
      }
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect);
    
    // Check again after a small delay for layouts settling
    const timer = setTimeout(updateRect, 500);

    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect);
      clearTimeout(timer);
    };
  }, [currentStep, activeStep.targetId]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('motion_welearn_tour_done', 'true');
    onClose();
  };

  // Popover position calculation helper
  const getPopoverStyle = () => {
    if (!spotlightRect || activeStep.placement === 'center') {
      return {};
    }

    const margin = 16;
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const popoverWidth = Math.min(420, windowWidth - 32);

    let left = spotlightRect.left + spotlightRect.width / 2 - popoverWidth / 2;
    let top = spotlightRect.bottom + margin;

    if (activeStep.placement === 'top') {
      top = spotlightRect.top - margin - 250;
    } else if (activeStep.placement === 'left') {
      left = spotlightRect.left - popoverWidth - margin;
      top = spotlightRect.top + spotlightRect.height / 2 - 100;
    } else if (activeStep.placement === 'right') {
      left = spotlightRect.right + margin;
      top = spotlightRect.top + spotlightRect.height / 2 - 100;
    }

    // Strict boundary checks
    if (left < 16) left = 16;
    if (left + popoverWidth > windowWidth - 16) {
      left = windowWidth - popoverWidth - 16;
    }

    if (top < 16) top = 16;
    if (top > windowHeight - 260) top = windowHeight - 260;

    return {
      top: `${top}px`,
      left: `${left}px`,
      width: `${popoverWidth}px`,
      position: 'fixed' as const,
    };
  };

  if (!mounted) return null;

  const isCentered = !spotlightRect || activeStep.placement === 'center';

  return createPortal(
    <div className="fixed inset-0 z-[99999] overflow-hidden select-none pointer-events-auto">
      {/* SVG Mask Overlay for Spotlight effect */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="spotlight-mask">
            {/* White color lets things through (opaque black mask overlay) */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlightRect && (
              /* Black cut-out hole where user can see the underlying element */
              <rect
                x={spotlightRect.left - 6}
                y={spotlightRect.top - 6}
                width={spotlightRect.width + 12}
                height={spotlightRect.height + 12}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.75)"
          className="backdrop-blur-sm transition-all duration-300"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Interactive spotlight click barrier except on the target itself */}
      <div 
        className="absolute inset-0 z-10" 
        style={{ pointerEvents: spotlightRect ? 'auto' : 'none' }}
        onClick={(e) => {
          // If clicking inside the spotlight rect, let it propagate, otherwise absorb it
          if (spotlightRect) {
            const { clientX, clientY } = e;
            const inside = 
              clientX >= spotlightRect.left - 6 &&
              clientX <= spotlightRect.right + 6 &&
              clientY >= spotlightRect.top - 6 &&
              clientY <= spotlightRect.bottom + 6;
            if (inside) {
              return;
            }
          }
        }}
      />

      {/* Spotlight: Pulse Ring Layer 3 (outermost, slow) */}
      {spotlightRect && (
        <motion.div
          key={`ring3-${currentStep}`}
          initial={{ opacity: 0.5, scale: 1 }}
          animate={{ opacity: 0, scale: 1.45 }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut', delay: 0.6 }}
          style={{
            position: 'absolute',
            top: spotlightRect.top - 8,
            left: spotlightRect.left - 8,
            width: spotlightRect.width + 16,
            height: spotlightRect.height + 16,
            borderRadius: '20px',
            border: '2px solid rgba(255, 222, 77, 0.3)',
            pointerEvents: 'none',
            zIndex: 18,
          }}
        />
      )}

      {/* Spotlight: Pulse Ring Layer 2 (medium) */}
      {spotlightRect && (
        <motion.div
          key={`ring2-${currentStep}`}
          initial={{ opacity: 0.7, scale: 1 }}
          animate={{ opacity: 0, scale: 1.28 }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
          style={{
            position: 'absolute',
            top: spotlightRect.top - 8,
            left: spotlightRect.left - 8,
            width: spotlightRect.width + 16,
            height: spotlightRect.height + 16,
            borderRadius: '18px',
            border: '2px solid rgba(255, 222, 77, 0.5)',
            pointerEvents: 'none',
            zIndex: 19,
          }}
        />
      )}

      {/* Spotlight: Pulse Ring Layer 1 + Main glowing border */}
      {spotlightRect && (
        <motion.div
          key={`ring1-${currentStep}`}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            position: 'absolute',
            top: spotlightRect.top - 8,
            left: spotlightRect.left - 8,
            width: spotlightRect.width + 16,
            height: spotlightRect.height + 16,
            borderRadius: '16px',
            border: '3px solid #FFDE4D',
            boxShadow: '0 0 12px 4px rgba(255, 222, 77, 0.55), 0 0 32px 8px rgba(255, 222, 77, 0.25), inset 0 0 10px rgba(255, 222, 77, 0.1)',
            pointerEvents: 'none',
            zIndex: 20,
          }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        />
      )}

      {/* Tour Card Popover Container */}
      <div className={`fixed inset-0 z-30 pointer-events-none ${isCentered ? 'flex items-center justify-center p-4' : ''}`}>
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 15, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          style={getPopoverStyle()}
          className="w-full max-w-[420px] bg-white border-3 border-black rounded-3xl p-5 md:p-6 shadow-[6px_6px_0px_#000] pointer-events-auto relative overflow-hidden"
        >
          {/* Top Line accent */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-neoYellow border-b-2 border-black" />

          {/* Skip All button */}
          <button
            onClick={handleComplete}
            className="absolute top-3.5 right-3.5 p-1 border border-black bg-white hover:bg-slate-100 rounded-md transition-colors cursor-pointer text-black"
            title="Lewati Semua"
          >
            <X size={12} strokeWidth={3} />
          </button>

          {/* Heading */}
          <div className="mt-2 mb-3">
            <h3 className="text-base font-black text-black tracking-tight flex items-center gap-1.5 uppercase font-mono">
              <Sparkles size={16} className="text-neoYellow shrink-0" />
              {activeStep.title}
            </h3>
          </div>

          {/* Step Illustration Image (if provided) */}
          {activeStep.imageUrl && (
            <div className="mb-3 rounded-2xl overflow-hidden border-2 border-black shadow-[3px_3px_0px_#1D2A44]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeStep.imageUrl}
                alt={activeStep.title}
                className="w-full h-auto object-cover"
                style={{ maxHeight: '150px', objectFit: 'cover', objectPosition: 'center' }}
              />
            </div>
          )}

          {/* Content */}
          <div className="text-xs font-bold text-slate-700 leading-relaxed mb-6 whitespace-pre-line">
            {activeStep.content}
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between border-t-2 border-black pt-4 mt-2">
            {/* Step indicator dots */}
            <div className="flex items-center gap-1">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === currentStep ? 'w-5 bg-neoYellow border border-black' : 'w-2 bg-slate-200 border border-slate-300'
                  }`}
                />
              ))}
            </div>

            {/* Nav buttons */}
            <div className="flex gap-2">
              {currentStep > 0 && (
                <button
                  onClick={handlePrev}
                  className="px-3.5 py-2 border-2 border-black rounded-lg text-xs font-black text-black bg-white hover:bg-slate-100 transition-transform active:translate-y-0.5 shadow-[1.5px_1.5px_0px_#000] cursor-pointer"
                >
                  <ArrowLeft size={12} className="inline mr-1" strokeWidth={3} /> KEMBALI
                </button>
              )}

              <button
                onClick={handleNext}
                className="px-4 py-2 border-2 border-black rounded-lg text-xs font-black text-black bg-neoYellow hover:bg-yellow-400 transition-transform active:translate-y-0.5 shadow-[1.5px_1.5px_0px_#000] cursor-pointer flex items-center gap-1"
              >
                {currentStep === steps.length - 1 ? (
                  <>SELESAI <Check size={12} strokeWidth={3.5} /></>
                ) : (
                  <>LANJUT <ArrowRight size={12} strokeWidth={3} /></>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>,
    document.body
  );
}
