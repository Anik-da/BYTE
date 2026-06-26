import { useState, useEffect } from "react";
import { Wifi, Sun, Moon } from "lucide-react";
import { useThemeStore } from "../../stores/useThemeStore";
import { useSystemInfo } from "../../hooks/useSystemInfo";
import { APP_VERSION } from "../../utils/constants";

export function StatusBar() {
  const { mode, toggleTheme } = useThemeStore();
  const { systemInfo } = useSystemInfo();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex items-center justify-between h-7 px-4 bg-[var(--statusbar-bg)] border-t border-[var(--border-default)] text-[11px] text-[var(--text-muted)] flex-shrink-0 select-none">
      {/* Left */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Online</span>
        </div>
        <span className="text-[var(--border-glass)]">|</span>
        <div className="flex items-center gap-1">
          <Wifi size={11} />
          <span>Connected</span>
        </div>
        <span className="text-[var(--border-glass)]">|</span>
        <span>v{APP_VERSION}</span>
      </div>

      {/* Center */}
      <div className="flex items-center gap-2">
        {systemInfo && (
          <span>
            {systemInfo.os} · {systemInfo.arch}
          </span>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          {mode === "dark" ? <Sun size={11} /> : <Moon size={11} />}
          <span>{mode === "dark" ? "Light" : "Dark"}</span>
        </button>
        <span className="text-[var(--border-glass)]">|</span>
        <span className="font-medium">{formatTime(time)}</span>
      </div>
    </div>
  );
}
