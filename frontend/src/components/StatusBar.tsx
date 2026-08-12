import { useEffect, useState } from 'react';
import { Activity, Cpu, Wifi, Shield, Clock, Sliders, RefreshCw, GitPullRequest } from 'lucide-react';
import { soundFx } from '@/lib/soundFx';

export function StatusBar({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const [now, setNow] = useState(new Date());
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/system/check_github_update');
        const data = await res.json();
        if (data.update_available) {
          setUpdateAvailable(true);
          setCommitMsg(data.commit_message || 'New version available');
        }
      } catch (err) {
        // Backend offline or dev mode
      }
    };
    checkUpdate();
    const updateInterval = setInterval(checkUpdate, 60000);
    return () => clearInterval(updateInterval);
  }, []);

  const handleSettingsClick = () => {
    soundFx.playBeep(1200, 0.04);
    onOpenSettings?.();
  };

  const handleApplyUpdate = async () => {
    try {
      setUpdating(true);
      soundFx.playChirp();
      const res = await fetch('http://127.0.0.1:8000/api/system/apply_github_update', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        alert('GitHub Update Applied Successfully! Reloading app...');
        window.location.reload();
      } else {
        alert(`Update error: ${data.message}`);
      }
    } catch (err) {
      alert('Failed to pull update from GitHub.');
    } finally {
      setUpdating(false);
    }
  };

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
        {updateAvailable && (
          <button
            onClick={handleApplyUpdate}
            disabled={updating}
            className="flex items-center gap-1.5 animate-pulse border border-emerald-500/80 bg-emerald-950/80 px-2 py-0.5 hud-mono text-[10px] uppercase text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)] hover:bg-emerald-800/50"
            title={`GitHub Update Ready: ${commitMsg}`}
          >
            {updating ? (
              <RefreshCw className="h-3 w-3 animate-spin text-emerald-400" />
            ) : (
              <GitPullRequest className="h-3 w-3 text-emerald-400" />
            )}
            <span>{updating ? 'Updating...' : 'Sync GitHub'}</span>
          </button>
        )}

        {onOpenSettings && (
          <button
            onClick={handleSettingsClick}
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
