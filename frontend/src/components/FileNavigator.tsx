import { useEffect, useState, useRef } from 'react';
import { FolderOpen, FileText, Terminal, ArrowRight } from 'lucide-react';

export interface MockFile {
  id: string;
  name: string;
  type: string;
  size: string;
  content: string;
}

export const MOCK_FILES: MockFile[] = [
  {
    id: 'diagnostics',
    name: 'diagnostics.log',
    type: 'log',
    size: '1.2 KB',
    content: `[SYSTEM DIAGNOSTICS REPORT]
TIMESTAMP: ${new Date().toISOString()}
-------------------------------------------
[INFO] CPU Load: 32% (Core Temperature: 41°C)
[INFO] Memory Load: 58% (Active processes: 847)
[INFO] Power Supply: Arc Reactor Core at 98.2%
[INFO] Cooling Subsystem: Fan Speed 2400 RPM
[INFO] Network Status: Satellite uplink active (Linkage: 94%)
[SUCCESS] Diagnostics status: NOMINAL
[SUCCESS] Self-test complete. 0 anomalies detected.`,
  },
  {
    id: 'security',
    name: 'security_grid.db',
    type: 'database',
    size: '4.8 KB',
    content: `[PERIMETER SECURITY DATABASE]
LAST REFRESH: ${new Date().toLocaleTimeString()}
-------------------------------------------
[SECURE] sector_alpha_sensor: 0 hostiles
[SECURE] sector_beta_sensor:  0 hostiles
[SECURE] sector_gamma_sensor: 0 hostiles
[SECURE] sector_delta_sensor: 0 hostiles
[INFO] Perimeter security shields: ACTIVE
[INFO] Bio-scanners: ENGAGED (vital detection range: 50m)
[SUCCESS] Area scan status: SECURE`,
  },
  {
    id: 'quantum',
    name: 'quantum_matrix.conf',
    type: 'config',
    size: '0.6 KB',
    content: `# QUANTUM CORE CONFIGURATION MATRIX
# DO NOT MODIFY PARAMETERS OUTSIDE QUANTUM LOCK
-------------------------------------------
COHERENCE_TIME = 24.8ms
SUPERPOSITION_QUBITS = 4096
ENTANGLEMENT_FIDELITY = 0.9972
DECOHERENCE_MITIGATION = ACTIVE
ERROR_CORRECTION_MODE = SurfaceCode_v4
THERMAL_COUPLING_FACTOR = 0.0014`,
  },
  {
    id: 'satellite',
    name: 'satellite_link.key',
    type: 'key',
    size: '0.8 KB',
    content: `-----BEGIN SATELLITE PRIVACY KEY-----
MIIEogIBAAKCAQEA08jV2kH0pQv/WjApy8fO1j1n3uX4k9
V8w0LzKj8qA2dJfD82kSgW109wJnD72kLmOpS91aJd92jS
UPLINK_TARGET: SAT-GEO-1
SIGNAL_BAND: Ka-Band (154.2 Mbps)
LATENCY: 12ms
-----END SATELLITE PRIVACY KEY-----
[INFO] Signal encrypted. Relaying via 3 geosynchronous nodes.`,
  },
];

interface FileNavigatorProps {
  activeFileId: string | null;
  onSelectFile: (id: string | null) => void;
}

export function FileNavigator({ activeFileId, onSelectFile }: FileNavigatorProps) {
  const [typedContent, setTypedContent] = useState('');
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  const activeFile = MOCK_FILES.find((f) => f.id === activeFileId);

  // Simulated terminal typing effect
  useEffect(() => {
    if (!activeFile) {
      setTypedContent('');
      return;
    }

    setTypedContent('> LOADING FILE CONTENT...\n');
    let idx = 0;
    const fullText = activeFile.content;
    
    const interval = setInterval(() => {
      setTypedContent((prev) => prev + fullText.charAt(idx));
      idx++;
      if (idx >= fullText.length) {
        clearInterval(interval);
      }
    }, 4); // Fast print

    return () => clearInterval(interval);
  }, [activeFileId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll terminal to bottom
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [typedContent]);

  return (
    <div className="hud-panel hud-corner clip-notch flex h-full flex-col p-2">
      <div className="mb-1 flex items-center justify-between border-b border-hud-red/20 pb-1">
        <div className="flex items-center gap-1.5">
          <FolderOpen className="h-3 w-3 text-hud-red animate-pulse" />
          <h2 className="hud-display text-[9px] font-bold tracking-widest text-hud-red hud-glow">
            SIMULATED FILE SYSTEM
          </h2>
        </div>
        <span className="hud-mono text-[8px] text-hud-red/40">SANDBOX MODE</span>
      </div>

      {/* Grid: File List / Terminal Viewer */}
      <div className="grid flex-1 grid-cols-1 gap-1.5 overflow-hidden sm:grid-cols-[115px_1fr]">
        
        {/* Left Side: Mock File List */}
        <div className="flex flex-col gap-0.5 overflow-y-auto border-r border-hud-red/10 pr-1">
          {MOCK_FILES.map((file) => {
            const isSelected = file.id === activeFileId;
            return (
              <button
                key={file.id}
                onClick={() => onSelectFile(isSelected ? null : file.id)}
                className={`flex items-center justify-between border p-1 text-left transition-all ${
                  isSelected
                    ? 'border-hud-red bg-hud-red/20 text-hud-red hud-glow'
                    : 'border-hud-red/20 bg-hud-red/5 text-hud-red/70 hover:bg-hud-red/15 hover:text-hud-red'
                }`}
              >
                <div className="flex items-center gap-1 min-w-0">
                  <FileText className="h-2.5 w-2.5 shrink-0" />
                  <span className="hud-mono text-[9px] font-medium truncate">
                    {file.name}
                  </span>
                </div>
                <span className="hud-mono text-[7px] opacity-40 shrink-0 ml-1">
                  {file.size}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Side: Terminal Preview */}
        <div className="flex flex-col overflow-hidden border border-hud-red/20 bg-slate-950/60 p-1.5">
          <div className="mb-0.5 flex items-center gap-1 border-b border-hud-red/10 pb-0.5">
            <Terminal className="h-2.5 w-2.5 text-hud-red" />
            <span className="hud-mono text-[8px] uppercase tracking-wider text-hud-red/60">
              {activeFile ? `Viewer: ${activeFile.name}` : 'Select file to preview'}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            {activeFile ? (
              <pre className="hud-mono text-[9px] leading-tight text-hud-red whitespace-pre-wrap">
                {typedContent}
                <span className="animate-pulse ml-0.5">|</span>
              </pre>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center text-hud-red/35">
                <ArrowRight className="h-4 w-4 rotate-90 sm:-rotate-0 animate-bounce mb-0.5" />
                <p className="hud-mono text-[8px] uppercase tracking-widest">
                  SELECT FILE TO MOUNT
                </p>
              </div>
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>

      </div>
    </div>
  );
}
