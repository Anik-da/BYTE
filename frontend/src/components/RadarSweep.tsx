import { useEffect, useRef, useState } from 'react';
import { fetchSystemTelemetry } from '@/lib/desktopApi';

interface RadarSweepProps {
  active: boolean;
}

interface ConnectionDot {
  ip: string;
  port: number;
  angle: number;
  distance: number;
  status: string;
}

export function RadarSweep({ active }: RadarSweepProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const [connections, setConnections] = useState<ConnectionDot[]>([]);

  useEffect(() => {
    let mounted = true;
    const fetchLiveConns = async () => {
      const data = await fetchSystemTelemetry();
      if (data && data.connections && mounted) {
        setConnections(data.connections);
      }
    };
    fetchLiveConns();
    const interval = setInterval(fetchLiveConns, 2000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

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

    const draw = () => {
      t += 0.02;
      ctx.clearRect(0, 0, size, size);
      const cx = size / 2;
      const cy = size / 2;
      const maxR = size / 2 - 10;

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

      // Draw Live connection blips
      connections.forEach((conn) => {
        const radAngle = (conn.angle * Math.PI) / 180;
        const bx = cx + Math.cos(radAngle) * (conn.distance * maxR);
        const by = cy + Math.sin(radAngle) * (conn.distance * maxR);

        // Blip animation intensity based on sweep angle proximity
        const angleDiff = Math.abs((radAngle - sweepAngle) % (Math.PI * 2));
        const intensity = Math.max(0.1, 1 - angleDiff / (Math.PI / 2));

        // Draw node
        ctx.fillStyle = `rgba(239, 68, 68, ${intensity * 0.95})`;
        ctx.beginPath();
        ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(239, 68, 68, ${intensity * 0.45})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(bx, by, 7, 0, Math.PI * 2);
        ctx.stroke();

        // If sweep is very close, render port and status text dynamically
        if (intensity > 0.8) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
          ctx.font = '7px monospace';
          ctx.fillText(`PORT:${conn.port}`, bx + 6, by - 2);
        }
      });

      // Center dot
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [connections]);
  return (
    <div className="flex flex-col items-center">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
