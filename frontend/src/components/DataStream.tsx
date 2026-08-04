import { useEffect, useRef } from 'react';

interface DataStreamProps {
  lines?: number;
}

const HEX = '0123456789ABCDEF';
const SAMPLES = [
  '0x4A8F2C',
  'PKT:RX',
  '0xAE12',
  'HANDSHAKE',
  '0xFF00',
  'SYN/ACK',
  '0x1C3D',
  'ENCRYPT',
  '0x88B2',
  'ROUTE',
  '0x3F1A',
  'BUFFER',
  '0x9E0C',
  'VERIFY',
  '0x2B47',
  'PING',
  '0x7D33',
  'STREAM',
  '0xC0FF',
  'CHECKSUM',
];

function randomHex(len: number) {
  let s = '';
  for (let i = 0; i < len; i++) s += HEX[Math.floor(Math.random() * 16)];
  return s;
}

export function DataStream({ lines = 8 }: DataStreamProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const interval = setInterval(() => {
      const line = document.createElement('div');
      const sample = SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
      const isHex = sample.startsWith('0x');
      const content = isHex ? `${sample}${randomHex(4)}` : `${sample} ${randomHex(2)}.${randomHex(2)}`;
      line.textContent = content;
      line.className = 'hud-mono text-[10px] text-hud-red/40 whitespace-nowrap';
      container.insertBefore(line, container.firstChild);
      while (container.children.length > lines * 2) {
        container.removeChild(container.lastChild!);
      }
    }, 180);
    return () => clearInterval(interval);
  }, [lines]);

  return (
    <div
      ref={containerRef}
      className="hud-mono space-y-0.5 overflow-hidden text-[10px] leading-tight text-hud-red/40"
    />
  );
}
