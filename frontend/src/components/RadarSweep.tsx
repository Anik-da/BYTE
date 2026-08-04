import { useEffect, useRef } from 'react';

interface RadarSweepProps {
  active: boolean;
}

interface Blip {
  angle: number;
  distance: number;
  speed: number;
  life: number;
}

export function RadarSweep({ active }: RadarSweepProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let t = 0;
    const size = 220;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const blips: Blip[] = [];
    let blipTimer = 0;

    const draw = () => {
      t += 0.02;
      ctx.clearRect(0, 0, size, size);
      const cx = size / 2;
      const cy = size / 2;
      const maxR = size / 2 - 10;
      const a = activeRef.current;

      // Background circles
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.15)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (maxR / 4) * i, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Cross lines
      ctx.beginPath();
      ctx.moveTo(cx, cy - maxR);
      ctx.lineTo(cx, cy + maxR);
      ctx.moveTo(cx - maxR, cy);
      ctx.lineTo(cx + maxR, cy);
      ctx.stroke();

      // Diagonal lines
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.08)';
      ctx.beginPath();
      const diag = maxR * 0.707;
      ctx.moveTo(cx - diag, cy - diag);
      ctx.lineTo(cx + diag, cy + diag);
      ctx.moveTo(cx + diag, cy - diag);
      ctx.lineTo(cx - diag, cy + diag);
      ctx.stroke();

      // Sweep
      const sweepAngle = t * 1.2;
      const sweepGrad = ctx.createConicGradient ? ctx.createConicGradient(sweepAngle, cx, cy) : null;
      if (sweepGrad) {
        sweepGrad.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
        sweepGrad.addColorStop(0.08, 'rgba(239, 68, 68, 0)');
        sweepGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = sweepGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Fallback: draw a wedge
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(sweepAngle);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, maxR, -0.3, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Sweep line
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(sweepAngle);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(maxR, 0);
      ctx.stroke();
      ctx.restore();

      // Spawn blips
      if (a) {
        blipTimer += 0.02;
        if (blipTimer > 2.5) {
          blipTimer = 0;
          blips.push({
            angle: Math.random() * Math.PI * 2,
            distance: Math.random() * maxR * 0.85 + 20,
            speed: (Math.random() - 0.5) * 0.01,
            life: 1,
          });
        }
      }

      // Draw blips
      for (let i = blips.length - 1; i >= 0; i--) {
        const b = blips[i];
        b.angle += b.speed;
        b.life -= 0.004;
        if (b.life <= 0) {
          blips.splice(i, 1);
          continue;
        }
        const bx = cx + Math.cos(b.angle) * b.distance;
        const by = cy + Math.sin(b.angle) * b.distance;
        ctx.fillStyle = `rgba(239, 68, 68, ${b.life * 0.9})`;
        ctx.beginPath();
        ctx.arc(bx, by, 3, 0, Math.PI * 2);
        ctx.fill();
        // glow
        ctx.fillStyle = `rgba(239, 68, 68, ${b.life * 0.3})`;
        ctx.beginPath();
        ctx.arc(bx, by, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Center dot
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="flex flex-col items-center">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
