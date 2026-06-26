import { Search, Hexagon } from "lucide-react";
import { WindowControls } from "./WindowControls";
import { useAppStore } from "../../stores/useAppStore";
import { APP_NAME } from "../../utils/constants";

export function TitleBar() {
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between h-10 bg-[var(--titlebar-bg)] border-b border-[var(--border-default)] select-none flex-shrink-0"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Left: App Branding */}
      <div className="flex items-center gap-2 pl-4 no-drag" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] flex items-center justify-center">
          <Hexagon size={14} className="text-white" />
        </div>
        <span className="text-sm font-semibold text-[var(--text-primary)] tracking-wide">{APP_NAME}</span>
      </div>

      {/* Center: Search / Command Palette Trigger */}
      <button
        onClick={() => setCommandPaletteOpen(true)}
        className="no-drag flex items-center gap-2 px-4 py-1 rounded-md bg-[var(--bg-glass)] border border-[var(--border-glass)] hover:bg-[var(--bg-glass-heavy)] hover:border-[var(--border-active)] transition-all duration-200 cursor-pointer"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <Search size={13} className="text-[var(--text-muted)]" />
        <span className="text-xs text-[var(--text-muted)]">Search or command...</span>
        <kbd className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-glass-heavy)] px-1.5 py-0.5 rounded border border-[var(--border-glass)] ml-4">
          Ctrl+K
        </kbd>
      </button>

      {/* Right: Window Controls */}
      <div style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <WindowControls />
      </div>
    </div>
  );
}
