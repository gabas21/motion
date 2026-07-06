import React, { useRef } from 'react';
import { BookMarked, XCircle, CheckCircle2, Layers } from 'lucide-react';
import { motion } from 'framer-motion';
import { MoodleCourse, MoodleAssignment } from '../../hooks/useMoodle';
import { requiresSubmission } from '../../lib/welearn-utils';
import { AssignmentRow } from './AssignmentRow';

interface CourseCardProps {
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
}

export function CourseCard({
  course,
  assignments,
  isExpanded,
  onToggleExpand,
  onAskAsep,
  isDragging,
  isAnyCardExpanded,
  ...dragProps
}: CourseCardProps) {
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
