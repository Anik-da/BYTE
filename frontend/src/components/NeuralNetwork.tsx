import { useEffect, useRef, useState } from 'react';
import { fetchSystemTelemetry } from '@/lib/desktopApi';

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  pulse: number;
}

export function NeuralNetwork() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cpuLoad, setCpuLoad] = useState<number>(18);

  useEffect(() => {
    let mounted = true;
    const fetchLiveCpu = async () => {
      const data = await fetchSystemTelemetry();
      if (data && mounted) {
        setCpuLoad(Number(data.cpu_load || 18));
      }
    };
    fetchLiveCpu();
    const interval = setInterval(fetchLiveCpu, 2000);
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
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth || 280;
    const height = canvas.offsetHeight || 140;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const nodeCount = 14;
    const nodes: Node[] = [];
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        pulse: Math.random() * Math.PI * 2,
      });
    }

    const maxDist = 90;

    const draw = () => {
      // Scale animation speed by cpuLoad (normalized around 18-30%)
      const speedFactor = Math.max(0.4, Math.min(3.5, cpuLoad / 20.0));
      t += 0.016 * speedFactor;
      ctx.clearRect(0, 0, width, height);

      // Update nodes
      for (const n of nodes) {
        n.x += n.vx * speedFactor;
        n.y += n.vy * speedFactor;
        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;
        n.pulse += 0.03 * speedFactor;
      }

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.4;
            ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();

            // Animated pulse along the line
            const pulsePos = ((t + i * 0.3) % 1);
            const px = nodes[i].x + (nodes[j].x - nodes[i].x) * pulsePos;
            const py = nodes[i].y + (nodes[j].y - nodes[i].y) * pulsePos;
            ctx.fillStyle = `rgba(248, 113, 113, ${alpha * 1.5})`;
            ctx.beginPath();
            ctx.arc(px, py, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Draw nodes
      for (const n of nodes) {
        const glow = Math.sin(n.pulse) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(239, 68, 68, ${glow * 0.3})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(239, 68, 68, ${glow})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [cpuLoad]);
  return <canvas ref={canvasRef} className="h-full w-full" />;
}
