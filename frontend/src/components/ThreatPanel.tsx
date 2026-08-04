import { useEffect, useState } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Crosshair, Eye, Lock } from 'lucide-react';

type ThreatLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

interface ThreatState {
  level: ThreatLevel;
  contacts: number;
  perimeter: number;
  integrity: number;
}

export function ThreatPanel() {
  const [state, setState] = useState<ThreatState>({
    level: 'GREEN',
    contacts: 0,
    perimeter: 100,
    integrity: 100,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setState((prev) => {
        const newContacts = Math.max(0, prev.contacts + (Math.random() > 0.7 ? 1 : 0) - (Math.random() > 0.8 ? 1 : 0));
        const newPerimeter = Math.max(85, Math.min(100, prev.perimeter + (Math.random() - 0.5) * 2));
        const newIntegrity = Math.max(90, Math.min(100, prev.integrity + (Math.random() - 0.5) * 1));
        const level: ThreatLevel =
          newContacts >= 5 ? 'RED' : newContacts >= 3 ? 'ORANGE' : newContacts >= 1 ? 'YELLOW' : 'GREEN';
        return { level, contacts: newContacts, perimeter: newPerimeter, integrity: newIntegrity };
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const levelColor = {
    GREEN: 'text-hud-success',
    YELLOW: 'text-hud-warning',
    ORANGE: 'text-orange-400',
    RED: 'text-hud-danger',
  }[state.level];

  const levelBg = {
    GREEN: 'border-hud-success/40 bg-hud-success/10',
    YELLOW: 'border-hud-warning/40 bg-hud-warning/10',
    ORANGE: 'border-orange-400/40 bg-orange-400/10',
    RED: 'border-hud-danger/40 bg-hud-danger/10',
  }[state.level];

  const Icon = state.level === 'GREEN' ? ShieldCheck : state.level === 'RED' ? ShieldAlert : Shield;

  return (
    <div className="hud-panel hud-corner clip-notch p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="hud-display text-[10px] font-bold tracking-widest text-hud-red hud-glow">
          THREAT ASSESSMENT
        </h3>
        <Icon className={`h-4 w-4 ${levelColor}`} />
      </div>

      <div className={`mb-2 border ${levelBg} px-2 py-1 text-center`}>
        <span className={`hud-display text-sm font-bold tracking-widest ${levelColor}`}>
          LEVEL: {state.level}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="hud-text text-[10px] uppercase text-hud-red/60">
            <Crosshair className="mr-1 inline h-3 w-3" />
            Hostile Contacts
          </span>
          <span className="hud-mono text-xs text-hud-red">{state.contacts}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="hud-text text-[10px] uppercase text-hud-red/60">
            <Eye className="mr-1 inline h-3 w-3" />
            Perimeter
          </span>
          <span className="hud-mono text-xs text-hud-red">{state.perimeter.toFixed(0)}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="hud-text text-[10px] uppercase text-hud-red/60">
            <Lock className="mr-1 inline h-3 w-3" />
            Integrity
          </span>
          <span className="hud-mono text-xs text-hud-red">{state.integrity.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}
