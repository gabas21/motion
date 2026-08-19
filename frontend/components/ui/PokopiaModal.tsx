'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { X, Sparkles, Trophy, Zap, ShieldAlert, CheckCircle2 } from 'lucide-react';

export interface PokopiaModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  badge?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  theme?: 'pokemon' | 'neo' | 'dark';
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    variant?: 'gold' | 'green' | 'default';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  size?: 'sm' | 'md' | 'lg';
}

// ─── MOTION VARIANTS (POKOPIA GAME UI ANIMATION ENGINE) ───────────────────────

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1, 
    transition: { duration: 0.3, ease: 'easeOut' } 
  },
  exit: { 
    opacity: 0, 
    transition: { duration: 0.2, ease: 'easeIn' } 
  }
};

const modalVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.7,
    y: 40,
    rotateX: 12,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    rotateX: 0,
    transition: {
      type: 'spring',
      stiffness: 380,
      damping: 24,
      mass: 0.9,
      staggerChildren: 0.07,
      delayChildren: 0.1,
    }
  },
  exit: {
    opacity: 0,
    scale: 0.82,
    y: 30,
    rotateX: -10,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 1, 1]
    }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 22
    }
  }
};

const badgeRibbonVariants: Variants = {
  hidden: { scale: 0, rotate: -15 },
  visible: {
    scale: 1,
    rotate: 0,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 18,
      delay: 0.2
    }
  }
};

export default function PokopiaModal({
  isOpen,
  onClose,
  title = 'QUEST VICTORY!',
  subtitle = 'Kamu mendapatkan hadiah pengalaman baru!',
  badge = 'LEVEL UP!',
  icon = <Trophy className="w-8 h-8 text-amber-900" />,
  children,
  theme = 'neo',
  primaryAction,
  secondaryAction,
  size = 'md',
}: PokopiaModalProps) {

  // Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  }[size];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 sm:p-6 overflow-x-hidden overflow-y-auto">
          {/* Backdrop Overlay */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            className="fixed inset-0 bg-black/60 cursor-pointer"
          />

          {/* Modal Container */}
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{ perspective: 1000 }}
            className={`relative w-full ${sizeClasses} z-10`}
          >
            {/* Main Card with Neobrutalism Game Aesthetics */}
            <div className="relative bg-white border-4 border-black rounded-3xl p-6 sm:p-7 shadow-[8px_8px_0px_0px_#000] overflow-hidden">
              
              {/* Decorative Top Game Ribbon Accent */}
              <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 border-b-3 border-black" />

              {/* Top Close Button (Spring Spin on Hover) */}
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.15, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                className="absolute top-4 right-4 w-9 h-9 rounded-2xl bg-slate-100 hover:bg-red-400 hover:text-white border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000] transition-colors cursor-pointer z-20"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 font-black" />
              </motion.button>

              {/* Badge Banner (Pokopia Pop Ribbon) */}
              {badge && (
                <motion.div
                  variants={badgeRibbonVariants}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-amber-400 border-2 border-black rounded-full shadow-[2.5px_2.5px_0px_0px_#000] text-[10px] font-black uppercase tracking-wider text-black mb-3"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-900 animate-spin" style={{ animationDuration: '4s' }} />
                  {badge}
                </motion.div>
              )}

              {/* Header Section */}
              <motion.div variants={itemVariants} className="flex items-start gap-4 mb-4">
                {/* Icon Container with Elastic Floating Bounce */}
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                  className="w-14 h-14 rounded-2xl bg-amber-300 border-3 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000] shrink-0"
                >
                  {icon}
                </motion.div>

                <div className="flex-1 min-w-0 pr-6">
                  <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-black leading-tight">
                    {title}
                  </h2>
                  {subtitle && (
                    <p className="text-xs font-bold text-slate-600 mt-1 leading-snug">
                      {subtitle}
                    </p>
                  )}
                </div>
              </motion.div>

              {/* Modal Body / Slot Content */}
              {children && (
                <motion.div variants={itemVariants} className="my-4 py-2 border-y-2 border-black/10">
                  {children}
                </motion.div>
              )}

              {/* Action Buttons Row */}
              <motion.div variants={itemVariants} className="flex items-center gap-3 pt-2">
                {secondaryAction && (
                  <motion.button
                    onClick={secondaryAction.onClick}
                    whileHover={{ scale: 1.02, x: -1, y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 border-3 border-black text-black rounded-2xl font-black text-xs uppercase tracking-wider shadow-[3px_3px_0px_0px_#000] cursor-pointer transition-colors"
                  >
                    {secondaryAction.label}
                  </motion.button>
                )}

                {primaryAction && (
                  <motion.button
                    onClick={primaryAction.onClick}
                    whileHover={{ scale: 1.03, x: -1, y: -1 }}
                    whileTap={{ scale: 0.95 }}
                    className={`flex-1 py-3 px-4 border-3 border-black text-black rounded-2xl font-black text-xs uppercase tracking-wider shadow-[4px_4px_0px_0px_#000] cursor-pointer flex items-center justify-center gap-2 transition-all ${
                      primaryAction.variant === 'gold'
                        ? 'bg-amber-400 hover:bg-amber-300'
                        : primaryAction.variant === 'green'
                        ? 'bg-emerald-400 hover:bg-emerald-300'
                        : 'bg-indigo-400 hover:bg-indigo-300 text-white'
                    }`}
                  >
                    {primaryAction.icon || <Zap className="w-4 h-4 fill-current" />}
                    {primaryAction.label}
                  </motion.button>
                )}
              </motion.div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
