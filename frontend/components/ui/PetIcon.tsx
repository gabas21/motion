'use client';

import React from 'react';

export const PET_STATES = {
  idle: 0,       // Row 0: Idle (6 frames)
  runRight: 1,   // Row 1: Run Right (8 frames)
  runLeft: 2,    // Row 2: Run Left (8 frames)
  waving: 3,     // Row 3: Waving (4 frames)
  jumping: 4,    // Row 4: Jumping (5 frames)
  failed: 5,     // Row 5: Failed (8 frames)
  waiting: 6,    // Row 6: Waiting (6 frames)
  running: 7,    // Row 7: Running (6 frames)
  review: 8,     // Row 8: Review (6 frames)
  
  // Backward compatibility mappings
  run: 7,
  sleep: 6,
  eat: 3,
  attack: 1,
  jump: 4,
  play: 3,
};

export type PetState = keyof typeof PET_STATES;

export const DEFAULT_STATE_FRAMES: Record<PetState, number> = {
  idle: 6,
  runRight: 8,
  runLeft: 8,
  waving: 4,
  jumping: 5,
  failed: 8,
  waiting: 6,
  running: 6,
  review: 6,
  
  // Backward compatibility mappings
  run: 6,
  sleep: 6,
  eat: 4,
  attack: 8,
  jump: 5,
  play: 4,
};

interface PetIconProps {
  state?: PetState;
  size?: number; // width in pixels
  className?: string;
  onClick?: () => void;
  frames?: Partial<Record<PetState, number>>;
}

export default function PetIcon({
  state = 'idle',
  size = 48,
  className = '',
  onClick,
  frames,
}: PetIconProps) {
  const row = PET_STATES[state] ?? 0;
  const maxFrames = frames?.[state] ?? DEFAULT_STATE_FRAMES[state] ?? 8;

  // Original aspect ratio is 192:208 (12:13)
  const width = size;
  const height = Math.round((size * 208) / 192);

  // Total background dimensions based on container scale (spritesheet is always 8 columns)
  const bgWidth = width * 8;
  const bgHeight = height * 9;

  // Y coordinate position for the row (state)
  const posY = -row * height;

  // X coordinate position offset to move across active frames (for fallback)
  const targetX = -width * maxFrames;

  // Unique animation identifier based on width, row, and active frames count (for fallback)
  const animName = `pet-play-${width}-${row}-${maxFrames}`;

  const isStatic = maxFrames === 4 || maxFrames === 5 || maxFrames === 6 || maxFrames === 8;
  const animClass = 
    maxFrames === 4 ? 'pet-anim-4' : 
    maxFrames === 5 ? 'pet-anim-5' : 
    maxFrames === 6 ? 'pet-anim-6' : 
    maxFrames === 8 ? 'pet-anim-8' : 
    maxFrames > 1 ? `pet-anim-custom-${animName}` : '';

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden select-none shrink-0 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      <div
        className={`w-full h-full bg-no-repeat ${animClass}`}
        style={{
          backgroundImage: `url('/assets/eve-spritesheet.webp')`,
          backgroundSize: `${bgWidth}px ${bgHeight}px`,
          backgroundPosition: `0px ${posY}px`,
        }}
      />
      <style
        dangerouslySetInnerHTML={{
          __html: `
            /* Static animations based on percentage background-position-x */
            @keyframes pet-play-4 {
              from {
                background-position-x: 0%;
              }
              to {
                background-position-x: 57.142857%; /* (4/7)*100% */
              }
            }
            @keyframes pet-play-5 {
              from {
                background-position-x: 0%;
              }
              to {
                background-position-x: 71.428571%; /* (5/7)*100% */
              }
            }
            @keyframes pet-play-6 {
              from {
                background-position-x: 0%;
              }
              to {
                background-position-x: 85.714285%; /* (6/7)*100% */
              }
            }
            @keyframes pet-play-8 {
              from {
                background-position-x: 0%;
              }
              to {
                background-position-x: 114.285714%; /* (8/7)*100% */
              }
            }
            .pet-anim-4 {
              animation: pet-play-4 0.8s steps(4) infinite;
            }
            .pet-anim-5 {
              animation: pet-play-5 0.8s steps(5) infinite;
            }
            .pet-anim-6 {
              animation: pet-play-6 0.8s steps(6) infinite;
            }
            .pet-anim-8 {
              animation: pet-play-8 0.8s steps(8) infinite;
            }

            ${!isStatic && maxFrames > 1 ? `
            @keyframes ${animName} {
              from {
                background-position: 0px ${posY}px;
              }
              to {
                background-position: ${targetX}px ${posY}px;
              }
            }
            .pet-anim-custom-${animName} {
              animation: ${animName} 0.8s steps(${maxFrames}) infinite;
            }
            ` : ''}
          `,
        }}
      />
    </div>
  );
}
