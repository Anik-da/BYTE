import { useEffect, useRef } from 'react';

interface ArcReactorProps {
  active: boolean;
  speaking: boolean;
  listening: boolean;
}

export function ArcReactor({ active, speaking, listening }: ArcReactorProps) {
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
    const size = 320;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const draw = () => {
      t += 0.016;
      const { active: a, speaking: s, listening: l } = stateRef.current;
      ctx.clearRect(0, 0, size, size);
      const cx = size / 2;
      const cy = size / 2;

      const baseColor = a ? (l ? '248, 113, 113' : s ? '251, 191, 36' : '239, 68, 68') : '239, 68, 68';
      const pulse = a ? (Math.sin(t * 3) * 0.15 + 0.85) : 0.4;

      // Outer rotating ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.3);
      ctx.strokeStyle = `rgba(${baseColor}, ${0.3 * pulse})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, 150, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Second ring (reverse)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-t * 0.5);
      ctx.strokeStyle = `rgba(${baseColor}, ${0.4 * pulse})`;
      ctx.lineWidth = 1.5;
      const segs = 12;
      for (let i = 0; i < segs; i++) {
        const ang = (i / segs) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(0, 0, 130, ang, ang + 0.35);
        ctx.stroke();
      }
      ctx.restore();

      // Ticks ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.2);
      ctx.strokeStyle = `rgba(${baseColor}, ${0.5 * pulse})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 60; i++) {
        const ang = (i / 60) * Math.PI * 2;
        const len = i % 5 === 0 ? 10 : 5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * 110, Math.sin(ang) * 110);
        ctx.lineTo(Math.cos(ang) * (110 - len), Math.sin(ang) * (110 - len));
        ctx.stroke();
      }
      ctx.restore();

      // Inner segmented ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-t * 0.7);
      ctx.strokeStyle = `rgba(${baseColor}, ${0.6 * pulse})`;
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(0, 0, 88, ang, ang + 0.7);
        ctx.stroke();
      }
      ctx.restore();

      // Core glow
      const coreRadius = 38 + (s ? Math.sin(t * 8) * 6 : 0) + (l ? Math.sin(t * 6) * 4 : 0);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius * 2);
      grad.addColorStop(0, `rgba(${baseColor}, ${0.9 * pulse})`);
      grad.addColorStop(0.4, `rgba(${baseColor}, ${0.4 * pulse})`);
      grad.addColorStop(1, `rgba(${baseColor}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius * 2, 0, Math.PI * 2);
      ctx.fill();

      // Core hexagon (BYTE emblem)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.4);
      ctx.strokeStyle = `rgba(${baseColor}, ${0.9 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const hexR = 30;
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(ang) * hexR;
        const y = Math.sin(ang) * hexR;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      // inner hexagon
      ctx.beginPath();
      const hexR2 = 16;
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

      // Core fill
      ctx.fillStyle = `rgba(${baseColor}, ${0.15 * pulse})`;
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
      ctx.fill();

      // Core border
      ctx.strokeStyle = `rgba(${baseColor}, ${0.8 * pulse})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Energy spokes when speaking/listening
      if (s || l) {
        const spokes = l ? 8 : 5;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * (l ? 1.5 : -1.2));
        ctx.strokeStyle = `rgba(${baseColor}, ${0.5 * pulse})`;
        ctx.lineWidth = 1;
        for (let i = 0; i < spokes; i++) {
          const ang = (i / spokes) * Math.PI * 2;
          const len = 60 + Math.sin(t * 4 + i) * 20;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * coreRadius, Math.sin(ang) * coreRadius);
          ctx.lineTo(Math.cos(ang) * (coreRadius + len), Math.sin(ang) * (coreRadius + len));
          ctx.stroke();
        }
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative flex items-center justify-center">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
