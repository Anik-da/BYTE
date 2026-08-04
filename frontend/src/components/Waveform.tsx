import { useEffect, useRef } from 'react';

interface WaveformProps {
  active: boolean;
  color?: 'red' | 'gold' | 'green';
  bars?: number;
}

export function Waveform({ active, color = 'red', bars = 40 }: WaveformProps) {
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
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth || 300;
    const height = canvas.offsetHeight || 60;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const colorMap = {
      red: '239, 68, 68',
      gold: '251, 191, 36',
      green: '248, 113, 113',
    };
    const rgb = colorMap[color];

    const draw = () => {
      t += 0.05;
      ctx.clearRect(0, 0, width, height);
      const a = activeRef.current;
      const barWidth = width / bars;
      for (let i = 0; i < bars; i++) {
        const phase = i / bars;
        let amp: number;
        if (a) {
          amp = (Math.sin(t * 2 + phase * 6) * 0.5 + 0.5) * (Math.sin(t + phase * 3) * 0.4 + 0.6);
        } else {
          amp = Math.sin(t * 0.5 + phase * 4) * 0.1 + 0.12;
        }
        const barHeight = Math.max(2, amp * height * 0.9);
        const x = i * barWidth + barWidth * 0.15;
        const y = (height - barHeight) / 2;
        ctx.fillStyle = `rgba(${rgb}, ${a ? 0.9 : 0.3})`;
        ctx.fillRect(x, y, barWidth * 0.7, barHeight);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [color, bars]);

  return <canvas ref={canvasRef} className="h-full w-full" />;
}
