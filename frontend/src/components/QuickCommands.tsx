import { ScanLine, ShieldAlert, Lock, Satellite, Activity, Zap, Eye, Database } from 'lucide-react';
import { soundFx } from '@/lib/soundFx';

interface QuickCommand {
  label: string;
  command: string;
  icon: typeof ScanLine;
}

const COMMANDS: QuickCommand[] = [
  { label: 'Screen Vision', command: 'analyze active screen window', icon: Eye },
  { label: 'System Scan', command: 'run a full system scan', icon: ScanLine },
  { label: 'Memory Vault', command: 'recall lifetime memory facts', icon: Database },
  { label: 'Lockdown', command: 'initiate system lockdown protocol', icon: Lock },
  { label: 'Threat Radar', command: 'run threat assessment', icon: ShieldAlert },
  { label: 'Satellite Link', command: 'satellite uplink status', icon: Satellite },
  { label: 'Diagnostics', command: 'run hardware diagnostics', icon: Activity },
  { label: 'Power Grid', command: 'power grid status', icon: Zap },
];

interface QuickCommandsProps {
  onCommand: (cmd: string) => void;
}

export function QuickCommands({ onCommand }: QuickCommandsProps) {
  const handleClick = (cmd: string) => {
    soundFx.playBeep(1100, 0.05);
    onCommand(cmd);
  };

  return (
    <div className="hud-panel hud-corner clip-notch p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="hud-display text-[10px] font-bold tracking-widest text-hud-red hud-glow flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-hud-red animate-ping" />
          BYTE TACTICAL PROTOCOLS
        </h3>
        <span className="hud-mono text-[9px] text-hud-red/50">SYSTEM LEVEL: 0</span>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {COMMANDS.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.label}
              onClick={() => handleClick(c.command)}
              className="group flex flex-col items-center justify-center gap-1 border border-hud-red/25 bg-slate-950/70 p-2 transition-all hover:scale-105 hover:border-hud-red hover:bg-hud-red/20 active:scale-95 shadow-lg"
            >
              <Icon className="h-4 w-4 text-hud-red/75 transition-colors group-hover:text-hud-red group-hover:hud-glow" />
              <span className="hud-text text-[9px] uppercase tracking-wider text-hud-red/70 transition-colors group-hover:text-hud-red">
                {c.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
