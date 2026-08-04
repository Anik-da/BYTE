import { useEffect, useState } from 'react';

const BOOT_LINES = [
  'INITIALIZING BYTE CORE...',
  'Loading neural pathways........[OK]',
  'Calibrating voice synthesis....[OK]',
  'Mounting power core............[OK]',
  'Establishing HUD uplink.......[OK]',
  'Activating sensor array.......[OK]',
  'Synchronizing diagnostics.....[OK]',
  'Loading tactical protocols....[OK]',
  'Engaging quantum substrate....[OK]',
  'Bringing all systems online....[OK]',
];

export function BootSequence({ onComplete }: { onComplete: () => void }) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let lineIndex = 0;
    const interval = setInterval(() => {
      lineIndex += 1;
      setVisibleLines(lineIndex);
      setProgress(Math.round((lineIndex / BOOT_LINES.length) * 100));
      if (lineIndex >= BOOT_LINES.length) {
        clearInterval(interval);
        setTimeout(() => setDone(true), 600);
      }
    }, 280);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(onComplete, 900);
    return () => clearTimeout(t);
  }, [done, onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-radial-fade bg-grid animate-fade-in">
      {/* Decorative corner brackets */}
      <div className="pointer-events-none absolute left-8 top-8 h-16 w-16 border-l-2 border-t-2 border-hud-red/40" />
      <div className="pointer-events-none absolute right-8 top-8 h-16 w-16 border-r-2 border-t-2 border-hud-red/40" />
      <div className="pointer-events-none absolute bottom-8 left-8 h-16 w-16 border-b-2 border-l-2 border-hud-red/40" />
      <div className="pointer-events-none absolute bottom-8 right-8 h-16 w-16 border-b-2 border-r-2 border-hud-red/40" />

      <div className="w-full max-w-2xl px-6">
        <div className="mb-8 text-center">
          <div className="mb-2 hud-mono text-xs tracking-[0.3em] text-hud-red/50">
            BEYOND YOUR TACTICAL ENVELOPE
          </div>
          <h1 className="hud-display text-5xl font-black tracking-[0.3em] text-hud-red hud-glow-strong sm:text-7xl">
            BYTE
          </h1>
        </div>

        <div className="hud-panel hud-corner clip-notch p-5 font-mono text-sm leading-relaxed">
          {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
            <div key={i} className="animate-slide-up text-hud-red/90">
              <span className="text-hud-red/60">&gt;</span> {line}
            </div>
          ))}
          {visibleLines < BOOT_LINES.length && (
            <div className="mt-1 inline-block h-4 w-2 animate-pulse bg-hud-red" />
          )}

          <div className="mt-5">
            <div className="mb-1 flex justify-between text-xs text-hud-red/60">
              <span>SYSTEM BOOT</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden bg-hud-red/10">
              <div
                className="h-full bg-gradient-to-r from-hud-blood to-hud-red transition-all duration-300"
                style={{ width: `${progress}%`, boxShadow: '0 0 10px rgba(239,68,68,0.8)' }}
              />
            </div>
          </div>

          {done && (
            <div className="mt-5 animate-fade-in text-center text-hud-success hud-glow">
              ALL SYSTEMS ONLINE
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
