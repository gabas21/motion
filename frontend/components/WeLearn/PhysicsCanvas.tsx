import React, { useEffect, useRef } from 'react';

interface PhysicsCanvasProps {
  count: number;
  color: string;
}

export function PhysicsCanvas({ count, color }: PhysicsCanvasProps) {
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

      if (document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }

      animationFrameId = requestAnimationFrame(update);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationFrameId);
      } else {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(update);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    update();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (parent) {
        parent.removeEventListener('mousemove', handleMouseMove);
        parent.removeEventListener('mouseleave', handleMouseLeave);
        parent.removeEventListener('click', handleClick);
      }
    };
  }, [count, color]);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />;
}

interface SyncPhysicsCanvasProps {
  isAttracting: boolean;
  targetRef: React.RefObject<HTMLSpanElement | null>;
  color?: string;
  count?: number;
}

export function SyncPhysicsCanvas({
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

      if (document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }

      animationFrameId = requestAnimationFrame(update);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationFrameId);
      } else {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(update);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    update();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (parent) {
        parent.removeEventListener('mousemove', handleMouseMove);
        parent.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [count, color, isAttracting, targetRef]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />;
}
