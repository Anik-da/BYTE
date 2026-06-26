import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Settings as SettingsIcon, Palette, Gauge, Keyboard, Shield, Lock, Download, Info,
  Check, Monitor, Moon, Sun, Mic
} from "lucide-react";
import { useAppStore } from "../stores/useAppStore";
import { useThemeStore } from "../stores/useThemeStore";
import { useSystemInfo } from "../hooks/useSystemInfo";
import { Toggle } from "../components/ui/Toggle";
import { GlassPanel } from "../components/ui/GlassPanel";
import { ACCENT_COLORS, APP_NAME, APP_TAGLINE, SETTINGS_TABS, AccentColor } from "../utils/constants";
import { cn } from "../utils/cn";
import { tauriService } from "../services/tauriService";
import { SecuritySettings } from "../components/settings/SecuritySettings";
import { PermissionSettings } from "../components/settings/PermissionSettings";
import { VoiceService, VoiceConfig } from "../services/voiceService";

const tabIcons: Record<string, React.ReactNode> = {
  Settings: <SettingsIcon size={18} />, Palette: <Palette size={18} />,
  Gauge: <Gauge size={18} />, Keyboard: <Keyboard size={18} />,
  Shield: <Shield size={18} />, Lock: <Lock size={18} />,
  Download: <Download size={18} />, Info: <Info size={18} />,
  Mic: <Mic size={18} />,
};

export function Settings() {
  const setCurrentPageTitle = useAppStore((s) => s.setCurrentPageTitle);
  const { mode, accentColor, animationsEnabled, toggleTheme, setAccentColor, setAnimationsEnabled } = useThemeStore();
  const { systemInfo, appVersion } = useSystemInfo();
  
  const [activeTab, setActiveTab] = useState("general");
  
  // General settings state
  const [autostart, setAutostart] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [clipboardIntegration, setClipboardIntegration] = useState(true);

  // Performance settings state
  const [refreshInterval, setRefreshInterval] = useState(2);
  const [devMode, setDevMode] = useState(false);



  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>({
    microphone_id: "default",
    speaker_id: "default",
    wake_word_enabled: true,
    wake_word_sensitivity: 0.5,
    always_listening: false,
    push_to_talk: true,
    language: "en-US",
    voice_speed: 1.0,
    voice_pitch: 1.0,
    voice_type: "female",
    noise_reduction: true,
    voice_auth_enabled: false,
  });

  useEffect(() => {
    setCurrentPageTitle("Settings");
    loadAutostart();
    loadVoiceSettings();
  }, [setCurrentPageTitle]);

  async function loadVoiceSettings() {
    try {
      const cfg = await VoiceService.loadSettings();
      setVoiceConfig(cfg);
    } catch (e) {
      console.warn("Failed to load voice configuration", e);
    }
  }

  const handleSaveVoiceConfig = async (updated: VoiceConfig) => {
    setVoiceConfig(updated);
    await VoiceService.saveSettings(updated);
  };

  async function loadAutostart() {
    try {
      const enabled = await tauriService.isAutostartEnabled();
      setAutostart(enabled);
    } catch (e) {
      console.warn("Could not check autostart status:", e);
    }
  }

  const handleToggleAutostart = async (val: boolean) => {
    try {
      await tauriService.setAutostart(val);
      setAutostart(val);
      await tauriService.showMessageDialog(
        "Autostart",
        val ? "BYTE will now launch automatically at startup." : "Autostart disabled.",
        "info"
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleAlwaysOnTop = async (val: boolean) => {
    try {
      await tauriService.setAlwaysOnTop(val);
      setAlwaysOnTop(val);
    } catch (err) {
      console.error(err);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "general":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Launch & Behavior</h3>
              <div className="space-y-4">
                <Toggle
                  checked={autostart}
                  onChange={handleToggleAutostart}
                  label="Start BYTE at Windows Logon"
                  description="Automatically run BYTE in the background when logging in"
                />
                <Toggle
                  checked={alwaysOnTop}
                  onChange={handleToggleAlwaysOnTop}
                  label="Always on Top"
                  description="Keep the application window floating above other windows"
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Clipboard Integration</h3>
              <Toggle
                checked={clipboardIntegration}
                onChange={setClipboardIntegration}
                label="Enable native clipboard sharing"
                description="Allows copy/paste support inside the terminal panel"
              />
            </div>
          </div>
        );

      case "appearance":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Theme Mode</h3>
              <div className="grid grid-cols-2 gap-3">
                {(["dark", "light"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => { if (mode !== t) toggleTheme(); }}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer",
                      mode === t
                        ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                        : "border-[var(--border-glass)] bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)]"
                    )}
                  >
                    {t === "dark" ? <Moon size={20} /> : <Sun size={20} />}
                    <div className="text-left">
                      <p className="text-sm font-medium text-[var(--text-primary)] capitalize">{t} Mode</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {t === "dark" ? "Easy on the eyes" : "Classic bright interface"}
                      </p>
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
                  <button
                    key={c.value}
                    onClick={() => setAccentColor(c.value as AccentColor)}
                    title={c.name}
                    className={cn(
                      "w-10 h-10 rounded-xl transition-all cursor-pointer ring-offset-2 ring-offset-[var(--bg-primary)]",
                      accentColor === c.value ? "ring-2 ring-current scale-110" : "hover:scale-105"
                    )}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Animations</h3>
              <Toggle
                checked={animationsEnabled}
                onChange={setAnimationsEnabled}
                label="Enable animations"
                description="Smooth transitions and micro-interactions"
              />
            </div>
          </div>
        );

      case "performance":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Hardware Polling Interval</h3>
              <p className="text-xs text-[var(--text-muted)] mb-4">Set how frequently the system monitor requests stats from the OS</p>
              <div className="flex items-center gap-4 bg-[var(--bg-glass)] p-4 rounded-xl border border-[var(--border-glass)]">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="flex-1 accent-[var(--accent)]"
                />
                <span className="text-xs font-mono font-bold text-[var(--text-primary)] w-12 text-right">
                  {refreshInterval}s
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Developer Mode</h3>
              <Toggle
                checked={devMode}
                onChange={setDevMode}
                label="Enable developer console options"
                description="Exposes raw Tauri subprocess diagnostics and log targets"
              />
            </div>
          </div>
        );

      case "security":
        return <SecuritySettings />;

      case "permissions":
        return <PermissionSettings />;

      case "voice":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Speech Engine Attributes</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[var(--text-muted)]">Voice Style</label>
                  <select
                    value={voiceConfig.voice_type}
                    onChange={(e) => handleSaveVoiceConfig({ ...voiceConfig, voice_type: e.target.value })}
                    className="bg-[var(--bg-glass-heavy)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                  >
                    <option value="female">Natural Female Voice</option>
                    <option value="male">Natural Male Voice</option>
                    <option value="natural">Synthesized Default</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[var(--text-muted)]">Synthesizer Language</label>
                  <select
                    value={voiceConfig.language}
                    onChange={(e) => handleSaveVoiceConfig({ ...voiceConfig, language: e.target.value })}
                    className="bg-[var(--bg-glass-heavy)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                  >
                    <option value="en-US">English (United States)</option>
                    <option value="es-ES">Spanish (Spain)</option>
                    <option value="fr-FR">French (France)</option>
                    <option value="de-DE">German (Germany)</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Playback Modifiers</h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-muted)]">Speech Synthesis Speed</span>
                    <span className="text-[var(--accent)] font-semibold">{voiceConfig.voice_speed.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={voiceConfig.voice_speed}
                    onChange={(e) => handleSaveVoiceConfig({ ...voiceConfig, voice_speed: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-[var(--border-default)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-muted)]">Speech Pitch</span>
                    <span className="text-[var(--accent)] font-semibold">{voiceConfig.voice_pitch.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={voiceConfig.voice_pitch}
                    onChange={(e) => handleSaveVoiceConfig({ ...voiceConfig, voice_pitch: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-[var(--border-default)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--border-default)]/30">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Advanced Filters</h3>
              <div className="space-y-4">
                <Toggle
                  checked={voiceConfig.noise_reduction}
                  onChange={(val) => handleSaveVoiceConfig({ ...voiceConfig, noise_reduction: val })}
                  label="Dynamic Noise Reduction"
                  description="Filter ambient fan noise and mic static waves"
                />
                <Toggle
                  checked={voiceConfig.voice_auth_enabled}
                  onChange={(val) => handleSaveVoiceConfig({ ...voiceConfig, voice_auth_enabled: val })}
                  label="Biometric Voiceprint Verification"
                  description="Enforce authentication verification matching owner signature"
                />
              </div>
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
                <div className="space-y-2 text-sm font-mono text-[var(--text-secondary)]">
                  {[["OS", systemInfo.os], ["Architecture", systemInfo.arch], ["Hostname", systemInfo.hostname]].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-[var(--text-muted)]">{k}</span>
                      <span className="text-[var(--text-primary)] font-medium">{v}</span>
                    </div>
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
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer",
              activeTab === tab.id
                ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-glass)]"
            )}
          >
            {tabIcons[tab.icon] || <SettingsIcon size={18} />}
            <span className="font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="flex-1">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.15 }}
        >
          {renderContent()}
        </motion.div>
      </div>
    </div>
  );
}
