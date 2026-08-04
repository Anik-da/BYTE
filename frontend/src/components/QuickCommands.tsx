import { ScanLine, ShieldAlert, Lock, KeyRound, Satellite, Activity, Zap, Brain } from 'lucide-react';

interface QuickCommand {
  label: string;
  command: string;
  icon: typeof ScanLine;
}

const COMMANDS: QuickCommand[] = [
  { label: 'Scan', command: 'run a scan', icon: ScanLine },
  { label: 'Lockdown', command: 'initiate lockdown', icon: Lock },
  { label: 'Decrypt', command: 'decrypt signal', icon: KeyRound },
  { label: 'Threat', command: 'threat assessment', icon: ShieldAlert },
  { label: 'Satellite', command: 'satellite uplink status', icon: Satellite },
  { label: 'Diagnostics', command: 'run diagnostics', icon: Activity },
  { label: 'Power', command: 'power status', icon: Zap },
  { label: 'Quantum', command: 'quantum core status', icon: Brain },
];

interface QuickCommandsProps {
  onCommand: (cmd: string) => void;
}

export function QuickCommands({ onCommand }: QuickCommandsProps) {
  return (
    <div className="hud-panel hud-corner clip-notch p-3">
      <h3 className="hud-display mb-2 text-[10px] font-bold tracking-widest text-hud-red hud-glow">
        QUICK PROTOCOLS
      </h3>
      <div className="grid grid-cols-4 gap-2">
        {COMMANDS.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.label}
              onClick={() => onCommand(c.command)}
              className="group flex flex-col items-center gap-1 border border-hud-red/20 bg-hud-red/5 p-2 transition-all hover:border-hud-red/60 hover:bg-hud-red/15"
            >
              <Icon className="h-4 w-4 text-hud-red/70 transition-colors group-hover:text-hud-red" />
              <span className="hud-text text-[9px] uppercase tracking-wider text-hud-red/60 transition-colors group-hover:text-hud-red">
                {c.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
