// ─── Skeleton Component System — Motion App ───────────────────────────────────
// Shimmer effect modern dengan gradient animasi yang smooth.
// Dipakai di seluruh app sebagai pengganti animate-pulse biasa.

import React from 'react';

interface SkeletonProps {
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  height?: string;
  width?: string;
}

/**
 * Skeleton dasar dengan shimmer effect.
 * Gunakan className untuk mengontrol ukuran (w-*, h-*).
 */
export function Skeleton({ className = '', rounded = 'lg' }: SkeletonProps) {
  const roundedMap = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl',
    full: 'rounded-full',
  };

  return (
    <div
      className={`skeleton-shimmer ${roundedMap[rounded]} ${className}`}
      aria-hidden="true"
    />
  );
}

/** Skeleton untuk satu baris teks */
export function SkeletonText({ className = '', lines = 1 }: { className?: string; lines?: number }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3.5 ${i === lines - 1 && lines > 1 ? 'w-4/5' : 'w-full'}`}
          rounded="md"
        />
      ))}
    </div>
  );
}

/** Skeleton card wrapper */
export function SkeletonCard({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border-3 border-black/10 rounded-2xl p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

/** Skeleton untuk satu item tugas di daftar */
export function TaskItemSkeleton({ index = 0 }: { index?: number }) {
  const widths = ['w-3/4', 'w-2/3', 'w-5/6', 'w-1/2', 'w-4/5'];
  const badgeWidths = ['w-16', 'w-20', 'w-14', 'w-18', 'w-16'];
  const w = widths[index % widths.length];
  const bw = badgeWidths[index % badgeWidths.length];

  return (
    <div className="bg-white border-2 border-black/8 rounded-xl p-4 flex items-center gap-3 shadow-sm overflow-hidden">
      {/* Checkbox */}
      <Skeleton className="w-5 h-5 shrink-0" rounded="md" />

      {/* Content */}
      <div className="flex-grow space-y-2 min-w-0">
        <Skeleton className={`h-4 ${w}`} rounded="md" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-12" rounded="md" />
          <Skeleton className="h-3 w-16" rounded="md" />
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 shrink-0">
        <Skeleton className={`h-5 ${bw}`} rounded="lg" />
        <Skeleton className="h-5 w-16" rounded="lg" />
      </div>

      {/* Delete btn */}
      <Skeleton className="w-7 h-7 shrink-0" rounded="lg" />
    </div>
  );
}

/** Skeleton untuk header dashboard lengkap */
export function DashboardHeaderSkeleton() {
  return (
    <header className="border-b-3 border-black/10 bg-white sticky top-0 z-40 px-6 py-4 shadow-sm">
      <div className="max-w-[1750px] mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8" rounded="xl" />
            <Skeleton className="w-16 h-5" rounded="lg" />
          </div>
          {/* Nav tabs */}
          <div className="hidden md:flex items-center gap-1 bg-gray-50 border border-black/8 rounded-xl p-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="w-24 h-8" rounded="lg" />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="hidden sm:block w-36 h-8" rounded="xl" />
          <Skeleton className="w-9 h-9" rounded="xl" />
        </div>
      </div>
    </header>
  );
}

/** Skeleton untuk form tambah tugas (panel kiri dashboard) */
export function TaskFormSkeleton() {
  return (
    <SkeletonCard className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-black/8">
        <Skeleton className="w-5 h-5" rounded="md" />
        <Skeleton className="w-36 h-5" rounded="lg" />
      </div>
      {/* Inputs */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="w-24 h-3" rounded="md" />
            <Skeleton className="w-full h-11" rounded="xl" />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Skeleton className="w-20 h-3" rounded="md" />
            <Skeleton className="w-full h-11" rounded="xl" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="w-20 h-3" rounded="md" />
            <Skeleton className="w-full h-11" rounded="xl" />
          </div>
        </div>
        <Skeleton className="w-full h-11 mt-2" rounded="xl" />
      </div>
    </SkeletonCard>
  );
}

/** Skeleton untuk panel daftar tugas (panel kanan dashboard) */
export function TaskListSkeleton() {
  return (
    <SkeletonCard className="min-h-[500px] space-y-5">
      {/* Filter header */}
      <div className="flex items-center justify-between pb-4 border-b border-black/8">
        <div className="flex items-center gap-2">
          <Skeleton className="w-4 h-4" rounded="md" />
          <Skeleton className="w-36 h-5" rounded="lg" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="w-28 h-8" rounded="xl" />
          <Skeleton className="w-28 h-8" rounded="xl" />
        </div>
      </div>
      {/* Task items */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <TaskItemSkeleton key={i} index={i} />
        ))}
      </div>
    </SkeletonCard>
  );
}

/** Skeleton untuk halaman login/signup */
export function AuthPageSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative py-12">
      {/* Dekorasi latar belakang */}
      <div className="absolute top-12 left-12 w-32 h-32 bg-gray-100 border border-black/10 rounded-2xl transform -rotate-12 hidden md:block" />
      <div className="absolute bottom-12 right-12 w-36 h-36 bg-gray-100 border border-black/10 rounded-full transform rotate-12 hidden md:block" />

      <div className="w-full max-w-md bg-white border-3 border-black/10 shadow-lg rounded-3xl p-8 space-y-6 relative z-10 overflow-hidden">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-2">
          <Skeleton className="w-12 h-12" rounded="xl" />
          <Skeleton className="w-20 h-4" rounded="lg" />
        </div>
        {/* Title */}
        <div className="space-y-2 text-center">
          <Skeleton className="w-3/4 h-7 mx-auto" rounded="lg" />
          <Skeleton className="w-5/6 h-4 mx-auto" rounded="md" />
        </div>
        {/* Inputs */}
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Skeleton className="w-24 h-3" rounded="md" />
            <Skeleton className="w-full h-12" rounded="xl" />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Skeleton className="w-20 h-3" rounded="md" />
              <Skeleton className="w-16 h-3" rounded="md" />
            </div>
            <Skeleton className="w-full h-12" rounded="xl" />
          </div>
        </div>
        {/* Button */}
        <Skeleton className="w-full h-12 mt-4" rounded="xl" />
        {/* Footer link */}
        <div className="flex justify-center gap-1 pt-1">
          <Skeleton className="w-28 h-3" rounded="md" />
          <Skeleton className="w-20 h-3" rounded="md" />
        </div>
      </div>
    </div>
  );
}
