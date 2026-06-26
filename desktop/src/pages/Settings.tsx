import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Settings as SettingsIcon, Palette, Gauge, Keyboard, Shield, Lock, Download, Info,
  Check, Monitor, Moon, Sun,
} from "lucide-react";
import { useAppStore } from "../stores/useAppStore";
import { useThemeStore } from "../stores/useThemeStore";
import { useSystemInfo } from "../hooks/useSystemInfo";
import { Toggle } from "../components/ui/Toggle";
import { GlassPanel } from "../components/ui/GlassPanel";
import { ACCENT_COLORS, APP_NAME, APP_TAGLINE, SETTINGS_TABS } from "../utils/constants";
import { cn } from "../utils/cn";
import type { AccentColor } from "../utils/constants";

const tabIcons: Record<string, React.ReactNode> = {
  Settings: <SettingsIcon size={18} />, Palette: <Palette size={18} />,
  Gauge: <Gauge size={18} />, Keyboard: <Keyboard size={18} />,
  Shield: <Shield size={18} />, Lock: <Lock size={18} />,
  Download: <Download size={18} />, Info: <Info size={18} />,
};

export function Settings() {
  const setCurrentPageTitle = useAppStore((s) => s.setCurrentPageTitle);
  const { mode, accentColor, animationsEnabled, toggleTheme, setAccentColor, setAnimationsEnabled } = useThemeStore();
  const { systemInfo, appVersion } = useSystemInfo();
  const [activeTab, setActiveTab] = useState("general");

  useEffect(() => { setCurrentPageTitle("Settings"); }, [setCurrentPageTitle]);

  const renderContent = () => {
    switch (activeTab) {
      case "appearance":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Theme Mode</h3>
              <div className="grid grid-cols-2 gap-3">
                {(["dark", "light"] as const).map((t) => (
                  <button key={t} onClick={() => { if (mode !== t) toggleTheme(); }}
                    className={cn("flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer",
                      mode === t ? "border-[var(--accent)] bg-[var(--accent-muted)]" : "border-[var(--border-glass)] bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)]")}>
                    {t === "dark" ? <Moon size={20} /> : <Sun size={20} />}
                    <div className="text-left">
                      <p className="text-sm font-medium text-[var(--text-primary)] capitalize">{t} Mode</p>
                      <p className="text-xs text-[var(--text-muted)]">{t === "dark" ? "Easy on the eyes" : "Classic bright interface"}</p>
                    </div>
                    {mode === t && <Check size={16} className="ml-auto text-[var(--accent)]" />}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Accent Color</h3>
              <div className="flex gap-3">
                {ACCENT_COLORS.map((c) => (
                  <button key={c.value} onClick={() => setAccentColor(c.value as AccentColor)} title={c.name}
                    className={cn("w-10 h-10 rounded-xl transition-all cursor-pointer ring-offset-2 ring-offset-[var(--bg-primary)]",
                      accentColor === c.value ? "ring-2 ring-current scale-110" : "hover:scale-105")}
                    style={{ backgroundColor: c.hex }} />
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Animations</h3>
              <Toggle checked={animationsEnabled} onChange={setAnimationsEnabled} label="Enable animations" description="Smooth transitions and micro-interactions" />
            </div>
          </div>
        );
      case "about":
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] flex items-center justify-center shadow-lg">
                <Monitor size={32} className="text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[var(--text-primary)]">{APP_NAME}</h3>
                <p className="text-sm text-[var(--text-muted)]">{APP_TAGLINE}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1 mb-3">Version {appVersion}</p>
                <button
                  onClick={async () => {
                    try {
                      const { openUrl } = await import("@tauri-apps/plugin-opener");
                      await openUrl("https://github.com/Anik-da/BYTE");
                    } catch (e) {
                      console.error("Failed to open URL", e);
                    }
                  }}
                  className="inline-flex items-center justify-center rounded-lg font-medium text-xs px-3 py-1.5 gap-1.5 bg-[var(--bg-glass-heavy)] hover:bg-[var(--border-active)] text-[var(--text-primary)] border border-[var(--border-glass)] cursor-pointer"
                >
                  Visit GitHub Repository
                </button>
              </div>
            </div>
            {systemInfo && (
              <GlassPanel padding="md">
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">System Information</h4>
                <div className="space-y-2 text-sm">
                  {[["OS", systemInfo.os], ["Architecture", systemInfo.arch], ["Hostname", systemInfo.hostname]].map(([k, v]) => (
                    <div key={k} className="flex justify-between"><span className="text-[var(--text-muted)]">{k}</span><span className="text-[var(--text-primary)] font-medium">{v}</span></div>
                  ))}
                </div>
              </GlassPanel>
            )}
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-12 h-12 rounded-xl bg-[var(--bg-glass-heavy)] flex items-center justify-center mb-4 text-[var(--text-muted)]">
              {tabIcons[SETTINGS_TABS.find((t) => t.id === activeTab)?.icon || "Settings"]}
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1 capitalize">{activeTab}</h3>
            <p className="text-xs text-[var(--text-muted)] max-w-xs">
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} settings will be available in future updates.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="flex gap-6 h-full">
      <div className="w-56 flex-shrink-0 space-y-1">
        {SETTINGS_TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer",
              activeTab === tab.id ? "bg-[var(--accent-muted)] text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-glass)]")}>
            {tabIcons[tab.icon]}
            <span className="font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="flex-1">
        <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.15 }}>
          {renderContent()}
        </motion.div>
      </div>
    </div>
  );
}
