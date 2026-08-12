import { fetchSystemTelemetry } from '@/lib/desktopApi';

interface SystemStats {
  cpu: number;
  memory: number;
  network: number;
  power: number;
  temp: number;
  uptime: number;
  processes: number;
  maxProcesses: number;
  threatLevel: string;
}

function useLiveStats() {
  const [stats, setStats] = useState<SystemStats>({
    cpu: 18,
    memory: 45,
    network: 12,
    power: 100,
    temp: 42,
    uptime: 0,
    processes: 120,
    maxProcesses: 1024,
    threatLevel: 'GREEN',
  });

  useEffect(() => {
    let mounted = true;
    const fetchLive = async () => {
      const data = await fetchSystemTelemetry();
      if (data && mounted) {
        setStats({
          cpu: Number(data.cpu_load || 0),
          memory: Number(data.memory_percent || 0),
          network: Number(data.network_percent || 0),
          power: Number(data.battery_percent || 100),
          temp: Number(data.temperature || 42),
          uptime: Number(data.uptime || 0),
          processes: Number(data.processes_count || 120),
          maxProcesses: Number(data.max_processes || 1024),
          threatLevel: String(data.threat_level || 'GREEN'),
        });
      }
    };
    fetchLive();
    const interval = setInterval(fetchLive, 1500);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return stats;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function StatBar({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="hud-text text-[11px] uppercase tracking-wider text-hud-red/70">{label}</span>
        <span className="hud-mono text-xs text-hud-red">
          {value.toFixed(value < 10 ? 1 : 0)}
          <span className="ml-0.5 text-hud-red/50">{unit}</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden bg-hud-red/10">
        <div
          className="h-full transition-all duration-700 ease-out"
          style={{
            width: `${Math.min(100, value)}%`,
            background: color,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      </div>
    </div>
  );
}

function formatUptime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function SystemPanel({ speaking, listening }: { speaking: boolean; listening: boolean }) {
  const stats = useLiveStats();

  return (
    <div className="hud-panel hud-corner flex shrink-0 flex-col p-3.5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="hud-display text-xs font-bold tracking-widest text-hud-red hud-glow">
          SYSTEM DIAGNOSTICS
        </h2>
        <span className="hud-mono text-[10px] text-hud-success">● ONLINE</span>
      </div>

      <div className="space-y-3">
        <StatBar label="CPU Load" value={stats.cpu} unit="%" color="#ef4444" />
        <StatBar label="Memory" value={stats.memory} unit="%" color="#dc2626" />
        <StatBar label="Network I/O" value={stats.network} unit="%" color="#b91c1c" />
        <StatBar label="Power Core" value={stats.power} unit="%" color="#f87171" />
        <StatBar label="Core Temp" value={stats.temp} unit="°C" color="#fbbf24" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="border border-hud-red/20 bg-hud-red/5 p-2">
          <div className="hud-text text-[10px] uppercase text-hud-red/60">Uptime</div>
          <div className="hud-mono text-sm text-hud-red">{formatUptime(stats.uptime)}</div>
        </div>
        <div className="border border-hud-red/20 bg-hud-red/5 p-2">
          <div className="hud-text text-[10px] uppercase text-hud-red/60">Processes</div>
          <div className="hud-mono text-sm text-hud-red">{stats.processes} / {stats.maxProcesses}</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 hud-text text-[10px] uppercase tracking-wider text-hud-red/60">
          Audio Bus
        </div>
        <div className="h-12 w-full border border-hud-red/20 bg-slate-950/40 p-1">
          <Waveform active={speaking || listening} color={listening ? 'green' : speaking ? 'gold' : 'red'} />
        </div>
      </div>

      <div className="mt-auto pt-3">
        <div className="hud-mono text-[10px] leading-relaxed text-hud-red/40">
          {'> monitoring 14 subsystems'}
          <br />
          {`> threat level: ${stats.threatLevel.toLowerCase()}`}
          <br />
          {'> live status: synced'}
        </div>
      </div>
    </div>
  );
}
