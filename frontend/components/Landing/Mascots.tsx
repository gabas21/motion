'use client';

import React from 'react';

interface MascotProps {
  className?: string;
  size?: number;
  speechBubble?: string;
  bubblePosition?: 'top' | 'bottom' | 'left' | 'right';
}

/* Spech bubble helper component */
function SpeechBubble({ text, position = 'top' }: { text: string; position?: 'top' | 'bottom' | 'left' | 'right' }) {
  const posClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-3 after:top-full after:left-1/2 after:-translate-x-1/2 after:border-t-black after:border-x-transparent',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-3 after:bottom-full after:left-1/2 after:-translate-x-1/2 after:border-b-black after:border-x-transparent',
    left: 'right-full top-1/2 -translate-y-1/2 mr-3 after:left-full after:top-1/2 after:-translate-y-1/2 after:border-l-black after:border-y-transparent',
    right: 'left-full top-1/2 -translate-y-1/2 ml-3 after:right-full after:top-1/2 after:-translate-y-1/2 after:border-r-black after:border-y-transparent',
  };

  return (
    <div className={`absolute z-10 whitespace-nowrap bg-white border-2 border-black px-3 py-1 rounded-xl text-xxs font-black text-black shadow-neo-sm transition-all duration-300 pointer-events-none ${posClasses[position]} after:content-[""] after:absolute after:border-[6px] after:border-transparent`}>
      {text}
    </div>
  );
}

export function MotiClock({ className = "", size = 80, speechBubble, bubblePosition = 'top' }: MascotProps) {
  return (
    <div className="relative inline-block group cursor-pointer">
      {speechBubble && <SpeechBubble text={speechBubble} position={bubblePosition} />}
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg" 
        className={`filter drop-shadow-[3px_3px_0px_#000000] select-none transition-transform duration-300 group-hover:scale-110 active:scale-95 ${className}`}
      >
        {/* Legs */}
        <path d="M35 75L28 90H20" stroke="black" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M65 75L72 90H80" stroke="black" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
        
        {/* Bells / Ear buttons */}
        <circle cx="25" cy="20" r="10" fill="#FF6B6B" stroke="black" strokeWidth="4.5"/>
        <circle cx="75" cy="20" r="10" fill="#FF6B6B" stroke="black" strokeWidth="4.5"/>
        <path d="M25 20L35 30" stroke="black" strokeWidth="4.5"/>
        <path d="M75 20L65 30" stroke="black" strokeWidth="4.5"/>

        {/* Main Body */}
        <circle cx="50" cy="50" r="32" fill="#FFDE4D" stroke="black" strokeWidth="4.5"/>
        <circle cx="50" cy="50" r="24" fill="white" stroke="black" strokeWidth="4.5"/>

        {/* Eyes */}
        <circle cx="42" cy="45" r="3.5" fill="black"/>
        <circle cx="58" cy="45" r="3.5" fill="black"/>
        
        {/* Blushes */}
        <circle cx="37" cy="52" r="2.5" fill="#FF90E8"/>
        <circle cx="63" cy="52" r="2.5" fill="#FF90E8"/>

        {/* Smile */}
        <path d="M46 54C46 54 48 57 50 57C52 57 54 54 54 54" stroke="black" strokeWidth="3" strokeLinecap="round"/>

        {/* Clock Hands */}
        <path d="M50 50V36" stroke="black" strokeWidth="4.5" strokeLinecap="round" className="origin-[50px_50px] group-hover:rotate-[360deg] transition-transform duration-1000 ease-out"/>
        <path d="M50 50L62 50" stroke="black" strokeWidth="4.5" strokeLinecap="round" className="origin-[50px_50px] group-hover:rotate-[90deg] transition-transform duration-1000 ease-out"/>
      </svg>
    </div>
  );
}

export function KofiMug({ className = "", size = 80, speechBubble, bubblePosition = 'top' }: MascotProps) {
  return (
    <div className="relative inline-block group cursor-pointer">
      {speechBubble && <SpeechBubble text={speechBubble} position={bubblePosition} />}
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg" 
        className={`filter drop-shadow-[3px_3px_0px_#000000] select-none transition-transform duration-300 group-hover:scale-110 active:scale-95 ${className}`}
      >
        {/* Steam */}
        <path d="M38 12C38 12 40 8 38 4C36 0 38 0 38 0" stroke="black" strokeWidth="3" strokeLinecap="round" className="group-hover:translate-y-[-2px] transition-transform duration-300"/>
        <path d="M50 14C50 14 52 10 50 6C48 2 50 2 50 2" stroke="black" strokeWidth="3" strokeLinecap="round" className="group-hover:translate-y-[-3px] transition-transform duration-300 delay-75"/>
        <path d="M62 12C62 12 64 8 62 4C60 0 62 0 62 0" stroke="black" strokeWidth="3" strokeLinecap="round" className="group-hover:translate-y-[-2px] transition-transform duration-300 delay-150"/>

        {/* Handle */}
        <path d="M70 40C82 40 82 60 70 60" fill="none" stroke="black" strokeWidth="4.5" strokeLinecap="round"/>
        
        {/* Main Cup Body */}
        <path d="M25 24H75V60C75 70 65 78 50 78C35 78 25 70 25 60V24Z" fill="#C084FC" stroke="black" strokeWidth="4.5" strokeLinejoin="round"/>
        
        {/* Tiny feet */}
        <rect x="36" y="78" width="8" height="10" rx="4" fill="#382416" stroke="black" strokeWidth="3.5"/>
        <rect x="56" y="78" width="8" height="10" rx="4" fill="#382416" stroke="black" strokeWidth="3.5"/>

        {/* Cute Face */}
        {/* Eyes */}
        <path d="M36 43C36 43 38 40 40 40C42 40 44 43 44 43" stroke="black" strokeWidth="3" strokeLinecap="round"/>
        <path d="M56 43C56 43 58 40 60 40C62 40 64 43 64 43" stroke="black" strokeWidth="3" strokeLinecap="round"/>
        
        {/* Blushes */}
        <circle cx="34" cy="50" r="3" fill="#FF6B6B"/>
        <circle cx="66" cy="50" r="3" fill="#FF6B6B"/>

        {/* Smile */}
        <path d="M47 48C47 52 53 52 53 48" fill="#FF6B6B" stroke="black" strokeWidth="3" strokeLinecap="round" className="group-hover:scale-y-125 origin-center transition-transform"/>
      </svg>
    </div>
  );
}

export function ZappyBolt({ className = "", size = 80, speechBubble, bubblePosition = 'top' }: MascotProps) {
  return (
    <div className="relative inline-block group cursor-pointer">
      {speechBubble && <SpeechBubble text={speechBubble} position={bubblePosition} />}
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg" 
        className={`filter drop-shadow-[3px_3px_0px_#000000] select-none transition-transform duration-300 group-hover:scale-110 active:scale-95 ${className}`}
      >
        {/* Main Bolt */}
        <path d="M60 5L25 52H50L40 95L80 44H52L60 5Z" fill="#FFDE4D" stroke="black" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>

        {/* Cool Sunglasses */}
        <rect x="36" y="32" width="14" height="10" rx="2" fill="black" stroke="black" strokeWidth="2"/>
        <rect x="52" y="32" width="14" height="10" rx="2" fill="black" stroke="black" strokeWidth="2"/>
        <path d="M50 35H52" stroke="black" strokeWidth="3"/>
        <path d="M32 35H36" stroke="black" strokeWidth="2"/>
        <path d="M66 35H70" stroke="black" strokeWidth="2"/>

        {/* Cool Grin */}
        <path d="M44 48H56C56 48 56 53 50 53C44 53 44 48 44 48Z" fill="white" stroke="black" strokeWidth="3" strokeLinejoin="round" className="group-hover:scale-x-110 origin-center transition-transform"/>
      </svg>
    </div>
  );
}

export function StarrySparkle({ className = "", size = 80, speechBubble, bubblePosition = 'top' }: MascotProps) {
  return (
    <div className="relative inline-block group cursor-pointer">
      {speechBubble && <SpeechBubble text={speechBubble} position={bubblePosition} />}
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg" 
        className={`filter drop-shadow-[3px_3px_0px_#000000] select-none transition-transform duration-500 group-hover:rotate-[180deg] group-hover:scale-110 active:scale-95 ${className}`}
      >
        {/* 8-point Sparkle Star */}
        <path d="M50 5L58 32L85 32L63 48L72 75L50 58L28 75L37 48L15 32L42 32L50 5Z" fill="#86EFAC" stroke="black" strokeWidth="4.5" strokeLinejoin="round"/>
        
        {/* Cute Face */}
        <circle cx="43" cy="40" r="3" fill="black"/>
        <circle cx="57" cy="40" r="3" fill="black"/>
        
        {/* Blushes */}
        <circle cx="39" cy="46" r="2.5" fill="#FF90E8"/>
        <circle cx="61" cy="46" r="2.5" fill="#FF90E8"/>

        {/* Little Smile */}
        <path d="M48 45C48 45 49.5 48 50 48C50.5 48 52 45 52 45" stroke="black" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    </div>
  );
}

export function CloudyCalm({ className = "", size = 80, speechBubble, bubblePosition = 'top' }: MascotProps) {
  return (
    <div className="relative inline-block group cursor-pointer">
      {speechBubble && <SpeechBubble text={speechBubble} position={bubblePosition} />}
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg" 
        className={`filter drop-shadow-[3px_3px_0px_#000000] select-none transition-transform duration-300 group-hover:scale-110 active:scale-95 ${className}`}
      >
        {/* Tiny Nightcap */}
        <path d="M48 20L65 5L75 10L62 25" fill="#C084FC" stroke="black" strokeWidth="3.5" strokeLinejoin="round"/>
        <circle cx="75" cy="10" r="4.5" fill="white" stroke="black" strokeWidth="3"/>

        {/* Cloud Body */}
        <path d="M30 65C20 65 12 57 12 47C12 38 18 31 27 30C30 18 42 10 55 10C67 10 77 18 80 29C88 31 94 38 94 47C94 57 86 65 76 65H30Z" fill="#7DD3FC" stroke="black" strokeWidth="4.5" strokeLinejoin="round"/>

        {/* Tiny legs hanging */}
        <path d="M42 65V75" stroke="black" strokeWidth="4" strokeLinecap="round" className="origin-top group-hover:rotate-[15deg] transition-transform"/>
        <path d="M58 65V75" stroke="black" strokeWidth="4" strokeLinecap="round" className="origin-top group-hover:rotate-[-15deg] transition-transform"/>
        <circle cx="42" cy="77" r="3" fill="#382416" stroke="black" strokeWidth="2"/>
        <circle cx="58" cy="77" r="3" fill="#382416" stroke="black" strokeWidth="2"/>

        {/* Sleeping Eyes */}
        <path d="M34 40C36 43 39 43 41 40" stroke="black" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
        <path d="M59 40C61 43 64 43 66 40" stroke="black" strokeWidth="3.5" strokeLinecap="round" fill="none"/>

        {/* Little sleeping 'z Z' details floating */}
        <text x="75" y="25" fontSize="10" fontWeight="900" fontFamily="var(--font-mono)" fill="black" className="animate-pulse">z</text>
        <text x="83" y="16" fontSize="14" fontWeight="900" fontFamily="var(--font-mono)" fill="black" className="animate-pulse delay-100">Z</text>
      </svg>
    </div>
  );
}
