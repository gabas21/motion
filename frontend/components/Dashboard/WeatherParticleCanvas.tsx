import React, { useEffect, useRef } from 'react';
import { WeatherTheme } from '../../lib/weather-utils';

interface WeatherParticleCanvasProps {
  type: WeatherTheme['particleType'];
}

export const WeatherParticleCanvas = React.memo(function WeatherParticleCanvas({ type }: WeatherParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let resizeTimeout: NodeJS.Timeout;

    const resize = () => {
      if (!canvas) return;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    resize();

    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resize, 150);
    };

    window.addEventListener('resize', handleResize);

    // Create particles based on weather type (optimized counts)
    interface Particle {
      x: number; y: number; vx: number; vy: number;
      size: number; opacity: number; color?: string; angle?: number;
    }
    const particles: Particle[] = [];

    if (type === 'rain') {
      for (let i = 0; i < 60; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: -1.5,
          vy: 14 + Math.random() * 8,
          size: 1 + Math.random() * 1.2,
          opacity: 0.15 + Math.random() * 0.3,
        });
      }
    } else if (type === 'snow') {
      for (let i = 0; i < 40; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: 0.5 + Math.random() * 1.5,
          size: 2 + Math.random() * 4,
          opacity: 0.5 + Math.random() * 0.4,
        });
      }
    } else if (type === 'sun') {
      // Floating golden motes
      for (let i = 0; i < 20; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: -0.2 - Math.random() * 0.5,
          size: 2 + Math.random() * 5,
          opacity: 0.08 + Math.random() * 0.18,
          color: '#FBBF24',
        });
      }
    } else if (type === 'clear-night') {
      // Twinkling stars
      for (let i = 0; i < 60; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: 0,
          vy: 0,
          size: 0.5 + Math.random() * 2.5,
          opacity: 0.2 + Math.random() * 0.8,
          color: i % 5 === 0 ? '#A78BFA' : '#FFFFFF',
        });
      }
    } else if (type === 'fog') {
      // Drifting fog blobs
      for (let i = 0; i < 6; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: 20 + Math.random() * canvas.height * 0.8,
          vx: 0.2 + Math.random() * 0.4,
          vy: 0,
          size: 80 + Math.random() * 120,
          opacity: 0.04 + Math.random() * 0.07,
        });
      }
    } else if (type === 'wind') {
      // Diagonal streaks
      for (let i = 0; i < 30; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: 3 + Math.random() * 4,
          vy: (Math.random() - 0.5) * 0.5,
          size: 40 + Math.random() * 80,
          opacity: 0.04 + Math.random() * 0.08,
        });
      }
    } else if (type === 'thunder') {
      // Sparse dark rain + lightning flashes handled in DOM
      for (let i = 0; i < 50; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: -2,
          vy: 16 + Math.random() * 10,
          size: 1 + Math.random() * 0.8,
          opacity: 0.08 + Math.random() * 0.15,
          color: '#6B7280',
        });
      }
    } else if (type === 'partly-cloudy') {
      // Light floating particles
      for (let i = 0; i < 12; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -0.1 - Math.random() * 0.3,
          size: 3 + Math.random() * 6,
          opacity: 0.07 + Math.random() * 0.12,
          color: '#38BDF8',
        });
      }
    } else if (type === 'cloud') {
      for (let i = 0; i < 6; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: 10 + Math.random() * canvas.height * 0.7,
          vx: 0.15 + Math.random() * 0.25,
          vy: 0,
          size: 60 + Math.random() * 100,
          opacity: 0.06 + Math.random() * 0.09,
        });
      }
    }

    let lightningTimer = 0;
    let lightningFlash = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Lightning flash effect for thunder
      if (type === 'thunder') {
        lightningTimer++;
        if (lightningTimer > 180 + Math.random() * 300) {
          lightningFlash = 8;
          lightningTimer = 0;
        }
        if (lightningFlash > 0) {
          ctx.fillStyle = `rgba(255, 240, 180, ${lightningFlash * 0.03})`;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          lightningFlash--;
        }
      }

      for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = p.opacity;

        if (type === 'rain' || type === 'thunder') {
          // Draw rain drop lines
          ctx.strokeStyle = p.color || '#93C5FD';
          ctx.lineWidth = p.size;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 2, p.y + p.vy * 2);
          ctx.stroke();
          p.x += p.vx;
          p.y += p.vy;
          if (p.y > canvas.height) {
            p.y = -20;
            p.x = Math.random() * canvas.width;
          }
        } else if (type === 'snow') {
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          p.x += p.vx + Math.sin(Date.now() * 0.001 + p.y * 0.05) * 0.3;
          p.y += p.vy;
          if (p.y > canvas.height) {
            p.y = -10;
            p.x = Math.random() * canvas.width;
          }
        } else if (type === 'sun') {
          ctx.fillStyle = p.color || '#FBBF24';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          p.x += p.vx;
          p.y += p.vy;
          if (p.y < -20) {
            p.y = canvas.height + 10;
            p.x = Math.random() * canvas.width;
          }
        } else if (type === 'clear-night') {
          // Twinkling star
          const twinkle = 0.5 + 0.5 * Math.sin(Date.now() * 0.002 + p.x * 0.01 + p.y * 0.01);
          ctx.globalAlpha = p.opacity * twinkle;
          ctx.fillStyle = p.color || '#FFFFFF';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (type === 'fog') {
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          grad.addColorStop(0, 'rgba(209, 213, 219, 0.8)');
          grad.addColorStop(1, 'rgba(209, 213, 219, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          p.x += p.vx;
          if (p.x > canvas.width + p.size) {
            p.x = -p.size;
          }
        } else if (type === 'wind') {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.size, p.y + p.vy * 10);
          ctx.stroke();
          p.x += p.vx;
          if (p.x > canvas.width + p.size) {
            p.x = -p.size;
            p.y = Math.random() * canvas.height;
          }
        } else if (type === 'partly-cloudy') {
          ctx.fillStyle = p.color || '#93C5FD';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          p.x += p.vx;
          p.y += p.vy;
          if (p.y < -20) {
            p.y = canvas.height + 10;
            p.x = Math.random() * canvas.width;
          }
        } else if (type === 'cloud') {
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          grad.addColorStop(0, 'rgba(148, 163, 184, 0.7)');
          grad.addColorStop(1, 'rgba(148, 163, 184, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          p.x += p.vx;
          if (p.x > canvas.width + p.size) {
            p.x = -p.size;
            p.y = 10 + Math.random() * canvas.height * 0.7;
          }
        }

        ctx.restore();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [type]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 1 }}
    />
  );
});
