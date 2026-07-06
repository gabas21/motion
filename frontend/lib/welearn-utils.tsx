import React from 'react';
import { HelpCircle, MessageSquare, FileText } from 'lucide-react';
import { MoodleAssignment } from '../hooks/useMoodle';

export function isPraktikum(courseName: string): boolean {
  if (!courseName) return false;
  return courseName.toLowerCase().includes('praktikum');
}

export function requiresSubmission(name: string, eventType: string): boolean {
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

export function getTimeLeft(dueDateStr: string | null): {
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

export function formatDate(d: string | null): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function eventIcon(type: string) {
  if (type === 'quiz') return <HelpCircle size={13} className="text-black shrink-0 font-black" />;
  if (type === 'forum') return <MessageSquare size={13} className="text-black shrink-0 font-black" />;
  return <FileText size={13} className="text-black shrink-0 font-black" />;
}

export function buildAssignmentContext(a: MoodleAssignment): string {
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
