import React from 'react';
import { Clock, ExternalLink, Sparkles } from 'lucide-react';
import { MoodleAssignment } from '../../hooks/useMoodle';
import { 
  getTimeLeft, 
  requiresSubmission, 
  isPraktikum, 
  buildAssignmentContext, 
  eventIcon, 
  formatDate 
} from '../../lib/welearn-utils';
import { StatusBadge } from './StatusBadge';

interface AssignmentRowProps {
  assignment: MoodleAssignment;
  onAskAsep?: (a: MoodleAssignment) => void;
}

export function AssignmentRow({ assignment, onAskAsep }: AssignmentRowProps) {
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
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-3 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 ${borderStyle} ${rowBg} cursor-grab active:cursor-grabbing group`}
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
      {/* Top / Left Section: Icon + Full Readable Name + Due Date */}
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        <span className="p-1.5 bg-white border border-black rounded-lg shrink-0 mt-0.5 scale-95 group-hover:scale-100 transition-transform">
          {eventIcon(assignment.eventType)}
        </span>

        <div className="min-w-0 flex-1 text-left">
          <p className="text-xs font-black text-black leading-snug break-words group-hover:text-neoBlue transition-colors" title={assignment.name}>
            {assignment.name}
          </p>
          {assignment.dueDate && (
            <p className="text-[10px] text-gray-600 mt-1 font-mono font-bold flex items-center gap-1">
              <Clock size={10} className="shrink-0" /> {formatDate(assignment.dueDate)}
            </p>
          )}
        </div>
      </div>

      {/* Bottom / Right Section: Badges & Action Buttons */}
      <div id="welearn-tour-assignments-header" className="flex flex-wrap items-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-black/10 sm:border-transparent mt-1 sm:mt-0">
        {isLab && (
          <span className="text-[9px] font-black px-2 py-1 rounded-xl font-mono bg-[#C084FC] text-black border border-black shadow-[1px_1px_0px_#000] shrink-0 h-7 flex items-center">
            🧪 PRAKTIKUM
          </span>
        )}
        {isSubmittable && assignment.dueDate && assignment.submissionStatus !== 'submitted' && (
          <span
            className={`text-[9px] font-black px-2 py-1 rounded-xl font-mono h-7 flex items-center ${badgeColor}`}
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
            className="icon-btn w-7 h-7 min-h-0 min-w-0 rounded-xl border border-black bg-white hover:bg-[#FFDE4D] shadow-[1px_1px_0px_#000] active:translate-y-0.5 transition-all group/link shrink-0 flex items-center justify-center"
            title="Buka di WeLearn"
          >
            <ExternalLink size={12} className="text-black font-black group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
          </a>
        )}
        {onAskAsep && (
          <button
            id="welearn-tour-asep-btn"
            type="button"
            onClick={() => onAskAsep(assignment)}
            className="icon-btn w-7 h-7 min-h-0 min-w-0 rounded-xl border border-black bg-neoYellow hover:bg-amber-300 shadow-[1px_1px_0px_#000] active:translate-y-0.5 transition-all shrink-0 flex items-center justify-center group/btn"
            title="Tanya Asep AI tentang tugas ini"
          >
            <Sparkles size={12} className="text-black group-hover/btn:rotate-12 transition-transform" />
          </button>
        )}
      </div>
    </div>
  );
}
