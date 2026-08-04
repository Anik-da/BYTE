import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface DiagItem {
  name: string;
  status: 'pending' | 'running' | 'pass' | 'fail';
  detail: string;
}

const ITEMS: Omit<DiagItem, 'status'>[] = [
  { name: 'Neural Core', detail: '12.4 TFLOPS' },
  { name: 'Voice Synthesis', detail: '44.1kHz / 16-bit' },
  { name: 'Power Core', detail: '8.2 GJ capacity' },
  { name: 'Sensor Array', detail: '14 channels active' },
  { name: 'HUD Uplink', detail: '60fps stable' },
  { name: 'Security Protocols', detail: 'AES-256 engaged' },
  { name: 'Memory Banks', detail: '2.1 PB allocated' },
  { name: 'Network Stack', detail: 'Latency 12ms' },
  { name: 'Quantum Substrate', detail: '4096 qubits' },
  { name: 'Satellite Uplink', detail: '3 satellites linked' },
];

export function DiagnosticsOverlay({ onComplete }: { onComplete: () => void }) {
  const [items, setItems] = useState<DiagItem[]>(
    ITEMS.map((i) => ({ ...i, status: 'pending' as const })),
  );

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setItems((prev) => {
        const next = [...prev];
        if (i < next.length) {
          next[i] = { ...next[i], status: 'running' as const };
        }
        if (i > 0 && i - 1 < next.length) {
          next[i - 1] = {
            ...next[i - 1],
            status: Math.random() > 0.1 ? ('pass' as const) : ('fail' as const),
          };
        }
        return next;
      });
      i += 1;
      if (i > ITEMS.length) {
        clearInterval(interval);
        setItems((prev) => prev.map((x) => (x.status === 'running' ? { ...x, status: 'pass' as const } : x)));
        setTimeout(onComplete, 1200);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="hud-panel hud-corner clip-notch w-full max-w-md p-6">
        <h2 className="hud-display mb-4 text-center text-sm font-bold tracking-widest text-hud-red hud-glow">
          FULL SYSTEM DIAGNOSTICS
        </h2>
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between border-b border-hud-red/10 pb-1.5"
            >
              <div className="flex items-center gap-2">
                {item.status === 'pending' && <div className="h-4 w-4" />}
                {item.status === 'running' && (
                  <Loader2 className="h-4 w-4 animate-spin text-hud-gold" />
                )}
                {item.status === 'pass' && (
                  <CheckCircle2 className="h-4 w-4 text-hud-success" />
                )}
                {item.status === 'fail' && <XCircle className="h-4 w-4 text-hud-danger" />}
                <span className="hud-text text-sm text-red-50">{item.name}</span>
              </div>
              <span className="hud-mono text-[10px] text-hud-red/50">{item.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
