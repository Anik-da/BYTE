import React, { useState } from 'react';
import { Download, RefreshCw, Sparkles, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { downloadAndInstallUpdate, restartApplication } from '../lib/updater';
import { Update } from '@tauri-apps/plugin-updater';

interface UpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  version: string;
  releaseNotes: string;
  updateObj: Update | null;
}

export function UpdateDialog({
  isOpen,
  onClose,
  version,
  releaseNotes,
  updateObj,
}: UpdateDialogProps) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadedMb, setDownloadedMb] = useState('0');
  const [totalMb, setTotalMb] = useState('15.4');
  const [readyToRestart, setReadyToRestart] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartDownload = async () => {
    setDownloading(true);
    setErrorMsg(null);
    try {
      await downloadAndInstallUpdate(updateObj, ({ downloaded, total, percent }) => {
        setProgress(percent);
        setDownloadedMb((downloaded / (1024 * 1024)).toFixed(1));
        if (total > 0) {
          setTotalMb((total / (1024 * 1024)).toFixed(1));
        }
      });
      setDownloading(false);
      setReadyToRestart(true);
    } catch (err: any) {
      setDownloading(false);
      setErrorMsg(err?.message || 'Download failed. Please check network connection.');
    }
  };

  const handleRestart = async () => {
    await restartApplication();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="hud-panel hud-corner clip-notch relative w-full max-w-md border border-hud-red/40 bg-slate-950 p-5 shadow-2xl shadow-hud-red/20">
        
        {/* Header */}
        <div className="mb-4 flex items-center justify-between border-b border-hud-red/20 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-hud-red animate-pulse" />
            <div>
              <h2 className="hud-display text-sm font-bold tracking-widest text-hud-red hud-glow uppercase">
                BYTE Update Available
              </h2>
              <span className="hud-mono text-[10px] text-hud-red/60">
                Target Release: v{version}
              </span>
            </div>
          </div>
          {!downloading && (
            <button
              onClick={onClose}
              className="text-hud-red/50 hover:text-hud-red transition-colors p-1"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Content */}
        {!readyToRestart ? (
          <div className="space-y-4">
            {/* Release Notes */}
            <div className="border border-hud-red/20 bg-hud-red/5 p-3 rounded-none">
              <div className="hud-display text-[10px] uppercase font-semibold text-hud-red/70 mb-1.5">
                Release Highlights:
              </div>
              <div className="hud-mono text-xs text-hud-red/90 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                {releaseNotes}
              </div>
            </div>

            {/* Download Size */}
            <div className="flex items-center justify-between hud-mono text-xs text-hud-red/60 border-t border-b border-hud-red/10 py-1.5">
              <span>Estimated Download Size:</span>
              <span className="text-hud-red font-bold">{totalMb} MB</span>
            </div>

            {/* Progress Bar during download */}
            {downloading && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between hud-mono text-xs text-hud-red">
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Downloading Update...
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden border border-hud-red/40 bg-slate-900">
                  <div
                    className="h-full bg-hud-red transition-all duration-300 hud-glow"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="hud-mono text-[10px] text-hud-red/50 text-right">
                  {downloadedMb} MB / {totalMb} MB
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="flex items-center gap-2 border border-hud-danger/40 bg-hud-danger/10 p-2 text-hud-danger hud-mono text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              {!downloading && (
                <>
                  <button
                    onClick={onClose}
                    className="border border-hud-red/20 px-3 py-1.5 hud-mono text-xs text-hud-red/60 hover:bg-hud-red/10 hover:text-hud-red transition-all"
                  >
                    Later
                  </button>
                  <button
                    onClick={handleStartDownload}
                    className="flex items-center gap-1.5 border border-hud-red bg-hud-red/20 px-4 py-1.5 hud-mono text-xs font-bold text-hud-red hover:bg-hud-red/30 hud-glow transition-all"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download & Install
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          /* Ready to Restart Screen */
          <div className="space-y-4 text-center py-2">
            <CheckCircle2 className="h-10 w-10 text-hud-success mx-auto animate-bounce" />
            <div>
              <h3 className="hud-display text-sm font-bold text-hud-success tracking-widest uppercase">
                Update Ready
              </h3>
              <p className="hud-mono text-xs text-hud-red/70 mt-1">
                BYTE has downloaded v{version}. Restart now to apply updates.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                onClick={onClose}
                className="border border-hud-red/20 px-3 py-1.5 hud-mono text-xs text-hud-red/60 hover:bg-hud-red/10 hover:text-hud-red"
              >
                Restart Later
              </button>
              <button
                onClick={handleRestart}
                className="flex items-center gap-1.5 border border-hud-success bg-hud-success/20 px-4 py-1.5 hud-mono text-xs font-bold text-hud-success hover:bg-hud-success/30 hud-glow"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Restart Now
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
