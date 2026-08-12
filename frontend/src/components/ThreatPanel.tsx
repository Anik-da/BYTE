import { fetchSystemTelemetry } from '@/lib/desktopApi';

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
    let mounted = true;
    const fetchLive = async () => {
      const data = await fetchSystemTelemetry();
      if (data && mounted) {
        setState({
          level: (data.threat_level as ThreatLevel) || 'GREEN',
          contacts: Number(data.hostile_contacts || 0),
          perimeter: Number(data.perimeter || 100),
          integrity: Number(data.integrity || 100),
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
