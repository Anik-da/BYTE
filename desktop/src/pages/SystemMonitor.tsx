import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Cpu, HardDrive, SquareStack, XCircle } from "lucide-react";
import { useAppStore } from "../stores/useAppStore";
import { tauriService } from "../services/tauriService";
import { GlassPanel } from "../components/ui/GlassPanel";
import type { SystemMetrics } from "../types";

export function SystemMonitor() {
  const setCurrentPageTitle = useAppStore((s) => s.setCurrentPageTitle);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [cpuHistory, setCpuHistory] = useState<number[]>(Array(10).fill(0));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setCurrentPageTitle("System Monitor");
  }, [setCurrentPageTitle]);

  useEffect(() => {
    // Poll metrics immediately
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2000);
    return () => clearInterval(interval);
  }, []);

  async function fetchMetrics() {
    try {
      const data = await tauriService.getSystemMetrics();
      setMetrics(data);
      setCpuHistory((prev) => [...prev.slice(1), data.cpu_usage]);
      setIsLoading(false);
    } catch (e) {
      console.error("Failed to load metrics:", e);
    }
  }

  const handleKillProcess = async (pid: number, name: string) => {
    const confirm = window.confirm(`Kill process ${name} (PID: ${pid})?`);
    if (!confirm) return;
    try {
      await tauriService.killProcess(pid);
      await tauriService.showMessageDialog("Success", `Killed process ${name} (${pid})`, "info");
      fetchMetrics();
    } catch (err) {
      await tauriService.showMessageDialog("Error", String(err), "error");
    }
  };

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };

  const getUsageColor = (pct: number) => {
    if (pct > 85) return "bg-red-500 shadow-[0_0_8px_#ef4444]";
    if (pct > 60) return "bg-amber-500 shadow-[0_0_8px_#f59e0b]";
    return "bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]";
  };

  if (isLoading || !metrics) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-140px)] gap-3">
        <Cpu className="w-8 h-8 stroke-[1.5] text-[var(--accent)] animate-spin" />
        <span className="text-xs text-[var(--text-muted)]">Loading hardware diagnostics...</span>
      </div>
    );
  }

  // Draw simple SVG line chart
  const maxCpu = 100;
  const width = 200;
  const height = 60;
  const points = cpuHistory
    .map((val, index) => {
      const x = (index / (cpuHistory.length - 1)) * width;
      const y = height - (val / maxCpu) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const ramPct = (metrics.ram_used / metrics.ram_total) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-140px)] overflow-y-auto pr-1"
    >
      {/* LEFT SECTION: CPU & RAM Metrics */}
      <div className="flex flex-col gap-4">
        {/* CPU Panel */}
        <GlassPanel padding="md" className="flex flex-col gap-4 border border-[var(--border-glass)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <Cpu size={16} />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">CPU Load</h3>
            </div>
            <span className="text-xl font-bold font-mono text-[var(--text-primary)]">
              {metrics.cpu_usage.toFixed(1)}%
            </span>
          </div>

          {/* SVG Line Chart */}
          <div className="w-full bg-black/40 border border-[var(--border-glass)] rounded-lg p-2 flex justify-center">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16 overflow-visible">
              <path
                d={`M 0,${height} L ${points} L ${width},${height} Z`}
                fill="url(#cpuGrad)"
                opacity="0.15"
              />
              <polyline
                fill="none"
                stroke="var(--accent)"
                strokeWidth="1.5"
                points={points}
              />
              <defs>
                <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </GlassPanel>

        {/* RAM Memory Panel */}
        <GlassPanel padding="md" className="flex flex-col gap-4 border border-[var(--border-glass)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <SquareStack size={16} />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">RAM Usage</h3>
            </div>
            <span className="text-xl font-bold font-mono text-[var(--text-primary)]">
              {ramPct.toFixed(1)}%
            </span>
          </div>

          <div className="flex justify-between text-xs text-[var(--text-muted)] font-mono">
            <span>Used: {formatBytes(metrics.ram_used)}</span>
            <span>Total: {formatBytes(metrics.ram_total)}</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-[var(--bg-glass-heavy)] h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${getUsageColor(ramPct)}`}
              style={{ width: `${ramPct}%` }}
            />
          </div>
        </GlassPanel>

        {/* Storage Partition Metrics */}
        <GlassPanel padding="md" className="flex-1 flex flex-col gap-4 border border-[var(--border-glass)]">
          <div className="flex items-center gap-2 text-[var(--accent)]">
            <HardDrive size={16} />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Storage Partitions</h3>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto">
            {metrics.disks.map((disk, idx) => {
              const used = disk.total - disk.available;
              const usedPct = (used / disk.total) * 100;
              return (
                <div key={idx} className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs font-semibold text-[var(--text-primary)]">
                    <span>{disk.name || "Local Disk"} ({disk.mount_point})</span>
                    <span>{usedPct.toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono">
                    <span>Used: {formatBytes(used)}</span>
                    <span>Total: {formatBytes(disk.total)}</span>
                  </div>
                  <div className="w-full bg-[var(--bg-glass-heavy)] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${getUsageColor(usedPct)}`}
                      style={{ width: `${usedPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      </div>

      {/* RIGHT SECTION: Process Manager Table */}
      <GlassPanel padding="none" className="lg:col-span-2 flex flex-col border border-[var(--border-glass)] rounded-xl overflow-hidden min-h-[400px]">
        <div className="px-4 py-3 bg-[var(--bg-glass-heavy)] border-b border-[var(--border-glass)] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Process Manager</h3>
          <span className="text-xs text-[var(--text-muted)] font-mono">Top CPU consumers</span>
        </div>

        <div className="flex-1 overflow-auto p-2 scrollbar-thin">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-glass)] text-[10px] uppercase text-[var(--text-muted)] font-mono tracking-wider">
                <th className="p-3">PID</th>
                <th className="p-3">Process Name</th>
                <th className="p-3">CPU %</th>
                <th className="p-3">Memory</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-glass)]">
              {metrics.processes.map((proc) => (
                <tr key={proc.pid} className="hover:bg-[var(--bg-glass)] text-xs text-[var(--text-secondary)]">
                  <td className="p-3 font-mono text-[var(--text-muted)]">{proc.pid}</td>
                  <td className="p-3 font-semibold text-[var(--text-primary)] truncate max-w-[150px]">
                    {proc.name}
                  </td>
                  <td className="p-3 font-mono font-bold text-emerald-400">{proc.cpu.toFixed(1)}%</td>
                  <td className="p-3 font-mono">{formatBytes(proc.memory)}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleKillProcess(proc.pid, proc.name)}
                      className="text-neutral-500 hover:text-red-500 transition-colors p-1 cursor-pointer"
                      title="Kill Process"
                    >
                      <XCircle size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </motion.div>
  );
}
