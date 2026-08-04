import { useEffect, useRef, useState } from 'react';

export interface EventEntry {
  id: string;
  time: string;
  text: string;
  level: 'info' | 'warn' | 'critical';
}

const EVENT_TEMPLATES = [
  { text: 'Sensor sweep complete — sector {n}', level: 'info' as const },
  { text: 'Packet relay confirmed — channel {n}', level: 'info' as const },
  { text: 'Biometric handshake verified', level: 'info' as const },
  { text: 'Anomalous signal detected — band {n}', level: 'warn' as const },
  { text: 'Encryption layer rotated', level: 'info' as const },
  { text: 'Satellite uplink reestablished — SAT-{n}', level: 'info' as const },
  { text: 'Perimeter breach attempt blocked', level: 'critical' as const },
  { text: 'Quantum entanglement recalibrated', level: 'info' as const },
  { text: 'Threat vector identified — bearing {n}', level: 'warn' as const },
  { text: 'Firewall rule set updated', level: 'info' as const },
  { text: 'Decryption pipeline flushed', level: 'info' as const },
  { text: 'Unauthorized access attempt — denied', level: 'critical' as const },
];

function makeEvent(): EventEntry {
  const tmpl = EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)];
  const text = tmpl.text.replace('{n}', String(Math.floor(Math.random() * 9000 + 100)));
  return {
    id: Math.random().toString(36).slice(2),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    text,
    level: tmpl.level,
  };
}

export function EventLog() {
  const [events, setEvents] = useState<EventEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Seed with a few events
    setEvents(Array.from({ length: 6 }, makeEvent));

    const interval = setInterval(() => {
      setEvents((prev) => [...prev.slice(-30), makeEvent()]);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [events]);

  const levelColor = {
    info: 'text-hud-red/60',
    warn: 'text-hud-warning',
    critical: 'text-hud-danger',
  };

  return (
    <div className="hud-panel hud-corner clip-notch flex h-full flex-col p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="hud-display text-[10px] font-bold tracking-widest text-hud-red hud-glow">
          EVENT LOG
        </h3>
        <span className="hud-mono text-[9px] text-hud-red/40">LIVE</span>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto pr-1">
        {events.map((e) => (
          <div key={e.id} className="flex items-start gap-1.5 animate-slide-up">
            <span className="hud-mono text-[10px] text-hud-red/30">{e.time}</span>
            <span className={`hud-mono text-[10px] ${levelColor[e.level]}`}>
              {e.level === 'critical' ? '!' : e.level === 'warn' ? '*' : '>'}
            </span>
            <span className={`hud-mono text-[10px] ${levelColor[e.level]}`}>{e.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
