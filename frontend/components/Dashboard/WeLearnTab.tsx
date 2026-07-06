'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw, BookOpen, ExternalLink, Calendar, Clock,
  AlertTriangle, CheckCircle2, FileText, ChevronDown, ChevronRight,
  Wifi, WifiOff, GraduationCap, ClipboardList, Info, Layers,
  BookMarked, HelpCircle, MessageSquare, Search, Filter, Sparkles,
  Edit3, XCircle, FlaskConical
} from 'lucide-react';
import { useMoodle, MoodleCourse, MoodleAssignment } from '../../hooks/useMoodle';
import { useAIChatBridge } from '../../hooks/useAIChatBridge';
import { useAuth } from '../../hooks/useAuth';
import { toast } from '../../hooks/useToast';
import { CircuitBoard, CircuitNodeType, CircuitConnection } from '../ui/circuit-board';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

import EmptyState from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import CustomSelect from '../ui/CustomSelect';
import OnboardingTooltip from '../Onboarding/OnboardingTooltip';
import WeLearnFeatureTour from '../Onboarding/WeLearnFeatureTour';
import WeLearnHelpButton from '../Onboarding/WeLearnHelpButton';

const statusFilterOptions = [
  { value: 'all', label: 'Semua Status' },
  { value: 'pending', label: 'Belum Dikumpulkan' },
  { value: 'overdue', label: 'Terlambat' },
  { value: 'submitted', label: 'Sudah Terkumpul' }
];

/* ─────────────────────────── HELPERS ─────────────────────────── */

function isPraktikum(courseName: string): boolean {
  if (!courseName) return false;
  return courseName.toLowerCase().includes('praktikum');
}

function requiresSubmission(name: string, eventType: string): boolean {
  const isTaskOrQuiz = eventType === 'assign' || eventType === 'quiz';
  if (!isTaskOrQuiz) return false;
  
  const lowerName = name.toLowerCase();
  const isReminderOnly = lowerName.includes('pengantar') || 
                         lowerName.includes('welcome') || 
                         lowerName.includes('silabus') || 
                         lowerName.includes('kontrak') || 
                         lowerName.includes('materi') ||
                         lowerName.includes('modul') ||
                         lowerName.includes('slide') ||
                         lowerName.includes('hadir') ||
                         lowerName.includes('presensi') ||
                         lowerName.includes('kehadiran') ||
                         lowerName.includes('attendance') ||
                         lowerName.includes('meet') ||
                         lowerName.includes('zoom') ||
                         lowerName.includes('link') ||
                         lowerName.includes('ulangan') ||
                         lowerName.includes('uts') ||
                         lowerName.includes('uas') ||
                         lowerName.includes('ujian') ||
                         lowerName.includes('pengumuman') ||
                         lowerName.includes('announcement');
  return !isReminderOnly;
}

function getTimeLeft(dueDateStr: string | null): {
  label: string; urgent: boolean; overdue: boolean; days: number;
} {
  if (!dueDateStr) return { label: 'TANPA DEADLINE', urgent: false, overdue: false, days: 9999 };
  const now = new Date();
  const due = new Date(dueDateStr);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / 86400000);
  if (diffMs < 0) {
    return { label: `LATE ${Math.abs(diffDays)} HARI`, urgent: true, overdue: true, days: diffDays };
  }
  if (diffDays === 0) return { label: 'DEADLINE HARI INI!', urgent: true, overdue: false, days: 0 };
  if (diffDays === 1) return { label: 'BESOK', urgent: true, overdue: false, days: 1 };
  if (diffDays <= 3) return { label: `${diffDays} HARI LAGI`, urgent: true, overdue: false, days: diffDays };
  return { label: `${diffDays} HARI LAGI`, urgent: false, overdue: false, days: diffDays };
}

function formatDate(d: string | null): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function eventIcon(type: string) {
  if (type === 'quiz') return <HelpCircle size={13} className="text-black shrink-0 font-black" />;
  if (type === 'forum') return <MessageSquare size={13} className="text-black shrink-0 font-black" />;
  return <FileText size={13} className="text-black shrink-0 font-black" />;
}

/* ─────────────────────────── BUILD CONTEXT FOR ASEP ─────────────────────────── */

function buildAssignmentContext(a: MoodleAssignment): string {
  const tl = getTimeLeft(a.dueDate);
  const statusText =
    a.submissionStatus === 'submitted'
      ? 'SUDAH DIKUMPULKAN ✓'
      : tl.overdue
      ? `TERLAMBAT ${Math.abs(tl.days)} hari`
      : `BELUM DIKUMPULKAN (${tl.label})`;

  const courseName = a.courseName
    .replace(/^\d{4}\/\d{4}_\d+_\w+_PA_/, '')
    .replace(/_/g, ' ')
    .trim();

  const lines = [
    '📚 [KONTEKS TUGAS WELEARN — Asep harap baca ini dulu sebelum menjawab]',
    `Mata Kuliah  : ${courseName}`,
    `Pertemuan    : ${a.sectionName || '-'}`,
    `Nama Tugas   : ${a.name}`,
    `Deadline     : ${a.dueDate ? formatDate(a.dueDate) : 'Tanpa deadline'}`,
    `Status       : ${statusText}`,
    `Tipe         : ${a.eventType || 'assignment'}`,
    a.url ? `Link WeLearn : ${a.url}` : null,
    '',
    'Tolong bantu aku memahami dan mengerjakan tugas ini secara lengkap. Jelaskan apa yang diminta, langkah-langkah pengerjaannya, dan buatkan jawaban akademik yang bisa langsung aku kerjakan.',
  ].filter(Boolean);

  return lines.join('\n');
}

function StatusBadge({ status, isSubmittable }: { status: string; isSubmittable: boolean }) {
  if (!isSubmittable) {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-black tracking-wider px-2 py-0.5 rounded-md font-mono bg-slate-200 text-black border-2 border-black shadow-[1.5px_1.5px_0px_#1D2A44]">
        <Info size={10} className="stroke-[3]" />
        <span>PENGINGAT</span>
      </span>
    );
  }

  const map: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    submitted: { 
      label: 'TERKUMPUL', 
      color: 'bg-emerald-300 text-black border-2 border-black shadow-[1.5px_1.5px_0px_#1D2A44]',
      icon: <CheckCircle2 size={10} className="stroke-[3]" />
    },
    draft:     { 
      label: 'DRAFT',     
      color: 'bg-amber-300 text-black border-2 border-black shadow-[1.5px_1.5px_0px_#1D2A44]',
      icon: <Edit3 size={10} className="stroke-[3]" />
    },
    new:       { 
      label: 'BELUM',     
      color: 'bg-red-300 text-black border-2 border-black shadow-[1.5px_1.5px_0px_#1D2A44]',
      icon: <XCircle size={10} className="stroke-[3]" />
    },
  };
  const cfg = map[status] || map['new'];
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-black tracking-wider px-2 py-0.5 rounded-md font-mono ${cfg.color}`}>
      {cfg.icon}
      <span>{cfg.label}</span>
    </span>
  );
}

/* ─────────────────────────── AssignmentRow ─────────────────────────── */

function AssignmentRow({ assignment, onAskAsep }: { 
  assignment: MoodleAssignment;
  onAskAsep?: (a: MoodleAssignment) => void;
}) {
  const tl = getTimeLeft(assignment.dueDate);
  const isSubmittable = requiresSubmission(assignment.name, assignment.eventType);
  
  let rowBg = 'bg-white hover:bg-slate-50';
  let borderStyle = 'border-2 border-black';
  let badgeColor = 'bg-neoBlue text-black border border-black shadow-[1.5px_1.5px_0px_#000]';

  if (isSubmittable) {
    if (assignment.submissionStatus === 'submitted') {
      rowBg = 'bg-[#38BDF8]/10 hover:bg-[#38BDF8]/20';
    } else if (tl.overdue) {
      rowBg = 'bg-[#FF7A00]/10 hover:bg-[#FF7A00]/20';
      borderStyle = 'border-2 border-black shadow-[3px_3px_0px_#FF7A00]';
      badgeColor = 'bg-neoOrange text-black border border-black shadow-[1.5px_1.5px_0px_#000]';
    } else if (tl.urgent) {
      rowBg = 'bg-[#FBBF24]/10 hover:bg-[#FBBF24]/20';
      borderStyle = 'border-2 border-black shadow-[3px_3px_0px_#FBBF24]';
      badgeColor = 'bg-neoYellow text-black border border-black shadow-[1.5px_1.5px_0px_#000]';
    }
  }

  const isLab = isPraktikum(assignment.courseName);

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 ${borderStyle} ${rowBg} cursor-grab active:cursor-grabbing group`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', buildAssignmentContext(assignment));
        e.dataTransfer.effectAllowed = 'copy';
        
        const ghost = document.createElement('div');
        ghost.textContent = `📚 ${assignment.name}`;
        ghost.className = 'fixed -top-96 left-0 bg-neoYellow border-2 border-black rounded-lg px-3 py-1.5 text-xs font-black text-black shadow-neo-sm';
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 0, 0);
        setTimeout(() => document.body.removeChild(ghost), 0);
      }}
    >
      <span className="p-1.5 bg-white border border-black rounded-lg shrink-0 scale-90 group-hover:scale-100 transition-transform">
        {eventIcon(assignment.eventType)}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-black text-black truncate leading-tight group-hover:text-neoBlue transition-colors">
          {assignment.name}
        </p>
        {assignment.dueDate && (
          <p className="text-[9px] text-gray-500 mt-0.5 font-mono font-bold flex items-center gap-1">
            <Clock size={9} /> {formatDate(assignment.dueDate)}
          </p>
        )}
      </div>

      <div id="welearn-tour-assignments-header" className="flex items-center gap-1.5 shrink-0 scale-95">
        {isLab && (
          <span className="text-[8px] font-black px-1.5 py-0.5 rounded font-mono bg-[#C084FC] text-black border border-black shadow-[1.5px_1.5px_0px_#000] shrink-0">
            🧪 PRAKTIKUM
          </span>
        )}
        {isSubmittable && assignment.dueDate && assignment.submissionStatus !== 'submitted' && (
          <span
            className={`text-[8px] font-black px-1.5 py-0.5 rounded font-mono ${badgeColor}`}
          >
            {tl.label}
          </span>
        )}
        <StatusBadge status={assignment.submissionStatus} isSubmittable={isSubmittable} />
        {assignment.url && (
          <a
            href={assignment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-xl border border-black bg-white hover:bg-[#FFDE4D] hover:shadow-[1.5px_1.5px_0px_#000] active:translate-y-0.5 transition-all group/link shrink-0"
            title="Buka di WeLearn"
          >
            <ExternalLink size={10} className="text-black font-black group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
          </a>
        )}
        {onAskAsep && (
          <button
            id="welearn-tour-asep-btn"
            type="button"
            onClick={() => onAskAsep(assignment)}
            className="p-1.5 rounded-xl border border-black bg-neoYellow hover:bg-amber-300 hover:shadow-[1.5px_1.5px_0px_#000] active:translate-y-0.5 transition-all shrink-0 group/btn"
            title="Tanya Asep AI tentang tugas ini"
          >
            <Sparkles size={10} className="text-black group-hover/btn:rotate-12 transition-transform" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── CourseCard (Bento Grid Style) ─────────────────────────── */

function CourseCard({
  course,
  assignments,
  isExpanded,
  onToggleExpand,
  onAskAsep,
  isDragging,
  isAnyCardExpanded,
  ...dragProps
}: {
  course: MoodleCourse;
  assignments: MoodleAssignment[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onAskAsep?: (a: MoodleAssignment) => void;
  isDragging?: boolean;
  isAnyCardExpanded?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnter?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}) {
  const pendingCount = assignments.filter((a) => requiresSubmission(a.name, a.eventType) && a.submissionStatus !== 'submitted').length;
  const overdueCount = assignments.filter(
    (a) =>
      requiresSubmission(a.name, a.eventType) &&
      a.submissionStatus !== 'submitted' &&
      a.dueDate &&
      new Date(a.dueDate) < new Date()
  ).length;
  const hasOverdue = overdueCount > 0;

  const urgentCount = assignments.filter((a) => {
    if (!requiresSubmission(a.name, a.eventType) || a.submissionStatus === 'submitted' || !a.dueDate) return false;
    const due = new Date(a.dueDate);
    const diffMs = due.getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / 86400000);
    return diffDays >= 0 && diffDays <= 3;
  }).length;
  const hasUrgent = urgentCount > 0;

  const displayName = course.name
    .replace(/^\d{4}\/\d{4}_\d+_\w+_PA_/, '')
    .trim();

  // Group assignments by section/pertemuan
  const sectionGroups: Record<string, MoodleAssignment[]> = {};
  assignments.forEach((a) => {
    const sec = a.sectionName || 'Lainnya';
    if (!sectionGroups[sec]) sectionGroups[sec] = [];
    sectionGroups[sec].push(a);
  });
  const sections = Object.keys(sectionGroups);

  const submittableAssignments = assignments.filter((a) => requiresSubmission(a.name, a.eventType));
  const completedCount = submittableAssignments.filter((a) => a.submissionStatus === 'submitted').length;
  const completionRate = submittableAssignments.length > 0 ? Math.round((completedCount / submittableAssignments.length) * 100) : 100;

  // Dynamic card colors & borders
  let cardBgClass = 'bg-white';
  let cardShadowClass = 'shadow-[4px_4px_0px_#000] border-black';
  let cardShadowExpandedClass = 'shadow-[5px_5px_0px_#000] border-black';
  let headerBgClass = '';
  let statusBadgeColor = '';
  let statusBadgeLabel = '';

  const isCompleted = assignments.length > 0 && pendingCount === 0;

  if (isCompleted) {
    cardBgClass = 'bg-[#86EFAC]/5';
    cardShadowClass = 'shadow-[4px_4px_0px_#10B981] border-[#10B981]';
    cardShadowExpandedClass = 'shadow-[5px_5px_0px_#10B981] border-[#10B981]';
    headerBgClass = 'bg-neoMint';
    statusBadgeColor = 'bg-emerald-300 text-black border border-black shadow-[1.5px_1.5px_0px_#000]';
    statusBadgeLabel = 'SELESAI';
  } else if (hasOverdue) {
    cardBgClass = 'bg-rose-50/10';
    cardShadowClass = 'shadow-[4px_4px_0px_#FF6B6B] border-[#FF6B6B]';
    cardShadowExpandedClass = 'shadow-[5px_5px_0px_#FF6B6B] border-[#FF6B6B]';
    headerBgClass = 'bg-[#FF6B6B]';
    statusBadgeColor = 'bg-[#FF6B6B] text-black border border-black shadow-[1.5px_1.5px_0px_#000] animate-pulse';
    statusBadgeLabel = `${overdueCount} LATE`;
  } else if (hasUrgent) {
    cardBgClass = 'bg-amber-50/10';
    cardShadowClass = 'shadow-[4px_4px_0px_#FBBF24] border-[#FBBF24]';
    cardShadowExpandedClass = 'shadow-[5px_5px_0px_#FBBF24] border-[#FBBF24]';
    headerBgClass = 'bg-[#FBBF24]';
    statusBadgeColor = 'bg-[#FBBF24] text-black border border-black shadow-[1.5px_1.5px_0px_#000] animate-pulse';
    statusBadgeLabel = `${urgentCount} DEKAT`;
  } else {
    // Default color scheme based on course hash
    const colors = [
      { header: 'bg-neoMint' },
      { header: 'bg-neoYellow' },
      { header: 'bg-neoPink' },
      { header: 'bg-neoViolet' },
      { header: 'bg-neoOrange' },
    ];
    const hash = (course.moodleCourseId || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colorScheme = colors[hash % colors.length];
    headerBgClass = colorScheme.header;

    if (pendingCount > 0) {
      statusBadgeColor = 'bg-neoYellow text-black border border-black shadow-[1.5px_1.5px_0px_#000]';
      statusBadgeLabel = `${pendingCount} AKTIF`;
    } else {
      statusBadgeColor = 'bg-slate-200 text-black border border-black shadow-[1.5px_1.5px_0px_#000]';
      statusBadgeLabel = 'KOSONG';
    }
  }

  // Mouse drag check to avoid expanding card on drop
  const dragStartPos = useRef({ x: 0, y: 0 });
  const handleMouseDown = (e: React.MouseEvent) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUpClick = (e: React.MouseEvent) => {
    const diffX = Math.abs(e.clientX - dragStartPos.current.x);
    const diffY = Math.abs(e.clientY - dragStartPos.current.y);
    if (diffX > 6 || diffY > 6) {
      // User moved mouse, it's a drag. Stop click propagation.
      return;
    }
    onToggleExpand();
  };

  if (!isExpanded) {
    // COMPACT BOX STATE
    return (
      <motion.div
        key="compact"
        layout={isAnyCardExpanded ? undefined : true}
        transition={{ type: "spring", stiffness: 350, damping: 25, mass: 0.8 }}
        onMouseDown={handleMouseDown}
        onClick={handleMouseUpClick}
        className={`course-card-animate neo-3d-card col-span-1 h-[170px] border-3 ${cardShadowClass} ${cardBgClass} rounded-3xl overflow-hidden p-4 flex flex-col justify-between cursor-grab active:cursor-grabbing transition-all duration-200 ${
          isDragging ? 'opacity-35 scale-95 border-dashed border-black/45 shadow-none' : ''
        }`}
        {...(dragProps as any)}
      >
        {/* Absolute Top-Right Handle (Status Badge) */}
        <span className={`status-handle absolute top-0 right-6 text-[8px] font-black font-mono px-3 py-1 rounded-b-xl border-x-2 border-b-2 border-black z-20 ${
          statusBadgeColor.replace(/border|shadow-\[.*\]/g, '')
        }`}>
          {statusBadgeLabel}
        </span>

        <div className="space-y-1.5 min-w-0 relative z-10">
          <div className="flex items-center">
            <span className={`icon-box w-8 h-8 rounded-lg ${headerBgClass} border border-black fill-transparent flex items-center justify-center shadow-[1.5px_1.5px_0px_#000]`}>
              <BookMarked size={14} className="text-black font-black" />
            </span>
          </div>
          
          <div className="min-w-0 pt-1.5">
            <h4 className="course-title font-heading font-black text-black text-[11px] leading-tight line-clamp-2 uppercase transition-transform duration-300" title={displayName}>
              {displayName}
            </h4>
            <p className="text-[8px] text-black/55 font-mono font-bold mt-0.5 truncate">{course.name}</p>
          </div>
        </div>

        {/* Progress Bar & Stat */}
        <div className="progress-section space-y-1.5 shrink-0 relative z-10 transition-transform duration-300">
          <div className="flex items-center justify-between text-[9px] font-bold font-mono text-black/70">
            <span>Progress: {completionRate}%</span>
            <span>{completedCount}/{assignments.length}</span>
          </div>
          <div className="w-full bg-black/10 rounded-full h-1.5 border border-black overflow-hidden">
            <div
              className={`h-full ${isCompleted ? 'bg-emerald-300' : 'bg-neoBlue'}`}
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      </motion.div>
    );
  }

  // EXPANDED WIDE STATE (spans 2 columns, height 380px)
  return (
    <motion.div
      key="expanded"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`course-card-animate col-span-1 sm:col-span-2 row-span-2 flex flex-col h-[380px] border-3 ${cardShadowExpandedClass} ${cardBgClass} rounded-3xl overflow-hidden bg-white transition-all duration-300`}
    >
      {/* Header */}
      <div className={`p-4 border-b-3 border-black ${headerBgClass} flex items-center justify-between shrink-0`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="p-1.5 bg-white border-2 border-black rounded-xl shadow-[1px_1px_0px_#000] scale-90 shrink-0">
            <BookMarked size={16} className="text-black font-black" />
          </span>
          <div className="min-w-0">
            <h4 className="font-heading font-black text-black text-xs leading-tight truncate uppercase" title={displayName}>
              {displayName}
            </h4>
            <p className="text-[9px] text-black/60 font-mono font-bold mt-0.5 truncate">{course.name}</p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className={`text-[8px] font-black font-mono px-1.5 py-0.5 rounded ${statusBadgeColor}`}>
            {statusBadgeLabel}
          </span>
          <button
            onClick={onToggleExpand}
            className="p-1 rounded-lg border-2 border-black bg-white hover:bg-neoOrange hover:shadow-[1.5px_1.5px_0px_#000] active:translate-y-0.5 transition-all text-black font-black cursor-pointer"
            title="Minimize"
          >
            <XCircle size={12} className="stroke-[3]" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-2 border-b-2 border-black/10 bg-[#FAF9F5]/40 flex items-center justify-between text-[10px] font-bold font-mono shrink-0">
        <div className="flex items-center gap-2 w-3/4">
          <div className="w-full bg-black/10 rounded-full h-2 border border-black overflow-hidden">
            <div
              className={`h-full border-r border-black ${isCompleted ? 'bg-emerald-300' : 'bg-neoBlue'}`}
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <span className="text-black shrink-0">{completionRate}%</span>
        </div>
        <span className="text-black shrink-0">{completedCount}/{assignments.length} SELESAI</span>
      </div>

      {/* Task list inside Course card */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-[#FAF9F5]/10 custom-scrollbar">
        {assignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-6">
            <CheckCircle2 size={32} className="text-emerald-400 mb-1.5 animate-bounce" />
            <p className="font-black text-black text-xs font-heading">SEMUA TUGAS SELESAI</p>
            <p className="text-[10px] text-gray-500 font-bold mt-0.5">Mantap! Tidak ada aktivitas tertunda.</p>
          </div>
        ) : (
          sections.map((sec) => (
            <div key={sec} className="space-y-1.5">
              <div className="flex items-center gap-1.5 pb-1 border-b border-black/5 text-[9px] font-black text-black/60 font-mono uppercase tracking-wider">
                <Layers size={10} className="text-[#C084FC]" />
                <span className="truncate">{sec}</span>
              </div>
              <div className="space-y-2">
                {sectionGroups[sec].map((a) => (
                  <AssignmentRow key={a.id} assignment={a} onAskAsep={onAskAsep} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────── PhysicsCanvas (falling and bouncing particles with elastic collisions) ─────────────────────────── */

function PhysicsCanvas({ count, color }: { count: number; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width || 120;
      canvas.height = rect.height || 100;
    };
    resize();
    window.addEventListener('resize', resize);

    const limit = Math.min(count, 40); // Limit to 40 balls for performance
    
    interface Ball {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      color: string;
      mass: number;
    }

    const balls: Ball[] = [];
    for (let i = 0; i < limit; i++) {
      const radius = Math.max(3.5, Math.min(6, 30 / Math.sqrt(limit || 1)));
      balls.push({
        x: Math.random() * (canvas.width - 20) + 10,
        y: Math.random() * (canvas.height - 20) + 10,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        radius,
        color,
        mass: radius,
      });
    }

    let animationFrameId: number;
    const gravity = 0.12;
    const friction = 0.985;
    const bounce = -0.65;

    let mouse = { x: -1000, y: -1000, radius: 45 };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    const handleClick = () => {
      // Explode upward!
      balls.forEach((ball) => {
        ball.vy = -Math.random() * 4 - 2;
        ball.vx = (Math.random() - 0.5) * 5;
      });
    };

    const parent = canvas.parentElement;
    if (parent) {
      parent.addEventListener('mousemove', handleMouseMove);
      parent.addEventListener('mouseleave', handleMouseLeave);
      parent.addEventListener('click', handleClick);
    }

    const update = () => {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Collisions between balls
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const b1 = balls[i];
          const b2 = balls[j];
          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = b1.radius + b2.radius;

          if (dist < minDist) {
            // Overlap resolution
            const angle = Math.atan2(dy, dx);
            const targetX = b1.x + Math.cos(angle) * minDist;
            const targetY = b1.y + Math.sin(angle) * minDist;
            const ax = (targetX - b2.x) * 0.5;
            const ay = (targetY - b2.y) * 0.5;
            b1.x -= ax;
            b1.y -= ay;
            b2.x += ax;
            b2.y += ay;

            // Elastic collision response
            const nx = dx / dist;
            const ny = dy / dist;
            const kx = b1.vx - b2.vx;
            const ky = b1.vy - b2.vy;
            const p = 2 * (nx * kx + ny * ky) / (b1.mass + b2.mass);
            b1.vx -= p * b2.mass * nx;
            b1.vy -= p * b2.mass * ny;
            b2.vx += p * b1.mass * nx;
            b2.vy += p * b1.mass * ny;
          }
        }
      }

      balls.forEach((ball) => {
        // Physics update
        ball.vy += gravity;
        ball.vx *= friction;
        ball.vy *= friction;

        ball.x += ball.vx;
        ball.y += ball.vy;

        // Mouse repelling force
        const dx = ball.x - mouse.x;
        const dy = ball.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius;
          const angle = Math.atan2(dy, dx);
          // Gently push away from cursor
          ball.vx += Math.cos(angle) * force * 1.2;
          ball.vy += Math.sin(angle) * force * 1.2;
        }

        // Boundary checks
        if (ball.x + ball.radius > canvas.width) {
          ball.x = canvas.width - ball.radius;
          ball.vx *= bounce;
        } else if (ball.x - ball.radius < 0) {
          ball.x = ball.radius;
          ball.vx *= bounce;
        }

        if (ball.y + ball.radius > canvas.height) {
          ball.y = canvas.height - ball.radius;
          ball.vy *= bounce;
        } else if (ball.y - ball.radius < 0) {
          ball.y = ball.radius;
          ball.vy *= bounce;
        }

        // Draw ball
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = ball.color;
        ctx.strokeStyle = '#1D2A44';
        ctx.lineWidth = 1.2;
        ctx.fill();
        ctx.stroke();
      });

      animationFrameId = requestAnimationFrame(update);
    };

    update();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      if (parent) {
        parent.removeEventListener('mousemove', handleMouseMove);
        parent.removeEventListener('mouseleave', handleMouseLeave);
        parent.removeEventListener('click', handleClick);
      }
    };
  }, [count, color]);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />;
}

/* ─────────────────────────── SyncPhysicsCanvas (particles floating on card, attracted to sync icon) ─────────────────────────── */

interface SyncPhysicsCanvasProps {
  isAttracting: boolean;
  targetRef: React.RefObject<HTMLSpanElement | null>;
  color?: string;
  count?: number;
}

function SyncPhysicsCanvas({
  isAttracting,
  targetRef,
  color = '#C084FC',
  count = 30,
}: SyncPhysicsCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      if (!canvas) return;
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };
    resize();

    const resizeObserver = new ResizeObserver(() => {
      resize();
    });
    resizeObserver.observe(canvas);

    interface Ball {
      x: number;
      y: number;
      vx: number;
      vy: number;
      initialRadius: number;
      radius: number;
      color: string;
      mass: number;
    }

    const balls: Ball[] = [];
    for (let i = 0; i < count; i++) {
      const radius = Math.random() * 2 + 2; // size 2 to 4 px
      balls.push({
        x: Math.random() * (canvas.clientWidth - 20) + 10,
        y: Math.random() * (canvas.clientHeight - 20) + 10,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        initialRadius: radius,
        radius,
        color,
        mass: radius,
      });
    }

    let animationFrameId: number;
    const friction = 0.992;

    let mouse = { x: -1000, y: -1000, radius: 55 };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    const parent = canvas.parentElement;
    if (parent) {
      parent.addEventListener('mousemove', handleMouseMove);
      parent.addEventListener('mouseleave', handleMouseLeave);
    }

    const update = () => {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let targetX: number | null = null;
      let targetY: number | null = null;

      if (isAttracting && targetRef.current) {
        const targetRect = targetRef.current.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        targetX = targetRect.left - canvasRect.left + targetRect.width / 2;
        targetY = targetRect.top - canvasRect.top + targetRect.height / 2;
      }

      // Ball collisions (only in float/idle mode to keep vortex clean)
      if (!isAttracting) {
        for (let i = 0; i < balls.length; i++) {
          for (let j = i + 1; j < balls.length; j++) {
            const b1 = balls[i];
            const b2 = balls[j];
            const dx = b2.x - b1.x;
            const dy = b2.y - b1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = b1.radius + b2.radius;

            if (dist < minDist) {
              const angle = Math.atan2(dy, dx);
              const targetXLoc = b1.x + Math.cos(angle) * minDist;
              const targetYLoc = b1.y + Math.sin(angle) * minDist;
              const ax = (targetXLoc - b2.x) * 0.5;
              const ay = (targetYLoc - b2.y) * 0.5;
              b1.x -= ax;
              b1.y -= ay;
              b2.x += ax;
              b2.y += ay;

              const nx = dx / dist;
              const ny = dy / dist;
              const kx = b1.vx - b2.vx;
              const ky = b1.vy - b2.vy;
              const p = 2 * (nx * kx + ny * ky) / (b1.mass + b2.mass);
              b1.vx -= p * b2.mass * nx;
              b1.vy -= p * b2.mass * ny;
              b2.vx += p * b1.mass * nx;
              b2.vy += p * b1.mass * ny;
            }
          }
        }
      }

      balls.forEach((ball) => {
        if (targetX !== null && targetY !== null) {
          // Magnetize/vortex mode
          const dx = targetX - ball.x;
          const dy = targetY - ball.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 8) {
            const pullForce = Math.min(3.5, 450 / (dist + 40));
            const angle = Math.atan2(dy, dx);

            // Pull towards target
            ball.vx = ball.vx * 0.82 + Math.cos(angle) * pullForce;
            ball.vy = ball.vy * 0.82 + Math.sin(angle) * pullForce;

            // Orbit/vortex effect at close range
            if (dist < 90) {
              const orbitSpeed = 2.2 * (1 - dist / 90);
              ball.vx += -Math.sin(angle) * orbitSpeed;
              ball.vy += Math.cos(angle) * orbitSpeed;
            }

            // Shrink as it gets closer
            const targetR = Math.max(1.0, ball.initialRadius * (dist / 100));
            ball.radius = ball.radius * 0.85 + targetR * 0.15;
          } else {
            // Respawn at random edges to sustain flow
            const edge = Math.floor(Math.random() * 4);
            if (edge === 0) { // top
              ball.x = Math.random() * canvas.width;
              ball.y = -10;
            } else if (edge === 1) { // right
              ball.x = canvas.width + 10;
              ball.y = Math.random() * canvas.height;
            } else if (edge === 2) { // bottom
              ball.x = Math.random() * canvas.width;
              ball.y = canvas.height + 10;
            } else { // left
              ball.x = -10;
              ball.y = Math.random() * canvas.height;
            }
            ball.vx = (Math.random() - 0.5) * 2;
            ball.vy = (Math.random() - 0.5) * 2;
            ball.radius = ball.initialRadius;
          }
        } else {
          // Floating idle mode (Zero gravity, constant floating speed)
          // Ambient wind drift to keep them active
          ball.vx += (Math.random() - 0.5) * 0.05;
          ball.vy += (Math.random() - 0.5) * 0.05;

          // Limit speed (keep it gentle and continuous)
          const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
          const maxSpeed = 1.2;
          const minSpeed = 0.35;
          if (speed > maxSpeed) {
            ball.vx = (ball.vx / speed) * maxSpeed;
            ball.vy = (ball.vy / speed) * maxSpeed;
          } else if (speed < minSpeed) {
            const angle = Math.random() * Math.PI * 2;
            ball.vx = Math.cos(angle) * minSpeed;
            ball.vy = Math.sin(angle) * minSpeed;
          }

          // Restore normal radius
          ball.radius = ball.radius * 0.9 + ball.initialRadius * 0.1;

          // Mouse repelling force
          const mdx = ball.x - mouse.x;
          const mdy = ball.y - mouse.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mdist < mouse.radius) {
            const force = (mouse.radius - mdist) / mouse.radius;
            const angle = Math.atan2(mdy, mdx);
            ball.vx += Math.cos(angle) * force * 1.5;
            ball.vy += Math.sin(angle) * force * 1.5;
          }
        }

        ball.x += ball.vx;
        ball.y += ball.vy;

        // Bounce from walls when idle
        if (targetX === null) {
          if (ball.x + ball.radius > canvas.width) {
            ball.x = canvas.width - ball.radius;
            ball.vx = -Math.abs(ball.vx);
          } else if (ball.x - ball.radius < 0) {
            ball.x = ball.radius;
            ball.vx = Math.abs(ball.vx);
          }

          if (ball.y + ball.radius > canvas.height) {
            ball.y = canvas.height - ball.radius;
            ball.vy = -Math.abs(ball.vy);
          } else if (ball.y - ball.radius < 0) {
            ball.y = ball.radius;
            ball.vy = Math.abs(ball.vy);
          }
        }

        // Render
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = ball.color;
        ctx.strokeStyle = '#1D2A44';
        ctx.lineWidth = 1.0;
        ctx.fill();
        ctx.stroke();
      });

      animationFrameId = requestAnimationFrame(update);
    };

    update();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      if (parent) {
        parent.removeEventListener('mousemove', handleMouseMove);
        parent.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [count, color, isAttracting, targetRef]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />;
}

/* ─────────────────────────── WeLearnTab (main) ─────────────────────────── */

export default function WeLearnTab({
  onNavigateToSettings,
}: {
  onNavigateToSettings?: () => void;
}) {
  const {
    status, assignments, courses, courseAssignments,
    isLoading, isSyncing, error,
    fetchStatus, fetchAssignments, fetchCourses, fetchCourseAssignments,
    syncNow, clearError,
  } = useMoodle();

  const { openWithContext } = useAIChatBridge();
  const { user } = useAuth();

  const handleAskAsep = useCallback((assignment: MoodleAssignment) => {
    const context = buildAssignmentContext(assignment);
    openWithContext(context);
  }, [openWithContext]);

  const [view, setView] = useState<'courses' | 'all'>('courses');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'overdue' | 'submitted'>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [courseCategoryFilter, setCourseCategoryFilter] = useState<'all' | 'praktikum' | 'teori'>('all');
  
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    const isTourDone = localStorage.getItem('motion_welearn_tour_done');
    if (!isTourDone) {
      // Small delay to let the dashboard render nicely first
      const timer = setTimeout(() => {
        setShowTour(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);
  
  // Custom drag & drop course order state
  const [courseOrder, setCourseOrder] = useState<string[]>([]);
  const [draggedCourseId, setDraggedCourseId] = useState<string | null>(null);

  // Load custom course order on mount/fetch
  useEffect(() => {
    if (courses.length > 0) {
      const savedOrder = localStorage.getItem(`course_order_${user?.id || 'default'}`);
      if (savedOrder) {
        try {
          const parsed = JSON.parse(savedOrder) as string[];
          const coursesMap = new Set(courses.map((c) => c.moodleCourseId));
          const cleanOrder = parsed.filter((id) => coursesMap.has(id));
          const cleanOrderSet = new Set(cleanOrder);
          const newIds = courses.map((c) => c.moodleCourseId).filter((id) => !cleanOrderSet.has(id));
          setCourseOrder([...cleanOrder, ...newIds]);
        } catch (e) {
          setCourseOrder(courses.map((c) => c.moodleCourseId));
        }
      } else {
        setCourseOrder(courses.map((c) => c.moodleCourseId));
      }
    }
  }, [courses, user?.id]);

  const courseOrderRef = useRef<string[]>([]);
  const initialOrderRef = useRef<string[]>([]);

  useEffect(() => {
    courseOrderRef.current = courseOrder;
  }, [courseOrder]);

  const handleDragEnter = useCallback((targetCourseId: string, targetCourseName: string) => {
    if (!draggedCourseId || draggedCourseId === targetCourseId) return;

    const draggedCourse = courses.find((c) => c.moodleCourseId === draggedCourseId);
    if (!draggedCourse) return;

    const draggedIsLab = isPraktikum(draggedCourse.name);
    const targetIsLab = isPraktikum(targetCourseName);

    if (draggedIsLab !== targetIsLab) return;

    // Check if both courses have the same completion status
    const isCourseCompleted = (courseId: string) => {
      const cAssigns = assignments.filter((a) => a.courseId === courseId);
      const submittable = cAssigns.filter((a) => requiresSubmission(a.name, a.eventType));
      const pending = submittable.filter((a) => a.submissionStatus !== 'submitted');
      return cAssigns.length > 0 && pending.length === 0;
    };

    const draggedIsCompleted = isCourseCompleted(draggedCourseId);
    const targetIsCompleted = isCourseCompleted(targetCourseId);

    if (draggedIsCompleted !== targetIsCompleted) return;

    const fromIndex = courseOrderRef.current.indexOf(draggedCourseId);
    const toIndex = courseOrderRef.current.indexOf(targetCourseId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const newOrder = [...courseOrderRef.current];
      newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, draggedCourseId);
      setCourseOrder(newOrder);
    }
  }, [draggedCourseId, courses, assignments]);

  // Sort courses putting completed ones (green/finished) at the bottom, then keeping custom order within each group
  const sortedCourses = React.useMemo(() => {
    const isCourseCompleted = (courseId: string) => {
      const cAssigns = assignments.filter((a) => a.courseId === courseId);
      const submittable = cAssigns.filter((a) => requiresSubmission(a.name, a.eventType));
      const pending = submittable.filter((a) => a.submissionStatus !== 'submitted');
      return cAssigns.length > 0 && pending.length === 0;
    };

    if (courseOrder.length === 0) {
      return [...courses].sort((a, b) => {
        const completedA = isCourseCompleted(a.moodleCourseId);
        const completedB = isCourseCompleted(b.moodleCourseId);
        if (completedA && !completedB) return 1;
        if (!completedA && completedB) return -1;
        return 0;
      });
    }

    const orderMap = new Map(courseOrder.map((id, index) => [id, index]));

    return [...courses].sort((a, b) => {
      const completedA = isCourseCompleted(a.moodleCourseId);
      const completedB = isCourseCompleted(b.moodleCourseId);

      // Put completed courses at the bottom
      if (completedA && !completedB) return 1;
      if (!completedA && completedB) return -1;

      // Same status, sort by custom order
      const indexA = orderMap.has(a.moodleCourseId) ? orderMap.get(a.moodleCourseId)! : 9999;
      const indexB = orderMap.has(b.moodleCourseId) ? orderMap.get(b.moodleCourseId)! : 9999;
      return indexA - indexB;
    });
  }, [courses, courseOrder, assignments]);
  
  // Bento expanded state for courses
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);

  const [isHoveringSync, setIsHoveringSync] = useState(false);
  const syncIconRef = useRef<HTMLSpanElement>(null);

  const syncNodes = React.useMemo<CircuitNodeType[]>(() => {
    const statusVal = isSyncing ? 'processing' : 'active';
    return [
      { id: 'welearn', x: 50, y: 110, label: 'WeLearn', status: statusVal, size: 'lg', icon: <GraduationCap size={15} /> },
      { id: 'orchestrator', x: 150, y: 110, label: 'Orchestrator', status: statusVal, size: 'md', icon: <Layers size={11} /> },
      { id: 'db', x: 250, y: 110, label: 'DB Sync', status: statusVal, size: 'md', icon: <Layers size={11} /> },
      { id: 'tasks', x: 350, y: 55, label: 'Misi', status: statusVal, size: 'sm', icon: <ClipboardList size={11} /> },
      { id: 'calendar', x: 350, y: 165, label: 'Agenda', status: statusVal, size: 'sm', icon: <Calendar size={11} /> },
    ];
  }, [isSyncing]);

  const syncConnections = React.useMemo<CircuitConnection[]>(() => {
    const animatedVal = isSyncing || isHoveringSync;
    const speed = isSyncing ? 0.95 : 3.5;
    
    // Total sequence length: 355px
    const totalLength = 355;
    const duration = 3.55 * speed;

    return [
      { 
        from: 'welearn', 
        to: 'tasks', 
        animated: animatedVal, 
        path: 'M 50 110 H 300 V 55 H 350',
        pulseLength: 30,
        gapLength: totalLength,
        duration: duration,
        delay: 0
      },
      { 
        from: 'welearn', 
        to: 'calendar', 
        animated: animatedVal, 
        path: 'M 50 110 H 300 V 165 H 350',
        pulseLength: 30,
        gapLength: totalLength,
        duration: duration,
        delay: 0
      },
    ];
  }, [isSyncing, isHoveringSync]);




  /* init */
  useEffect(() => { fetchStatus(); }, []);

  useEffect(() => {
    if (status?.isConnected) {
      fetchCourses();
      fetchAssignments('all');
    }
  }, [status?.isConnected]);



  /* stats */
  const overdueCount = assignments.filter(
    (a) => requiresSubmission(a.name, a.eventType) && a.dueDate && new Date(a.dueDate) < new Date() && a.submissionStatus !== 'submitted'
  ).length;
  const pendingCount = assignments.filter((a) => requiresSubmission(a.name, a.eventType) && a.submissionStatus !== 'submitted').length;
  const submittedCount = assignments.filter((a) => requiresSubmission(a.name, a.eventType) && a.submissionStatus === 'submitted').length;
  
  const submittableAssignments = assignments.filter((a) => requiresSubmission(a.name, a.eventType));
  const completionRate = submittableAssignments.length > 0 ? Math.round((submittedCount / submittableAssignments.length) * 100) : 100;

  // Filtering Logic
  const filteredAssignments = assignments.filter((a) => {
    const matchSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        a.courseName.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchStatus = true;
    if (statusFilter === 'submitted') matchStatus = a.submissionStatus === 'submitted';
    else if (statusFilter === 'pending') matchStatus = a.submissionStatus !== 'submitted';
    else if (statusFilter === 'overdue') {
      matchStatus = a.submissionStatus !== 'submitted' && a.dueDate != null && new Date(a.dueDate) < new Date();
    }

    const matchCourse = courseFilter === 'all' || a.courseId === courseFilter;

    return matchSearch && matchStatus && matchCourse;
  });

  /* ── NOT CONNECTED ── */
  if (!status?.isConnected) {
    return (
      <div className="py-12 space-y-8">
        <div id="welearn-tour-connect-btn">
          <EmptyState
            mascot="cloud"
            title="WeLearn Belum Terhubung"
            description="Hubungkan akun WeLearn WICIDA Anda di menu Integrasi/Settings untuk menyinkronkan tugas kuliah secara otomatis."
            ctaText="Hubungkan Sekarang 🚀"
            ctaAction={onNavigateToSettings}
            speechBubble="WeLearn Offline!"
          />
        </div>
        
        <div className="flex justify-center mt-4">
          <div className="flex items-center gap-2 text-[10px] text-black font-mono font-bold bg-[#FAF9F5] border-2 border-black rounded-xl px-4 py-2 shadow-[2px_2px_0px_#000]">
            <Info size={12} className="text-[#C084FC]" />
            <span>KREDENSIAL DIENKRIPSI TINGKAT TINGGI AES-256</span>
          </div>
        </div>

        {/* Premium Preview Section */}
        <div className="max-w-4xl mx-auto mt-12 border-3 border-black rounded-3xl p-6 bg-white shadow-[6px_6px_0px_#000] space-y-6">
          <div className="text-center space-y-1">
            <span className="text-[10px] font-black text-neoBlue uppercase tracking-widest font-mono">Premium Features Preview</span>
            <h4 className="text-lg font-black text-black font-heading">Mengapa Anda Harus Menghubungkan WeLearn?</h4>
            <p className="text-xs text-slate-500 font-bold">Dapatkan kemudahan otomatisasi tugas perkuliahan instan dengan standard asisten AI.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border-2 border-black rounded-2xl p-4 bg-neoYellow/10 shadow-[3px_3px_0px_#000] space-y-2 text-left">
              <div className="w-8 h-8 rounded-lg bg-neoYellow border-2 border-black flex items-center justify-center font-black text-black shadow-neo-sm">
                ⚡
              </div>
              <h5 className="text-xs font-black text-black">Auto-Sync 2 Jam</h5>
              <p className="text-[10.5px] text-slate-650 font-semibold leading-relaxed">Tugas kuliah baru diserap di latar belakang secara otomatis. Tidak perlu unggah dokumen manual.</p>
            </div>

            <div className="border-2 border-black rounded-2xl p-4 bg-neoMint/10 shadow-[3px_3px_0px_#000] space-y-2 text-left">
              <div className="w-8 h-8 rounded-lg bg-neoMint border-2 border-black flex items-center justify-center font-black text-black shadow-neo-sm">
                🤖
              </div>
              <h5 className="text-xs font-black text-black">Bantuan Draf AI Asep</h5>
              <p className="text-[10.5px] text-slate-650 font-semibold leading-relaxed">Klik tombol asisten AI di setiap tugas untuk mendapatkan draf jawaban, outline, dan panduan belajar instan.</p>
            </div>

            <div className="border-2 border-black rounded-2xl p-4 bg-neoPink/10 shadow-[3px_3px_0px_#000] space-y-2 text-left">
              <div className="w-8 h-8 rounded-lg bg-neoPink border-2 border-black flex items-center justify-center font-black text-black shadow-neo-sm">
                🎯
              </div>
              <h5 className="text-xs font-black text-black">Notifikasi Deadline Telegram</h5>
              <p className="text-[10.5px] text-slate-650 font-semibold leading-relaxed">Kirim pengingat otomatis ke Telegram Anda lengkap dengan tombol inline pengerjaan & penyelesaian.</p>
            </div>
          </div>
        </div>

        {/* Guided Tour & Bantuan overlay components */}
        {showTour && (
          <WeLearnFeatureTour isConnected={false} onClose={() => setShowTour(false)} />
        )}
        <WeLearnHelpButton onStartTour={() => setShowTour(true)} onNavigateToSettings={onNavigateToSettings} />
      </div>
    );
  }

  /* ── CONNECTED ── */
  const courseOptions = [
    { value: 'all', label: 'Semua Mata Kuliah' },
    ...courses.map((c) => ({
      value: c.moodleCourseId,
      label: c.name.replace(/^\d{4}\/\d{4}_\d+_\w+_PA_/, '').trim().toUpperCase()
    }))
  ];

  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes progress-stripes {
          0% { background-position: 0 0; }
          100% { background-position: 40px 0; }
        }
        .animate-progress-stripes {
          background-size: 40px 40px;
          animation: progress-stripes 1s linear infinite;
        }
        @keyframes bouncing-box {
          0% { transform: translateY(0); }
          100% { transform: translateY(-14px); }
        }
        .animate-box-1 {
          animation: bouncing-box 0.6s infinite alternate;
        }
        .animate-box-2 {
          animation: bouncing-box 0.6s infinite alternate 0.15s;
        }
        .animate-box-3 {
          animation: bouncing-box 0.6s infinite alternate 0.3s;
        }
        @keyframes shine {
          0% { transform: translateX(-150%) skewX(-12deg); }
          100% { transform: translateX(250%) skewX(-12deg); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1D2A44;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #C084FC;
        }
        
        /* 3D Tilt Card Effects */
        .courses-grid-container {
          perspective: 1000px;
        }
        .neo-3d-card {
          transform-style: preserve-3d;
          transition: transform 0.5s cubic-bezier(0.23, 1, 0.32, 1),
                      box-shadow 0.5s cubic-bezier(0.23, 1, 0.32, 1),
                      border-color 0.3s;
        }
        .neo-3d-card:hover {
          transform: translateZ(15px);
        }
        /* Sheen Overlay */
        .neo-3d-card::before {
          content: "";
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(
            to bottom right,
            rgba(255, 255, 255, 0.25),
            rgba(255, 255, 255, 0) 80%
          );
          transform: rotate(-30deg);
          pointer-events: none;
          z-index: 5;
          opacity: 0;
          transition: opacity 0.5s ease;
        }
        .neo-3d-card:hover::before {
          opacity: 1;
        }
        /* Inner Elements translations */
        .neo-3d-card .icon-box,
        .neo-3d-card .course-title,
        .neo-3d-card .progress-section,
        .neo-3d-card .status-handle {
          transition: transform 0.4s cubic-bezier(0.23, 1, 0.32, 1), background-color 0.3s;
        }
        .neo-3d-card:hover .icon-box {
          transform: translateZ(25px);
        }
        .neo-3d-card:hover .course-title {
          transform: translateZ(20px);
        }
        .neo-3d-card:hover .progress-section {
          transform: translateZ(15px);
        }
        .neo-3d-card:hover .status-handle {
          transform: translateZ(35px) translateY(1.5px);
        }
      `}} />

      {/* Error Info */}
      {error && (
        <div className="flex items-center gap-2 p-3.5 bg-[#FF6B6B]/15 border-3 border-black rounded-2xl text-sm text-black shadow-[3px_3px_0px_#FF6B6B] font-bold">
          <AlertTriangle size={16} className="shrink-0 text-black font-black" />
          <span className="flex-1 font-black">{error}</span>
          <button onClick={clearError} className="text-black hover:text-[#FF6B6B] font-black px-1.5 border border-black rounded bg-white shadow-[1px_1px_0px_#000] scale-90">✕</button>
        </div>
      )}

      {/* UNIFIED BENTO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Tile 1: Profile & Integration Status (Col-span 2) */}
        <div 
          className={cn(
            "col-span-1 md:col-span-2 border-4 border-black rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group min-h-[220px] transition-all duration-500",
            isSyncing
              ? "bg-[#38BDF8] shadow-[6px_6px_0px_#000] text-black"
              : "bg-white shadow-[6px_6px_0px_#000] text-black"
          )}
          style={{
            backgroundImage: isSyncing 
              ? "radial-gradient(rgba(0, 0, 0, 0.15) 1.5px, transparent 0)" 
              : "radial-gradient(rgba(0, 0, 0, 0.08) 1.5px, transparent 0)",
            backgroundSize: "16px 16px"
          }}
        >
          {/* Cyber HUD Label tags */}
          <div className="absolute top-2 left-4 font-mono text-[8px] font-black tracking-widest text-black/45 select-none uppercase">
            {isSyncing ? "[SYS_STATUS: SYNC_DATA_STREAM]" : "[SYS_STATUS: SYSTEM_READY]"}
          </div>
          <div className="absolute top-2 right-4 font-mono text-[8px] font-black tracking-widest text-black/45 select-none uppercase">
            {"// LINK: MOODLE_WICIDA_v2"}
          </div>

          <div className={`absolute -right-6 -bottom-6 w-36 h-36 bg-[#C084FC]/10 rounded-full pointer-events-none transition-all duration-500 ${isSyncing ? 'opacity-0 scale-90' : 'group-hover:scale-110 opacity-100'}`} />
          
          <div className={`absolute inset-0 z-0 transition-all duration-500 ${isSyncing ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <CircuitBoard
              nodes={syncNodes}
              connections={syncConnections}
              coordWidth={400}
              coordHeight={220}
              pulseSpeed={isSyncing ? 0.95 : 3.5}
              traceColor="rgba(0, 0, 0, 0.4)"
              pulseColor="#C084FC"
              nodeColor="#000000"
              variant="light"
              showGrid={false}
              traceWidth={3.5}
              neoBrutal={true}
            />
          </div>

          <motion.div
            className="relative z-10"
            initial={{ opacity: 1, y: 0 }}
            animate={{ 
              opacity: isSyncing ? 0 : 1, 
              y: isSyncing ? -20 : 0
            }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            style={{ pointerEvents: isSyncing ? 'none' : 'auto' }}
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#C084FC] rounded-2xl border-2 border-black text-black shadow-[2.5px_2.5px_0px_#000] scale-95 shrink-0">
                <GraduationCap size={24} className="font-black" />
              </div>
              <div className="min-w-0 text-left">
                <h2 className="font-black text-lg sm:text-xl text-black leading-tight font-heading">INTEGRASI AKADEMIK WELEARN</h2>
                <div className="flex items-center gap-1.5 text-xs text-black mt-1 font-mono font-bold flex-wrap">
                  <Wifi size={12} className="text-[#86EFAC] animate-pulse stroke-[3] shrink-0" />
                  <span className="truncate">{(status?.moodleUsername || '').toUpperCase()}</span>
                  <span className="bg-[#C084FC] text-black text-[9px] font-black px-1.5 py-0.5 rounded border border-black shadow-[1.5px_1.5px_0px_#000] shrink-0 ml-1">TA 2025/2026</span>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="relative z-10 mt-4"
            initial={{ opacity: 1, y: 0 }}
            animate={{ 
              opacity: isSyncing ? 0 : 1, 
              y: isSyncing ? -10 : 0
            }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            style={{ pointerEvents: isSyncing ? 'none' : 'auto' }}
          >
            <div className="bg-[#FAF9F5] border-2 border-black rounded-2xl p-3 text-left shadow-[2.5px_2.5px_0px_#000] flex items-start gap-2.5">
              <div className="p-1.5 bg-neoBlue/15 border-2 border-black rounded-lg shrink-0 mt-0.5 shadow-[1px_1px_0px_#000]">
                <Info size={12} className="text-black font-black" />
              </div>
              <div className="space-y-0.5">
                <h5 className="text-[10px] font-black text-black">💡 Tips Akses Tugas Langsung Sekali Klik</h5>
                <p className="text-[9.5px] font-semibold text-black/70 leading-normal">
                  Pastikan mencentang <strong>"Ingat username"</strong> saat masuk portal WeLearn di peramban Anda agar tombol tugas dapat diakses langsung tanpa masuk ulang.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            id="welearn-tour-sync"
            className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mt-6 z-10 relative"
            initial={{ opacity: 1, y: 0 }}
            animate={{ 
              opacity: isSyncing ? 0 : 1, 
              y: isSyncing ? 20 : 0
            }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            style={{ pointerEvents: isSyncing ? 'none' : 'auto' }}
          >
            {status?.lastSyncAt ? (
              <div className="flex items-center gap-2 font-mono text-[10px] text-black/70 font-bold bg-[#FAF9F5] border-2 border-black rounded-lg px-3 py-1.5 shadow-[2px_2px_0px_#000] w-fit">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>SYNC: {new Date(status.lastSyncAt).toLocaleString('id-ID', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit'
                })} (OTOMATIS AKTIF)</span>
              </div>
            ) : (
              <div className="text-[10px] text-red-500 font-bold font-mono">Belum disinkronkan</div>
            )}
            
            <OnboardingTooltip
              hintId="welearn-sync"
              text="Sync otomatis di latar belakang berjalan setiap 2 jam. Klik manual untuk sync instan!"
              position="top"
              accentBg="bg-neoYellow"
            >
              <button
                onClick={syncNow}
                disabled={isSyncing}
                onMouseEnter={() => setIsHoveringSync(true)}
                onMouseLeave={() => setIsHoveringSync(false)}
                className="neo-btn bg-[#FFDE4D] disabled:bg-gray-300 disabled:shadow-none text-black text-xs font-black border-2 border-black rounded-xl px-5 py-3 flex items-center justify-center gap-2 shadow-[3px_3px_0px_#000] hover:bg-neoYellow active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#000] transition-all relative overflow-hidden group w-full sm:w-auto shrink-0 cursor-pointer"
              >
                <div className="absolute inset-0 w-1/2 h-full bg-white/20 transform -skew-x-12 -translate-x-full group-hover:animate-[shine_0.85s_ease-out] pointer-events-none" />
                <span ref={syncIconRef} className="inline-flex items-center justify-center">
                  <RefreshCw size={14} className={`text-black font-black ${isSyncing ? 'animate-spin' : ''}`} />
                </span>
                <span>{isSyncing ? 'SINKRONISASI...' : 'SINKRONKAN SEKARANG'}</span>
              </button>
            </OnboardingTooltip>
          </motion.div>
        </div>

        {/* Tile 2: Completion Rate Circular Chart (Col-span 1) */}
        <div className="col-span-1 border-3 border-black rounded-3xl p-6 bg-[#FAF9F5] shadow-[5px_5px_0px_#000] flex flex-col items-center justify-between text-center relative overflow-hidden min-h-[220px]">
          <div className="w-full flex items-center justify-between">
            <span className="text-[10px] font-black text-black tracking-wider font-heading uppercase">COMPLETION RATE</span>
            <span className="p-1.5 bg-[#86EFAC] border border-black rounded-lg shadow-[1px_1px_0px_#000] scale-90">
              <Sparkles className="text-black shrink-0 animate-pulse" size={12} />
            </span>
          </div>

          <div className="relative flex items-center justify-center my-3">
            <svg className="w-20 h-20 md:w-24 md:h-24 transform -rotate-90" viewBox="0 0 96 96">
              <circle
                cx="48"
                cy="48"
                r="38"
                className="stroke-black/10"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="48"
                cy="48"
                r="38"
                className="stroke-[#C084FC] transition-all duration-1000 ease-out"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray="238.76"
                strokeDashoffset={238.76 - (238.76 * completionRate) / 100}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-xl md:text-2xl font-black font-mono leading-none">{completionRate}%</span>
              <span className="text-[8px] font-black text-gray-550 font-mono mt-0.5 tracking-wider">SELESAI</span>
            </div>
          </div>

          <p className="text-[9px] text-black font-black font-mono leading-none tracking-tight uppercase">
            {submittedCount} DARI {assignments.length} TUGAS TERKUMPUL
          </p>
        </div>

        {/* Tile 3: Asep AI Assistant Helper (Col-span 1) */}
        <div className="col-span-1 border-3 border-black rounded-3xl p-5 bg-[#C084FC] shadow-[5px_5px_0px_#000] relative overflow-hidden text-black flex flex-col justify-between min-h-[220px] group">
          <div className="absolute right-0 bottom-0 opacity-10 group-hover:scale-105 transition-transform duration-500">
            <Sparkles size={110} />
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-2 bg-white/20 px-2.5 py-1 rounded-lg border border-black/10 w-fit">
              <Sparkles size={12} className="animate-spin text-neoYellow" style={{ animationDuration: '4s' }} />
              <span className="text-[9px] font-black uppercase tracking-wider font-mono">Asep Assistant</span>
            </div>
            <p className="text-xs font-black leading-snug">
              Bingung ngerjain tugas? Cukup seret (drag) tugas apa saja ke panel obrolan Asep AI untuk penjelasan instan!
            </p>
          </div>

          <div className="text-[8px] font-bold font-mono tracking-widest uppercase mt-4 bg-white/30 px-2.5 py-1.5 rounded border border-black/10 text-center">
            DRAG & DROP SUPPORTED 🎯
          </div>
        </div>

        {/* Tile 4: Quick Stats (Col-span 2) */}
        <div className="col-span-1 md:col-span-2 border-3 border-black rounded-3xl p-5 bg-white shadow-[5px_5px_0px_#000] flex flex-col justify-between min-h-[200px]">
          <span className="text-xs font-black text-black font-heading tracking-wider uppercase mb-3 flex items-center gap-1.5">
            <Layers size={14} /> RINGKASAN AKADEMIK
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-grow">
            {/* Stat 1: Courses */}
            <div className="bg-neoYellow border-2 border-black rounded-2xl p-3 flex flex-col justify-between shadow-[3px_3px_0px_#1D2A44] hover:-translate-y-0.5 hover:shadow-[4.5px_4.5px_0px_#1D2A44] transition-all duration-200 relative overflow-hidden group cursor-pointer">
              <div className="flex items-center justify-between text-black z-10 relative pointer-events-none">
                <span className="text-[8px] font-black uppercase tracking-wider">Mata Kuliah</span>
                <span className="p-1 bg-white border border-black rounded-lg shadow-[1px_1px_0px_#000]">
                  <BookOpen size={12} className="text-black stroke-[2.5]" />
                </span>
              </div>
              <p className="text-2xl font-black font-mono text-black mt-2 z-10 relative pointer-events-none">{courses.length}</p>
            </div>
            {/* Stat 2: Total Tasks */}
            <div className="bg-neoPink border-2 border-black rounded-2xl p-3 flex flex-col justify-between shadow-[3px_3px_0px_#1D2A44] hover:-translate-y-0.5 hover:shadow-[4.5px_4.5px_0px_#1D2A44] transition-all duration-200 relative overflow-hidden group cursor-pointer">
              <div className="flex items-center justify-between text-black z-10 relative pointer-events-none">
                <span className="text-[8px] font-black uppercase tracking-wider">Total Tugas</span>
                <span className="p-1 bg-white border border-black rounded-lg shadow-[1px_1px_0px_#000]">
                  <ClipboardList size={12} className="text-black stroke-[2.5]" />
                </span>
              </div>
              <p className="text-2xl font-black font-mono text-black mt-2 z-10 relative pointer-events-none">{assignments.length}</p>
            </div>
            {/* Stat 3: Overdue */}
            <div className={`${
              overdueCount > 0 
                ? 'bg-[#FF6B6B] shadow-[3px_3px_0px_#FF7A00] animate-pulse' 
                : 'bg-white shadow-[3px_3px_0px_#1D2A44]'
            } border-2 border-black rounded-2xl p-3 flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-[4.5px_4.5px_0px_#1D2A44] transition-all duration-200 relative overflow-hidden group cursor-pointer`}>
              <div className="flex items-center justify-between text-black z-10 relative pointer-events-none">
                <span className="text-[8px] font-black uppercase tracking-wider">Terlambat</span>
                <span className="p-1 bg-white border border-black rounded-lg shadow-[1px_1px_0px_#000]">
                  <AlertTriangle size={12} className={overdueCount > 0 ? 'text-neoOrange stroke-[2.5]' : 'text-black stroke-[2.5]'} />
                </span>
              </div>
              <p className="text-2xl font-black font-mono text-black mt-2 z-10 relative pointer-events-none">{overdueCount}</p>
            </div>
            {/* Stat 4: Submitted */}
            <div className="bg-[#86EFAC] border-2 border-black rounded-2xl p-3 flex flex-col justify-between shadow-[3px_3px_0px_#1D2A44] hover:-translate-y-0.5 hover:shadow-[4.5px_4.5px_0px_#1D2A44] transition-all duration-200 relative overflow-hidden group cursor-pointer">
              <div className="flex items-center justify-between text-black z-10 relative pointer-events-none">
                <span className="text-[8px] font-black uppercase tracking-wider">Terkumpul</span>
                <span className="p-1 bg-white border border-black rounded-lg shadow-[1px_1px_0px_#000]">
                  <CheckCircle2 size={12} className="text-black stroke-[2.5]" />
                </span>
              </div>
              <p className="text-2xl font-black font-mono text-black mt-2 z-10 relative pointer-events-none">{submittedCount}</p>
            </div>
          </div>
        </div>

        {/* Tile 5: Filters & Search (Col-span 2) */}
        <div id="welearn-tour-filters" className="col-span-1 md:col-span-2 border-3 border-black rounded-3xl p-5 bg-white shadow-[5px_5px_0px_#000] flex flex-col justify-between min-h-[200px]">
          <h4 className="text-xs font-black text-black font-heading tracking-wider uppercase mb-3 flex items-center gap-1.5">
            <Filter size={12} /> PENCARIAN & FILTER DATA
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search query */}
            <div className="relative">
              <Search className="absolute left-3 top-3 text-black font-black" size={12} />
              <input
                type="text"
                placeholder="Cari nama tugas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full neo-input pl-9 pr-3 py-2 text-xs"
              />
            </div>

            {/* Status Filter */}
            <div className="space-y-0.5">
              <CustomSelect
                options={statusFilterOptions}
                value={statusFilter}
                onChange={setStatusFilter}
                size="sm"
                className="w-full"
              />
            </div>

            {/* Course Filter */}
            <div className="space-y-0.5">
              <CustomSelect
                options={courseOptions}
                value={courseFilter}
                onChange={setCourseFilter}
                size="sm"
                className="w-full"
              />
            </div>
          </div>

          <div className="flex justify-end mt-2">
            {(searchQuery || statusFilter !== 'all' || courseFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setCourseFilter('all');
                }}
                className="text-[9px] font-black font-mono bg-[#FAF9F5] hover:bg-neoOrange border-2 border-black rounded-lg px-2.5 py-1 shadow-[1.5px_1.5px_0px_#000] active:translate-y-0.5 active:shadow-none transition-all"
              >
                BERSIHKAN FILTER ✕
              </button>
            )}
          </div>
        </div>

      </div> {/* END OF HEADER BENTO GRID */}

      {/* Main Content Area (View Switcher and Cards) */}
      <div className="space-y-6">
        
        {/* View Switcher Bento */}
        <div className="border-3 border-black rounded-3xl p-4 bg-white shadow-[5px_5px_0px_#000] flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs font-black text-black font-heading tracking-wider uppercase">MODUL INFORMASI UTAMA</span>
          <div className="flex gap-2 border-2 border-black bg-slate-100 p-1 rounded-2xl shadow-[1.5px_1.5px_0px_#000] w-full sm:w-auto overflow-x-auto">
            {(['courses', 'all'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setView(tab)}
                className={`flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl border-2 transition-all duration-200 cursor-pointer whitespace-nowrap ${
                  view === tab
                    ? 'bg-white text-black border-black shadow-[2px_2px_0px_#000] -translate-y-0.5'
                    : 'border-transparent text-black/55 hover:text-black hover:bg-white/40'
                }`}
              >
                {tab === 'courses' ? (
                  <><BookOpen size={13} /> PER MATA KULIAH</>
                ) : (
                  <>
                    <ClipboardList size={13} /> SEMUA DAFTAR TUGAS
                    {pendingCount > 0 && (
                      <span className="ml-1.5 bg-[#FF6B6B] border border-black text-white text-[9px] font-black font-mono px-1.5 py-0.5 rounded shadow-[1px_1px_0px_#000] animate-bounce">
                        {pendingCount}
                      </span>
                    )}
                  </>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Sub-Filter for Course Category */}
        {!isLoading && view === 'courses' && (
          <div className="flex items-center gap-2 border-3 border-black bg-[#FAF9F5] p-2 rounded-2xl shadow-[3px_3px_0px_#000] w-fit">
            <span className="text-[10px] font-black px-2 text-black/60 font-mono uppercase tracking-wider">Kategori Kelas:</span>
            <div className="flex gap-1.5">
              {(['all', 'praktikum', 'teori'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCourseCategoryFilter(cat)}
                  className={`px-3 py-1 text-[10px] font-black rounded-lg border-2 transition-all cursor-pointer ${
                    courseCategoryFilter === cat
                      ? cat === 'praktikum'
                        ? 'bg-[#C084FC] text-black border-black shadow-[1.5px_1.5px_0px_#000] -translate-y-0.5'
                        : cat === 'teori'
                        ? 'bg-[#FFDE4D] text-black border-black shadow-[1.5px_1.5px_0px_#000] -translate-y-0.5'
                        : 'bg-white text-black border-black shadow-[1.5px_1.5px_0px_#000] -translate-y-0.5'
                      : 'border-transparent text-black/55 hover:text-black hover:bg-black/5'
                  }`}
                >
                  {cat === 'all' && 'Semua Kelas'}
                  {cat === 'praktikum' && '🧪 Praktikum'}
                  {cat === 'teori' && '📚 Teori & Umum'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading States */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-black bg-white rounded-3xl border-3 border-black shadow-[5px_5px_0px_#000]">
            <div className="flex gap-3 justify-center items-center h-12">
              <div className="w-6 h-6 bg-neoYellow border-3 border-black rounded-lg shadow-[2px_2px_0px_#000] animate-box-1" />
              <div className="w-6 h-6 bg-[#C084FC] border-3 border-black rounded-lg shadow-[2px_2px_0px_#000] animate-box-2" />
              <div className="w-6 h-6 bg-neoMint border-3 border-black rounded-lg shadow-[2px_2px_0px_#000] animate-box-3" />
            </div>
            <span className="font-black text-xs font-mono uppercase tracking-widest bg-[#FAF9F5] border-2 border-black px-4 py-1.5 rounded-xl shadow-[2px_2px_0px_#000] animate-pulse">
              MENYELARASKAN DATA WELEARN...
            </span>
          </div>
        )}

        {/* VIEW: Per Mata Kuliah (Bento Cards Grid) */}
        {!isLoading && view === 'courses' && (
          <div id="welearn-tour-courses" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 courses-grid-container">
            {courses.length === 0 ? (
              <div className="col-span-full text-center py-16 bg-white rounded-3xl border-3 border-black shadow-[5px_5px_0px_#000]">
                <GraduationCap size={44} className="text-black mx-auto mb-3" />
                <p className="font-black text-black mb-1 text-sm font-heading">BELUM ADA MATA KULIAH TERDETEKSI</p>
                <p className="text-xs text-gray-550 font-bold px-4">
                  Mata kuliah dari Tahun Ajaran 2025/2026 Anda kosong. Silakan sinkronkan data di atas.
                </p>
              </div>
            ) : (() => {
              const filteredCourses = sortedCourses.filter((c) => {
                if (courseFilter !== 'all' && c.moodleCourseId !== courseFilter) return false;
                const cAssigns = assignments.filter((a) => a.courseId === c.moodleCourseId);
                
                if (statusFilter === 'all') return true;
                if (statusFilter === 'submitted') return cAssigns.some((a) => a.submissionStatus === 'submitted');
                if (statusFilter === 'pending') return cAssigns.some((a) => a.submissionStatus !== 'submitted');
                if (statusFilter === 'overdue') {
                  return cAssigns.some((a) => a.submissionStatus !== 'submitted' && a.dueDate != null && new Date(a.dueDate) < new Date());
                }
                return true;
              });

              const praktikumCourses = filteredCourses.filter((c) => isPraktikum(c.name));
              const teoriCourses = filteredCourses.filter((c) => !isPraktikum(c.name));

              if (filteredCourses.length === 0) {
                return (
                  <div className="col-span-full text-center py-16 bg-white rounded-3xl border-3 border-black shadow-[5px_5px_0px_#000]">
                    <BookOpen size={44} className="text-black mx-auto mb-3" />
                    <p className="font-black text-black mb-1 text-sm font-heading">TIDAK ADA KELAS DITEMUKAN</p>
                    <p className="text-xs text-gray-550 font-bold px-4">
                      Tidak ada kelas yang cocok dengan kriteria filter saat ini.
                    </p>
                  </div>
                );
              }

              return (
                <>
                  {/* 1. SECTION: PRAKTIKUM */}
                  {(courseCategoryFilter === 'all' || courseCategoryFilter === 'praktikum') && (
                    <>
                      {/* Header Row for Praktikum */}
                      {courseCategoryFilter === 'all' && praktikumCourses.length > 0 && (
                        <div className="col-span-full border-3 border-black bg-[#C084FC] text-black px-4 py-3 rounded-2xl shadow-[3px_3px_0px_#000] flex items-center justify-between mt-2 first:mt-0">
                          <span className="font-heading font-black text-xs uppercase flex items-center gap-2">
                            <FlaskConical size={14} className="animate-pulse" /> KELAS PRAKTIKUM / LABS ({praktikumCourses.length})
                          </span>
                        </div>
                      )}
                      
                      {praktikumCourses.length === 0 ? (
                        courseCategoryFilter === 'praktikum' ? (
                          <div className="col-span-full text-center py-12 bg-white rounded-3xl border-3 border-black shadow-[4px_4px_0px_#000]">
                            <FlaskConical size={32} className="text-black/45 mx-auto mb-2" />
                            <p className="font-black text-black text-xs font-heading">TIDAK ADA KELAS PRAKTIKUM YANG COCOK</p>
                          </div>
                        ) : null
                      ) : (
                        praktikumCourses.map((course) => {
                          const courseAssigns = filteredAssignments.filter(
                            (a) => a.courseId === course.moodleCourseId
                          );
                          const isExpanded = expandedCourseId === course.moodleCourseId;
                          return (
                            <CourseCard
                              key={course.id}
                              course={course}
                              assignments={courseAssigns}
                              isExpanded={isExpanded}
                              isAnyCardExpanded={expandedCourseId !== null}
                              onToggleExpand={() => setExpandedCourseId(isExpanded ? null : course.moodleCourseId)}
                              onAskAsep={handleAskAsep}
                              isDragging={draggedCourseId === course.moodleCourseId}
                              draggable={!isExpanded}
                              onDragStart={(e) => {
                                setDraggedCourseId(course.moodleCourseId);
                                initialOrderRef.current = [...courseOrderRef.current];
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', course.moodleCourseId);
                              }}
                              onDragOver={(e) => e.preventDefault()}
                              onDragEnter={() => handleDragEnter(course.moodleCourseId, course.name)}
                              onDragEnd={() => {
                                const finalOrder = courseOrderRef.current;
                                const hasChanged = JSON.stringify(initialOrderRef.current) !== JSON.stringify(finalOrder);
                                if (hasChanged) {
                                  localStorage.setItem(`course_order_${user?.id || 'default'}`, JSON.stringify(finalOrder));
                                  toast.success('Urutan kelas diperbarui!');
                                }
                                setDraggedCourseId(null);
                              }}
                            />
                          );
                        })
                      )}
                    </>
                  )}

                  {/* 2. SECTION: TEORI & UMUM */}
                  {(courseCategoryFilter === 'all' || courseCategoryFilter === 'teori') && (
                    <>
                      {/* Header Row for Teori */}
                      {courseCategoryFilter === 'all' && teoriCourses.length > 0 && (
                        <div className="col-span-full border-3 border-black bg-[#FFDE4D] text-black px-4 py-3 rounded-2xl shadow-[3px_3px_0px_#000] flex items-center justify-between mt-6">
                          <span className="font-heading font-black text-xs uppercase flex items-center gap-2">
                            <BookOpen size={14} /> KELAS TEORI & UMUM ({teoriCourses.length})
                          </span>
                        </div>
                      )}

                      {teoriCourses.length === 0 ? (
                        courseCategoryFilter === 'teori' ? (
                          <div className="col-span-full text-center py-12 bg-white rounded-3xl border-3 border-black shadow-[4px_4px_0px_#000]">
                            <BookOpen size={32} className="text-black/45 mx-auto mb-2" />
                            <p className="font-black text-black text-xs font-heading">TIDAK ADA KELAS TEORI YANG COCOK</p>
                          </div>
                        ) : null
                      ) : (
                        teoriCourses.map((course) => {
                          const courseAssigns = filteredAssignments.filter(
                            (a) => a.courseId === course.moodleCourseId
                          );
                          const isExpanded = expandedCourseId === course.moodleCourseId;
                          return (
                            <CourseCard
                              key={course.id}
                              course={course}
                              assignments={courseAssigns}
                              isExpanded={isExpanded}
                              isAnyCardExpanded={expandedCourseId !== null}
                              onToggleExpand={() => setExpandedCourseId(isExpanded ? null : course.moodleCourseId)}
                              onAskAsep={handleAskAsep}
                              isDragging={draggedCourseId === course.moodleCourseId}
                              draggable={!isExpanded}
                              onDragStart={(e) => {
                                setDraggedCourseId(course.moodleCourseId);
                                initialOrderRef.current = [...courseOrderRef.current];
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', course.moodleCourseId);
                              }}
                              onDragOver={(e) => e.preventDefault()}
                              onDragEnter={() => handleDragEnter(course.moodleCourseId, course.name)}
                              onDragEnd={() => {
                                const finalOrder = courseOrderRef.current;
                                const hasChanged = JSON.stringify(initialOrderRef.current) !== JSON.stringify(finalOrder);
                                if (hasChanged) {
                                  localStorage.setItem(`course_order_${user?.id || 'default'}`, JSON.stringify(finalOrder));
                                  toast.success('Urutan kelas diperbarui!');
                                }
                                setDraggedCourseId(null);
                              }}
                            />
                          );
                        })
                      )}
                    </>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* VIEW: Semua Tugas (grouped by urgency in Bento layout) */}
        {!isLoading && view === 'all' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredAssignments.length === 0 ? (
              <div className="col-span-1 md:col-span-2 text-center py-16 bg-white rounded-3xl border-3 border-black shadow-[5px_5px_0px_#000]">
                <CheckCircle2 size={44} className="text-emerald-400 mx-auto mb-3" />
                <p className="font-black text-black mb-1 text-sm font-heading">TIDAK ADA TUGAS DITEMUKAN</p>
                <p className="text-xs text-gray-550 font-bold">Cobalah untuk membersihkan filter atau kata kunci pencarian Anda.</p>
              </div>
            ) : (
              <>
                {/* 1. Bento Terlambat */}
                {(() => {
                  const list = filteredAssignments.filter(
                    (a) => requiresSubmission(a.name, a.eventType) && a.dueDate && new Date(a.dueDate) < new Date() && a.submissionStatus !== 'submitted'
                  );
                  if (list.length === 0) return null;
                  return (
                    <div className="flex flex-col h-[380px] border-3 border-black rounded-3xl overflow-hidden bg-rose-50/20 shadow-[4px_4px_0px_#FF6B6B] hover:-translate-y-1 transition-all duration-300">
                      <div className="p-4 border-b-3 border-black bg-red-300 text-black flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={16} className="text-black shrink-0 animate-bounce" />
                          <span className="font-heading font-black text-xs uppercase">TERLAMBAT ({list.length})</span>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 custom-scrollbar">
                        {list.map((a) => <AssignmentRow key={a.id} assignment={a} onAskAsep={handleAskAsep} />)}
                      </div>
                    </div>
                  );
                })()}

                {/* 2. Bento Segera */}
                {(() => {
                  const list = filteredAssignments.filter((a) => {
                    if (!requiresSubmission(a.name, a.eventType) || !a.dueDate || a.submissionStatus === 'submitted') return false;
                    const d = Math.ceil((new Date(a.dueDate).getTime() - Date.now()) / 86400000);
                    return d >= 0 && d <= 3;
                  });
                  if (list.length === 0) return null;
                  return (
                    <div className="flex flex-col h-[380px] border-3 border-black rounded-3xl overflow-hidden bg-amber-50/20 shadow-[4px_4px_0px_#FBBF24] hover:-translate-y-1 transition-all duration-300">
                      <div className="p-4 border-b-3 border-black bg-neoYellow text-black flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                          <Clock size={16} className="text-black shrink-0" />
                          <span className="font-heading font-black text-xs uppercase">SEGERA — ≤ 3 HARI ({list.length})</span>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 custom-scrollbar">
                        {list.map((a) => <AssignmentRow key={a.id} assignment={a} onAskAsep={handleAskAsep} />)}
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Bento Mendatang */}
                {(() => {
                  const list = filteredAssignments.filter((a) => {
                    if (!requiresSubmission(a.name, a.eventType) || !a.dueDate || a.submissionStatus === 'submitted') return false;
                    const d = Math.ceil((new Date(a.dueDate).getTime() - Date.now()) / 86400000);
                    return d > 3;
                  });
                  if (list.length === 0) return null;
                  return (
                    <div className="flex flex-col h-[380px] border-3 border-black rounded-3xl overflow-hidden bg-sky-50/20 shadow-[4px_4px_0px_#0E86D4] hover:-translate-y-1 transition-all duration-300">
                      <div className="p-4 border-b-3 border-black bg-neoMint text-black flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                          <Calendar size={16} className="text-black shrink-0" />
                          <span className="font-heading font-black text-xs uppercase">MENDATANG ({list.length})</span>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 custom-scrollbar">
                        {list.map((a) => <AssignmentRow key={a.id} assignment={a} onAskAsep={handleAskAsep} />)}
                      </div>
                    </div>
                  );
                })()}

                {/* 4. Bento Tanpa Deadline */}
                {(() => {
                  const list = filteredAssignments.filter(
                    (a) => requiresSubmission(a.name, a.eventType) && !a.dueDate && a.submissionStatus !== 'submitted'
                  );
                  if (list.length === 0) return null;
                  return (
                    <div className="flex flex-col h-[380px] border-3 border-black rounded-3xl overflow-hidden bg-slate-50/20 shadow-[4px_4px_0px_#1D2A44] hover:-translate-y-1 transition-all duration-300">
                      <div className="p-4 border-b-3 border-black bg-slate-200 text-black flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                          <Layers size={16} className="text-black shrink-0" />
                          <span className="font-heading font-black text-xs uppercase">TANPA DEADLINE ({list.length})</span>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 custom-scrollbar">
                        {list.map((a) => <AssignmentRow key={a.id} assignment={a} onAskAsep={handleAskAsep} />)}
                      </div>
                    </div>
                  );
                })()}

                {/* 5. Bento Info & Pengingat */}
                {(() => {
                  const list = filteredAssignments.filter(
                    (a) => !requiresSubmission(a.name, a.eventType)
                  );
                  if (list.length === 0) return null;
                  return (
                    <div className="flex flex-col h-[380px] border-3 border-black rounded-3xl overflow-hidden bg-slate-50/20 shadow-[4px_4px_0px_#C084FC] hover:-translate-y-1 transition-all duration-300">
                      <div className="p-4 border-b-3 border-black bg-[#C084FC] text-black flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                          <Info size={16} className="text-black shrink-0" />
                          <span className="font-heading font-black text-xs uppercase">INFO & PENGINGAT ({list.length})</span>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 custom-scrollbar">
                        {list.map((a) => <AssignmentRow key={a.id} assignment={a} onAskAsep={handleAskAsep} />)}
                      </div>
                    </div>
                  );
                })()}

                {/* 6. Bento Terkumpul */}
                {(() => {
                  const list = filteredAssignments.filter((a) => requiresSubmission(a.name, a.eventType) && a.submissionStatus === 'submitted');
                  if (list.length === 0) return null;
                  return (
                    <div className="flex flex-col h-[380px] border-3 border-black rounded-3xl overflow-hidden bg-emerald-50/20 shadow-[4px_4px_0px_#10B981] hover:-translate-y-1 transition-all duration-300">
                      <div className="p-4 border-b-3 border-black bg-[#10B981] text-black flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-black shrink-0" />
                          <span className="font-heading font-black text-xs uppercase">SUDAH TERKUMPUL ({list.length})</span>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 custom-scrollbar">
                        {list.map((a) => <AssignmentRow key={a.id} assignment={a} onAskAsep={handleAskAsep} />)}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}

      </div>

      {/* Guided Tour & Bantuan overlay components */}
      {showTour && (
        <WeLearnFeatureTour isConnected={true} onClose={() => setShowTour(false)} />
      )}
      <WeLearnHelpButton onStartTour={() => setShowTour(true)} onNavigateToSettings={onNavigateToSettings} />
    </div>
  );
}
