'use client';

import React, { useState } from 'react';
import { HelpCircle, X, Sparkles, BookOpen, GraduationCap, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WeLearnHelpButtonProps {
  onStartTour: () => void;
  onNavigateToSettings?: () => void;
}

export default function WeLearnHelpButton({ onStartTour, onNavigateToSettings }: WeLearnHelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'Bagaimana sinkronisasi otomatis bekerja?',
      a: 'AI Motion memindai tugas Anda secara otomatis di latar belakang setiap 2 jam. Tugas baru, perubahan deadline, atau status penyerahan akan diperbarui secara otomatis.',
    },
    {
      q: 'Apa perbedaan masing-masing badge tugas?',
      a: '• BELUM: Tugas aktif yang harus dikumpulkan.\n• TERKUMPUL: Tugas yang sudah dikirim di LMS.\n• PENGINGAT: Kuis, materi, UTS/UAS, atau pengumuman yang tidak membutuhkan penyerahan file.',
    },
    {
      q: 'Mengapa tugas tidak langsung muncul?',
      a: 'Ada jeda waktu scan latar belakang. Jika ingin pembaruan instan setelah mengedit di LMS, silakan klik tombol "SINKRONKAN SEKARANG" di dasbor WeLearn.',
    },
  ];

  return (
    <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-[9999] pointer-events-auto flex flex-col items-end gap-3 select-none">
      
      {/* Help Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="w-80 sm:w-96 bg-white border-3 border-black rounded-3xl p-5 shadow-[6px_6px_0px_#000] text-left relative overflow-hidden"
          >
            {/* Top accent bar */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-neoBlue border-b-2 border-black" />

            {/* Header */}
            <div className="flex items-center justify-between mb-4 mt-2">
              <h3 className="text-sm font-black text-black tracking-tight flex items-center gap-1.5 uppercase font-mono">
                <GraduationCap size={16} className="text-neoBlue" /> Pusat Bantuan WeLearn
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 border border-black bg-white hover:bg-slate-100 rounded-md transition-colors cursor-pointer text-black"
              >
                <X size={12} strokeWidth={3} />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onStartTour();
                }}
                className="p-3 border-2 border-black rounded-2xl bg-neoYellow text-black hover:bg-yellow-400 active:translate-y-0.5 shadow-[2px_2px_0px_#000] text-center flex flex-col items-center justify-center gap-1 cursor-pointer"
              >
                <Sparkles size={16} className="stroke-[2.5]" />
                <span className="text-[10px] font-black uppercase">Mulai Tour</span>
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  if (onNavigateToSettings) onNavigateToSettings();
                }}
                className="p-3 border-2 border-black rounded-2xl bg-neoMint text-black hover:bg-emerald-400 active:translate-y-0.5 shadow-[2px_2px_0px_#000] text-center flex flex-col items-center justify-center gap-1 cursor-pointer"
              >
                <BookOpen size={16} className="stroke-[2.5]" />
                <span className="text-[10px] font-black uppercase">Setup Moodle</span>
              </button>
            </div>

            {/* FAQ Title */}
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 font-mono">Pertanyaan Sering Diajukan</h4>

            {/* FAQ Accordion */}
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {faqs.map((faq, index) => {
                const isExpanded = expandedFaq === index;
                return (
                  <div key={index} className="border-2 border-black rounded-xl overflow-hidden bg-[#FAF9F5]">
                    <button
                      onClick={() => setExpandedFaq(isExpanded ? null : index)}
                      className="w-full px-3 py-2 text-left flex items-center justify-between gap-2 font-black text-black text-xxs cursor-pointer hover:bg-slate-100/50"
                    >
                      <span>{faq.q}</span>
                      {isExpanded ? <ChevronUp size={12} strokeWidth={3} /> : <ChevronDown size={12} strokeWidth={3} />}
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-2.5 pt-0.5 border-t border-black/10 text-xxs font-bold text-slate-600 leading-relaxed whitespace-pre-line">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 text-center">
              <p className="text-[9px] font-bold text-slate-400">Punya kendala lain? Tanyakan ke Asep AI lewat Chat!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-12 px-4 border-2 border-black rounded-2xl bg-neoBlue text-black hover:bg-blue-400 active:translate-x-[1px] active:translate-y-[1px] active:shadow-neo-sm shadow-[4px_4px_0px_#000] flex items-center justify-center gap-2 cursor-pointer transition-all duration-200"
        title="Butuh Bantuan?"
      >
        <HelpCircle size={18} strokeWidth={3} className="shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider">Butuh Bantuan?</span>
      </button>

    </div>
  );
}
