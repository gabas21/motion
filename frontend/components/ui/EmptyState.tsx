'use client';

import React from 'react';
import { 
  ZappyBolt, 
  MotiClock, 
  KofiMug, 
  StarrySparkle, 
  CloudyCalm 
} from '@/components/Landing/Mascots';

interface EmptyStateProps {
  mascot: 'zappy' | 'clock' | 'mug' | 'star' | 'cloud';
  title: string;
  description: string;
  ctaText?: string;
  ctaAction?: () => void;
  secondaryText?: string;
  secondaryAction?: () => void;
  speechBubble?: string;
}

export default function EmptyState({
  mascot,
  title,
  description,
  ctaText,
  ctaAction,
  secondaryText,
  secondaryAction,
  speechBubble,
}: EmptyStateProps) {
  // Map mascot string to components
  const renderMascot = () => {
    const props = {
      size: 110,
      speechBubble: speechBubble,
      bubblePosition: 'top' as const,
      className: 'transform group-hover:rotate-6 transition-transform duration-300'
    };

    switch (mascot) {
      case 'zappy':
        return <ZappyBolt {...props} />;
      case 'clock':
        return <MotiClock {...props} />;
      case 'mug':
        return <KofiMug {...props} />;
      case 'star':
        return <StarrySparkle {...props} />;
      case 'cloud':
        return <CloudyCalm {...props} />;
      default:
        return <ZappyBolt {...props} />;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-white border-3 border-black shadow-neo rounded-2xl max-w-lg mx-auto my-6 animate-fadeInUp">
      {/* Mascot Section */}
      <div className="mb-6 group">
        {renderMascot()}
      </div>

      {/* Text Info */}
      <h3 className="text-xl font-black text-black mb-2 tracking-tight">
        {title}
      </h3>
      <p className="text-sm font-semibold text-slate-600 mb-6 max-w-sm">
        {description}
      </p>

      {/* Buttons Action */}
      <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
        {ctaText && ctaAction && (
          <button
            onClick={ctaAction}
            className="neo-btn bg-neoYellow text-black border-2 border-black rounded-xl py-2.5 px-6 text-xs font-black shadow-neo hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-1.5 transition-all"
          >
            {ctaText}
          </button>
        )}
        
        {secondaryText && secondaryAction && (
          <button
            onClick={secondaryAction}
            className="neo-btn bg-white text-black border-2 border-black rounded-xl py-2.5 px-6 text-xs font-black shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-none flex items-center justify-center gap-1.5 transition-all"
          >
            {secondaryText}
          </button>
        )}
      </div>
    </div>
  );
}
