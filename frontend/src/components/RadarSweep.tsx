import { useEffect, useRef } from 'react';
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

interface NearbyDevice {
  name: string;
  type: 'wifi' | 'bluetooth';
  signal: number;
  mac?: string;
  angle: number;
  distance: number;
}

export function RadarSweep({ active }: RadarSweepProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const connectionsRef = useRef<ConnectionDot[]>([]);
  const nearbyDevicesRef = useRef<NearbyDevice[]>([]);

  // Poll connections and nearby devices into refs — never triggers canvas re-init
  useEffect(() => {
    let mounted = true;
    const fetchLiveTelemetry = async () => {
      const data = await fetchSystemTelemetry();
      if (data && mounted) {
        if (data.connections) {
          connectionsRef.current = data.connections;
        }
        if (data.nearby_devices) {
          nearbyDevicesRef.current = data.nearby_devices;
        }
      }
    };
    fetchLiveTelemetry();
    const interval = setInterval(fetchLiveTelemetry, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Single persistent animation loop — never restarts
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
      const sweepGrad = ctx.createConicGradient
        ? ctx.createConicGradient(sweepAngle, cx, cy)
        : null;
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

      const sweepNorm = ((sweepAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

      // 1. Draw Live connection blips (RED)
      const conns = connectionsRef.current;
      for (const conn of conns) {
        const radAngle = (conn.angle * Math.PI) / 180;
        const bx = cx + Math.cos(radAngle) * (conn.distance * maxR);
        const by = cy + Math.sin(radAngle) * (conn.distance * maxR);

        const blipNorm = ((radAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        let diff = sweepNorm - blipNorm;
        if (diff < 0) diff += Math.PI * 2;
        const intensity = diff < Math.PI ? Math.max(0.15, 1 - diff / Math.PI) : 0.15;

        ctx.strokeStyle = `rgba(239, 68, 68, ${intensity * 0.4})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(bx, by, 7, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = `rgba(239, 68, 68, ${intensity * 0.95})`;
        ctx.beginPath();
        ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
        ctx.fill();

        if (intensity > 0.7) {
          ctx.fillStyle = `rgba(239, 68, 68, ${intensity * 0.7})`;
          ctx.font = '7px "Share Tech Mono", monospace';
          ctx.fillText(`:${conn.port}`, bx + 8, by + 3);
        }
      }

      // 2. Draw Nearby WIFI & Bluetooth devices (Cyan for Wifi, Pink/Magenta for Bluetooth)
      const devices = nearbyDevicesRef.current;
      for (const dev of devices) {
        const radAngle = (dev.angle * Math.PI) / 180;
        const bx = cx + Math.cos(radAngle) * (dev.distance * maxR);
        const by = cy + Math.sin(radAngle) * (dev.distance * maxR);

        const blipNorm = ((radAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        let diff = sweepNorm - blipNorm;
        if (diff < 0) diff += Math.PI * 2;
        const intensity = diff < Math.PI ? Math.max(0.15, 1 - diff / Math.PI) : 0.15;

        // Choose color palette based on device type
        const isWifi = dev.type === 'wifi';
        const colorPrefix = isWifi ? '6, 182, 212' : '236, 72, 153'; // cyan-500 or pink-500

        ctx.strokeStyle = `rgba(${colorPrefix}, ${intensity * 0.45})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(bx, by, 8, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = `rgba(${colorPrefix}, ${intensity * 0.95})`;
        ctx.beginPath();
        ctx.arc(bx, by, 4, 0, Math.PI * 2);
        ctx.fill();

        if (intensity > 0.7) {
          ctx.fillStyle = `rgba(${colorPrefix}, ${intensity * 0.8})`;
          ctx.font = '7px "Share Tech Mono", monospace';
          const labelPrefix = isWifi ? 'WiFi:' : 'BT:';
          const nameTrim = dev.name.length > 8 ? dev.name.slice(0, 8) + '..' : dev.name;
          ctx.fillText(`${labelPrefix}${nameTrim}`, bx + 10, by + 3);
        }
      }

      // Center dot
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, []); // empty deps = never restarts

  return (
    <div className="flex flex-col items-center">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
