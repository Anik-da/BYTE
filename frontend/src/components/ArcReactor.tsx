import { useEffect, useRef } from 'react';
import { soundFx } from '@/lib/soundFx';

interface ArcReactorProps {
  active: boolean;
  speaking: boolean;
  listening: boolean;
  onClick?: () => void;
}

interface Particle {
  x: number;
  y: number;
  angle: number;
  radius: number;
  speed: number;
  size: number;
  alpha: number;
}

export function ArcReactor({ active, speaking, listening, onClick }: ArcReactorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ active, speaking, listening });
  stateRef.current = { active, speaking, listening };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let t = 0;
    const size = 340;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    // Initialize orbiting energy particles
    const particles: Particle[] = [];
    for (let i = 0; i < 28; i++) {
      particles.push({
        x: 0,
        y: 0,
        angle: Math.random() * Math.PI * 2,
        radius: 65 + Math.random() * 85,
        speed: (Math.random() * 0.02 + 0.005) * (Math.random() > 0.5 ? 1 : -1),
        size: Math.random() * 2 + 1,
        alpha: Math.random() * 0.7 + 0.3
      });
    }

    const draw = () => {
      t += 0.016;
      const { active: a, speaking: s, listening: l } = stateRef.current;
      ctx.clearRect(0, 0, size, size);
      const cx = size / 2;
      const cy = size / 2;

      // Color scheme: Cyan when listening, Amber when speaking, Crimson Red standard
      const baseColor = l ? '56, 189, 248' : s ? '251, 191, 36' : a ? '248, 113, 113' : '239, 68, 68';
      const pulseSpeed = s ? 8 : l ? 6 : 2.5;
      const pulse = a ? Math.sin(t * pulseSpeed) * 0.2 + 0.8 : 0.45;

      // 1. Ambient Background Halo Gradient
      const haloGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, 160);
      haloGrad.addColorStop(0, `rgba(${baseColor}, ${0.15 * pulse})`);
      haloGrad.addColorStop(0.6, `rgba(${baseColor}, ${0.05 * pulse})`);
      haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, 160, 0, Math.PI * 2);
      ctx.fill();

      // 2. Audio Equalizer Wave Ring
      ctx.save();
      ctx.translate(cx, cy);
      const numBars = 48;
      for (let i = 0; i < numBars; i++) {
        const ang = (i / numBars) * Math.PI * 2 + t * 0.2;
        const wave = Math.sin(t * 10 + i * 0.5) * (s ? 14 : l ? 10 : 3);
        const h = Math.max(3, 8 + wave);
        const rInner = 142;
        const rOuter = rInner + h;

        ctx.strokeStyle = `rgba(${baseColor}, ${0.4 * pulse})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * rInner, Math.sin(ang) * rInner);
        ctx.lineTo(Math.cos(ang) * rOuter, Math.sin(ang) * rOuter);
        ctx.stroke();
      }
      ctx.restore();

      // 3. Outer rotating dashed HUD ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.35);
      ctx.strokeStyle = `rgba(${baseColor}, ${0.35 * pulse})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 12]);
      ctx.beginPath();
      ctx.arc(0, 0, 132, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // 4. Reverse Rotating Segment Ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-t * 0.6);
      ctx.strokeStyle = `rgba(${baseColor}, ${0.5 * pulse})`;
      ctx.lineWidth = 2;
      const segs = 8;
      for (let i = 0; i < segs; i++) {
        const ang = (i / segs) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(0, 0, 114, ang, ang + 0.45);
        ctx.stroke();
      }
      ctx.restore();

      // 5. Orbiting energy particles
      particles.forEach((p) => {
        p.angle += p.speed * (s ? 2.5 : 1);
        const px = cx + Math.cos(p.angle) * p.radius;
        const py = cy + Math.sin(p.angle) * p.radius;
        ctx.fillStyle = `rgba(${baseColor}, ${p.alpha * pulse})`;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // 6. Precision HUD Ticks Ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.15);
      ctx.strokeStyle = `rgba(${baseColor}, ${0.6 * pulse})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 60; i++) {
        const ang = (i / 60) * Math.PI * 2;
        const len = i % 5 === 0 ? 10 : 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * 96, Math.sin(ang) * 96);
        ctx.lineTo(Math.cos(ang) * (96 - len), Math.sin(ang) * (96 - len));
        ctx.stroke();
      }
      ctx.restore();

      // 7. Core Pulsing Glow
      const coreRadius = 42 + (s ? Math.sin(t * 9) * 8 : 0) + (l ? Math.sin(t * 7) * 5 : 0);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius * 2);
      grad.addColorStop(0, `rgba(${baseColor}, ${0.95 * pulse})`);
      grad.addColorStop(0.35, `rgba(${baseColor}, ${0.45 * pulse})`);
      grad.addColorStop(1, `rgba(${baseColor}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius * 2, 0, Math.PI * 2);
      ctx.fill();

      // 8. Dual Hexagon Emblem (JARVIS Core)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.45);
      ctx.strokeStyle = `rgba(${baseColor}, ${0.9 * pulse})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      const hexR = 32;
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(ang) * hexR;
        const y = Math.sin(ang) * hexR;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();

      // Inner Counter-rotating Hexagon
      ctx.rotate(-t * 0.9);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.85 * pulse})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const hexR2 = 18;
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(ang) * hexR2;
        const y = Math.sin(ang) * hexR2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // 9. Core Border
      ctx.strokeStyle = `rgba(${baseColor}, ${0.95 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleClick = () => {
    soundFx.playBeep(980, 0.05);
    onClick?.();
  };

  return (
    <div
      onClick={handleClick}
      title="Click to interact with JARVIS Core"
      className="relative flex cursor-pointer items-center justify-center transition-transform hover:scale-105 active:scale-95"
    >
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
