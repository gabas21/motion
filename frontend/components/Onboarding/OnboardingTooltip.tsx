'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface OnboardingTooltipProps {
  hintId: string;
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactNode;
  accentBg?: 'bg-neoYellow' | 'bg-neoMint' | 'bg-neoPink' | 'bg-neoBlue' | 'bg-neoOrange' | 'bg-white';
  delayMs?: number; // delay before showing
}

export default function OnboardingTooltip({
  hintId,
  text,
  position = 'top',
  children,
  accentBg = 'bg-neoYellow',
  delayMs = 800,
}: OnboardingTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true); // default true, check localStorage on mount

  useEffect(() => {
    // Check if user has already seen this hint
    const checkSeen = () => {
      try {
        const seenStr = localStorage.getItem('motion_hints_seen');
        const seenList: string[] = seenStr ? JSON.parse(seenStr) : [];
        if (!seenList.includes(hintId)) {
          setIsDismissed(false);
          // Delay showing the tooltip for a smoother UX
          const timer = setTimeout(() => {
            setIsVisible(true);
          }, delayMs);
          return () => clearTimeout(timer);
        }
      } catch (e) {
        console.error('Error reading motion_hints_seen from localStorage', e);
      }
    };

    checkSeen();
  }, [hintId, delayMs]);

  // Auto-dismiss after 7 seconds if visible
  useEffect(() => {
    if (isVisible) {
      const autoDismissTimer = setTimeout(() => {
        handleDismiss();
      }, 7000);
      return () => clearTimeout(autoDismissTimer);
    }
  }, [isVisible]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      setIsDismissed(true);
      try {
        const seenStr = localStorage.getItem('motion_hints_seen');
        const seenList: string[] = seenStr ? JSON.parse(seenStr) : [];
        if (!seenList.includes(hintId)) {
          seenList.push(hintId);
          localStorage.setItem('motion_hints_seen', JSON.stringify(seenList));
        }
      } catch (e) {
        console.error('Error saving motion_hints_seen to localStorage', e);
      }
    }, 200); // Wait for fade-out animation
  };

  if (isDismissed) {
    return <>{children}</>;
  }

  // Position classes for the tooltip container relative to parent
  const posClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-3.5 origin-bottom',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-3.5 origin-top',
    left: 'right-full top-1/2 -translate-y-1/2 mr-3.5 origin-right',
    right: 'left-full top-1/2 -translate-y-1/2 ml-3.5 origin-left',
  };

  // Position classes for the neobrutalism arrow (rotated square)
  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 -mt-1.5 border-r-2 border-b-2 border-black',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 -mb-1.5 border-l-2 border-t-2 border-black',
    left: 'left-full top-1/2 -translate-y-1/2 -ml-1.5 border-t-2 border-r-2 border-black',
    right: 'right-full top-1/2 -translate-y-1/2 -mr-1.5 border-b-2 border-l-2 border-black',
  };

  return (
    <div className="relative inline-block">
      {children}

      <div
        className={`absolute z-[9999] w-64 max-w-xs transition-all duration-300 transform 
          ${isVisible ? 'opacity-100 scale-100 translate-y-0 translate-x-0' : 'opacity-0 scale-90 pointer-events-none'}
          ${posClasses[position]}`}
      >
        <div className={`relative p-3 rounded-xl border-2 border-black text-black font-black text-xs text-left shadow-neo-sm ${accentBg}`}>
          {/* Arrow */}
          <div className={`absolute w-3.5 h-3.5 rotate-45 ${accentBg} ${arrowClasses[position]}`} />

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-1.5 right-1.5 p-0.5 border border-black bg-white hover:bg-slate-100 rounded-md transition-colors cursor-pointer text-black"
          >
            <X size={10} strokeWidth={3} />
          </button>

          {/* Content */}
          <div className="pr-4 leading-relaxed select-none">
            {text}
          </div>
        </div>
      </div>
    </div>
  );
}
