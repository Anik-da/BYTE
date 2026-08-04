import { useEffect, useState } from 'react';
import { Globe2 } from 'lucide-react';

interface CityClock {
  city: string;
  tz: string;
  short: string;
}

const CITIES: CityClock[] = [
  { city: 'New York', tz: 'America/New_York', short: 'NYC' },
  { city: 'London', tz: 'Europe/London', short: 'LDN' },
  { city: 'Tokyo', tz: 'Asia/Tokyo', short: 'TKY' },
  { city: 'Dubai', tz: 'Asia/Dubai', short: 'DXB' },
];

export function WorldClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="hud-panel hud-corner clip-notch p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Globe2 className="h-3.5 w-3.5 text-hud-red" />
        <h3 className="hud-display text-[10px] font-bold tracking-widest text-hud-red hud-glow">
          GLOBAL CLOCK
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {CITIES.map((c) => {
          const time = now.toLocaleTimeString('en-US', {
            timeZone: c.tz,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          });
          return (
            <div key={c.city} className="border border-hud-red/20 bg-hud-red/5 p-1.5 overflow-hidden">
              <div className="hud-text text-[9px] uppercase text-hud-red/60">{c.short}</div>
              <div className="hud-mono text-[11px] font-semibold tracking-tight text-hud-red truncate">{time}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
