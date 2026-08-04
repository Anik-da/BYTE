import { useEffect, useState } from 'react';
import { Activity, Cpu, Wifi, Shield, Clock, Sliders } from 'lucide-react';

export function StatusBar({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="hud-panel hud-corner flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-hud-success animate-pulse" />
          <span className="hud-mono text-[10px] uppercase text-hud-success">Active</span>
        </div>
        <div className="hidden items-center gap-1.5 sm:flex">
          <Cpu className="h-3.5 w-3.5 text-hud-red" />
          <span className="hud-mono text-[10px] text-hud-red/70">CORE-7</span>
        </div>
        <div className="hidden items-center gap-1.5 sm:flex">
          <Wifi className="h-3.5 w-3.5 text-hud-red" />
          <span className="hud-mono text-[10px] text-hud-red/70">LINK</span>
        </div>
        <div className="hidden items-center gap-1.5 md:flex">
          <Shield className="h-3.5 w-3.5 text-hud-success" />
          <span className="hud-mono text-[10px] text-hud-red/70">SECURE</span>
        </div>
      </div>

      <div className="hud-display text-xs font-bold tracking-[0.25em] text-hud-red hud-glow">
        BYTE
      </div>

      <div className="flex items-center gap-3">
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1 border border-hud-red/30 bg-hud-red/10 px-2 py-0.5 hud-mono text-[10px] uppercase text-hud-red transition-all hover:bg-hud-red/25"
            title="Open Desktop & AI Settings"
          >
            <Sliders className="h-3 w-3 text-hud-red" />
            <span>Settings</span>
          </button>
        )}
        <div className="hidden items-center gap-1.5 sm:flex">
          <span className="hud-mono text-[10px] text-hud-red/70">
            {now.toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-hud-red" />
          <span className="hud-mono text-[11px] text-hud-red">
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
}
