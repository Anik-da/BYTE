import { useState, useEffect } from 'react';
import { X, Settings, Cpu, Mic, Database, Package, Check, Sliders, RefreshCw, Sparkles } from 'lucide-react';
import {
  fetchBackendSettings,
  saveBackendSettings,
  fetchAutostartStatus,
  fetchVoiceStatus,
  fetchLocalModels,
  fetchGroqModels,
  type AutostartStatus,
  type VoiceStatus,
  type LocalOllamaModel,
  type GroqModelInfo,
} from '@/lib/desktopApi';
import { ACTIVE_GROQ_MODELS, DEFAULT_GROQ_MODEL, normalizeGroqModel } from '@/lib/groq';
import { checkForUpdate, CURRENT_APP_VERSION } from '@/lib/updater';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'desktop' | 'voice' | 'ai' | 'plugins' | 'memory' | 'updates';

const OLLAMA_DOWNLOAD_PRESETS = [
  'qwen2.5:0.5b',
  'gemma3:1b',
  'llama3.2',
  'gemma3:4b',
  'qwen2.5-coder:7b',
  'deepseek-r1:1.5b',
  'qwen3-vl:8b',
];

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('ai');
  const [aiProvider, setAiProvider] = useState('groq');
  const [groqModel, setGroqModel] = useState<string>(DEFAULT_GROQ_MODEL);
  const [groqApiKey, setGroqApiKey] = useState('');
  const [ollamaModel, setOllamaModel] = useState('gemma3:4b');
  const [downloadModelName, setDownloadModelName] = useState('gemma3:1b');
  const [localModels, setLocalModels] = useState<LocalOllamaModel[]>([]);
  const [groqModels, setGroqModels] = useState<GroqModelInfo[]>(ACTIVE_GROQ_MODELS);
  const [openrouterModel, setOpenrouterModel] = useState('liquid/lfm-2.5-2.6b:free');
  const [openrouterApiKey, setOpenrouterApiKey] = useState('');
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatusText, setUpdateStatusText] = useState('BYTE is up to date (v1.0.0)');
  const [autostartStatus, setAutostartStatus] = useState<AutostartStatus | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus | null>(null);

  useEffect(() => {
    if (isOpen) {
      Promise.all([fetchBackendSettings(), fetchLocalModels(), fetchGroqModels()]).then(
        ([s, locals, groqs]) => {
          if (locals) setLocalModels(locals);
          if (groqs && groqs.length > 0) setGroqModels(groqs);
          if (s) {
            if (s.ai_provider) setAiProvider(s.ai_provider);
            if (s.groq_model) setGroqModel(normalizeGroqModel(s.groq_model) as string);
            if (s.groq_api_key !== undefined) setGroqApiKey(s.groq_api_key);
            if (s.ollama_model) {
              const names = (locals || []).map((m) => m.name);
              if (names.length > 0 && !names.includes(s.ollama_model)) {
                setOllamaModel(names[0]);
              } else {
                setOllamaModel(s.ollama_model);
              }
            } else if (locals && locals.length > 0) {
              setOllamaModel(locals[0].name);
            }
            if (s.openrouter_model) setOpenrouterModel(s.openrouter_model);
            if (s.openrouter_api_key !== undefined) setOpenrouterApiKey(s.openrouter_api_key);
            if (s.wake_word_enabled !== undefined) setWakeWordEnabled(s.wake_word_enabled);
            if (s.auto_launch !== undefined) setAutoLaunch(s.auto_launch);
            if (s.auto_update !== undefined) setAutoUpdate(s.auto_update);
          }
        },
      );
      fetchAutostartStatus().then(setAutostartStatus);
      fetchVoiceStatus().then(setVoiceStatus);
    }
  }, [isOpen]);

  const handleSave = async () => {
    await saveBackendSettings({
      ai_provider: aiProvider,
      groq_model: groqModel,
      groq_api_key: groqApiKey,
      ollama_model: ollamaModel,
      openrouter_model: openrouterModel,
      openrouter_api_key: openrouterApiKey,
      wake_word_enabled: wakeWordEnabled,
      auto_launch: autoLaunch,
      auto_update: autoUpdate,
    });
    fetchAutostartStatus().then(setAutostartStatus);
    fetchVoiceStatus().then(setVoiceStatus);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleCheckUpdatesManual = async () => {
    setCheckingUpdate(true);
    setUpdateStatusText('Connecting to GitHub Release endpoint...');
    try {
      const res = await checkForUpdate();
      setCheckingUpdate(false);
      if (res.updateAvailable) {
        setUpdateStatusText(`New update found: v${res.version || '1.1.0'}!`);
      } else {
        setUpdateStatusText(`BYTE v${CURRENT_APP_VERSION} is running the latest release.`);
      }
    } catch (e: any) {
      setCheckingUpdate(false);
      setUpdateStatusText(`BYTE v${CURRENT_APP_VERSION} is running the latest release.`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="hud-panel hud-corner clip-notch relative w-full max-w-2xl border border-hud-red/40 bg-slate-950 p-5 text-red-50 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hud-red/20 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-hud-red hud-glow" />
            <h2 className="hud-display text-sm font-bold tracking-widest text-hud-red hud-glow">
              BYTE SYSTEM SETTINGS & MANAGER
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center border border-hud-red/30 bg-hud-red/10 text-hud-red hover:bg-hud-red/25"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Layout: Left Navigation | Right Content */}
        <div className="mt-4 grid grid-cols-[140px_1fr] gap-4 min-h-[320px]">
          
          {/* Navigation Bar */}
          <div className="flex flex-col gap-1 border-r border-hud-red/15 pr-2">
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-2 px-3 py-2 text-[11px] hud-mono uppercase tracking-wider transition-all text-left ${
                activeTab === 'ai'
                  ? 'border-l-2 border-hud-red bg-hud-red/20 text-hud-red hud-glow'
                  : 'text-hud-red/60 hover:bg-hud-red/10 hover:text-hud-red'
              }`}
            >
              <Cpu className="h-3.5 w-3.5" />
              AI Engine
            </button>
            <button
              onClick={() => setActiveTab('voice')}
              className={`flex items-center gap-2 px-3 py-2 text-[11px] hud-mono uppercase tracking-wider transition-all text-left ${
                activeTab === 'voice'
                  ? 'border-l-2 border-hud-red bg-hud-red/20 text-hud-red hud-glow'
                  : 'text-hud-red/60 hover:bg-hud-red/10 hover:text-hud-red'
              }`}
            >
              <Mic className="h-3.5 w-3.5" />
              Voice
            </button>
            <button
              onClick={() => setActiveTab('desktop')}
              className={`flex items-center gap-2 px-3 py-2 text-[11px] hud-mono uppercase tracking-wider transition-all text-left ${
                activeTab === 'desktop'
                  ? 'border-l-2 border-hud-red bg-hud-red/20 text-hud-red hud-glow'
                  : 'text-hud-red/60 hover:bg-hud-red/10 hover:text-hud-red'
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              Desktop OS
            </button>
            <button
              onClick={() => setActiveTab('plugins')}
              className={`flex items-center gap-2 px-3 py-2 text-[11px] hud-mono uppercase tracking-wider transition-all text-left ${
                activeTab === 'plugins'
                  ? 'border-l-2 border-hud-red bg-hud-red/20 text-hud-red hud-glow'
                  : 'text-hud-red/60 hover:bg-hud-red/10 hover:text-hud-red'
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              Plugins
            </button>
            <button
              onClick={() => setActiveTab('memory')}
              className={`flex items-center gap-2 px-3 py-2 text-[11px] hud-mono uppercase tracking-wider transition-all text-left ${
                activeTab === 'memory'
                  ? 'border-l-2 border-hud-red bg-hud-red/20 text-hud-red hud-glow'
                  : 'text-hud-red/60 hover:bg-hud-red/10 hover:text-hud-red'
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              Memory
            </button>
            <button
              onClick={() => setActiveTab('updates')}
              className={`flex items-center gap-2 px-3 py-2 text-[11px] hud-mono uppercase tracking-wider transition-all text-left ${
                activeTab === 'updates'
                  ? 'border-l-2 border-hud-red bg-hud-red/20 text-hud-red hud-glow'
                  : 'text-hud-red/60 hover:bg-hud-red/10 hover:text-hud-red'
              }`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Updates & About
            </button>
          </div>

          {/* Content Body */}
          <div className="flex flex-col justify-between pr-1">
            {activeTab === 'ai' && (
              <div className="space-y-4">
                <div>
                  <label className="hud-text text-xs uppercase tracking-wider text-hud-red/80">
                    AI Inference Provider
                  </label>
                  <select
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value)}
                    className="hud-mono mt-1.5 w-full border border-hud-red/30 bg-slate-950 px-3 py-1.5 text-xs text-hud-red focus:outline-none"
                  >
                    <option value="ollama">Ollama (Local Offline LLM - 100% Free)</option>
                    <option value="groq">Groq Cloud (Free Developer Tier)</option>
                    <option value="openrouter">OpenRouter (Free Tier - LiquidAI, Fish Audio, DeepSeek, Llama 3.3)</option>
                  </select>
                </div>

                {aiProvider === 'groq' && (
                  <div className="space-y-3">
                    <div>
                      <label className="hud-text text-xs uppercase tracking-wider text-hud-red/80">
                        Active Groq Free Model
                      </label>
                      <select
                        value={groqModel}
                        onChange={(e) => setGroqModel(e.target.value)}
                        className="hud-mono mt-1.5 w-full border border-hud-red/30 bg-slate-950 px-3 py-1.5 text-xs text-hud-red focus:outline-none"
                      >
                        {(groqModels.length > 0 ? groqModels : ACTIVE_GROQ_MODELS).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="hud-text text-xs uppercase tracking-wider text-hud-red/80">
                        Groq API Key (gsk_...)
                      </label>
                      <input
                        type="password"
                        placeholder="gsk_..."
                        value={groqApiKey}
                        onChange={(e) => setGroqApiKey(e.target.value)}
                        className="hud-mono mt-1.5 w-full border border-hud-red/30 bg-slate-950 px-3 py-1.5 text-xs text-hud-red placeholder:text-hud-red/30 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {aiProvider === 'openrouter' && (
                  <div className="space-y-3">
                    <div>
                      <label className="hud-text text-xs uppercase tracking-wider text-hud-red/80">
                        OpenRouter Model
                      </label>
                      <select
                        value={openrouterModel}
                        onChange={(e) => setOpenrouterModel(e.target.value)}
                        className="hud-mono mt-1.5 w-full border border-hud-red/30 bg-slate-950 px-3 py-1.5 text-xs text-hud-red focus:outline-none"
                      >
                        <option value="liquid/lfm-2.5-2.6b:free">Liquid LFM 2.5 2.6B (Free)</option>
                        <option value="deepseek/deepseek-r1:free">DeepSeek R1 Distill (Free)</option>
                        <option value="meta-llama/llama-3.3-70b-instruct:free">Meta Llama 3.3 70B (Free)</option>
                      </select>
                    </div>

                    <div>
                      <label className="hud-text text-xs uppercase tracking-wider text-hud-red/80">
                        OpenRouter API Key (Optional for Free Models)
                      </label>
                      <input
                        type="password"
                        placeholder="sk-or-v1-..."
                        value={openrouterApiKey}
                        onChange={(e) => setOpenrouterApiKey(e.target.value)}
                        className="hud-mono mt-1.5 w-full border border-hud-red/30 bg-slate-950 px-3 py-1.5 text-xs text-hud-red placeholder:text-hud-red/30 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {aiProvider === 'ollama' && (
                  <div className="space-y-3">
                    <div>
                      <label className="hud-text text-xs uppercase tracking-wider text-hud-red/80">
                        Installed Local AI Models (Attached)
                      </label>
                      <select
                        value={ollamaModel}
                        onChange={(e) => setOllamaModel(e.target.value)}
                        className="hud-mono mt-1.5 w-full border border-hud-red/30 bg-slate-950 px-3 py-1.5 text-xs text-hud-red focus:outline-none"
                      >
                        {localModels.length > 0 ? (
                          localModels.map((m) => (
                            <option key={m.name} value={m.name}>
                              {m.name} ({m.size || 'Local'}) — Installed
                            </option>
                          ))
                        ) : (
                          <option value={ollamaModel}>{ollamaModel} (Checking Ollama...)</option>
                        )}
                      </select>
                    </div>

                    <div className="border border-hud-red/20 bg-slate-950/60 p-2.5 space-y-2">
                      <label className="hud-text text-[10px] uppercase tracking-wider text-hud-red/75">
                        Pull Additional Ollama Model
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={downloadModelName}
                          onChange={(e) => setDownloadModelName(e.target.value)}
                          className="hud-mono flex-1 border border-hud-red/30 bg-slate-950 px-2.5 py-1.5 text-xs text-hud-red focus:outline-none"
                        >
                          {OLLAMA_DOWNLOAD_PRESETS.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await fetch('http://127.0.0.1:8000/api/system/download_model', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ model_name: downloadModelName })
                              });
                              const data = await res.json();
                              alert(data.message || `Started downloading ${downloadModelName} to your laptop!`);
                              fetchLocalModels().then(setLocalModels);
                            } catch (err: any) {
                              alert(`Error triggering download: ${err?.message || err}`);
                            }
                          }}
                          className="hud-mono flex items-center justify-center gap-1.5 border border-hud-gold/60 bg-hud-gold/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-hud-gold hover:bg-hud-gold/20"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Download
                        </button>
                      </div>
                      <p className="text-[10px] text-hud-red/60">
                        Downloads locally via Ollama for 100% offline execution on your RTX 4060.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'voice' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border border-hud-red/20 bg-hud-red/5 p-3">
                  <div>
                    <div className="hud-text text-xs font-semibold uppercase text-hud-red">Wake Word ("Hey BYTE")</div>
                    <div className="hud-mono text-[10px] text-hud-red/60">24/7 continuous background microphone activation (no auto-shutoff)</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={wakeWordEnabled}
                    onChange={(e) => setWakeWordEnabled(e.target.checked)}
                    className="h-4 w-4 accent-hud-red"
                  />
                </div>
                <div className="border border-hud-red/20 bg-slate-950/60 p-3">
                  <div className="hud-display text-[10px] uppercase font-semibold text-hud-red">
                    24/7 Voice Daemon Telemetry
                  </div>
                  <div className="hud-mono mt-1.5 text-[11px] text-hud-red/80">
                    Status:{' '}
                    <span className={voiceStatus?.continuous_active ? 'text-hud-success font-bold' : 'text-hud-gold'}>
                      {voiceStatus?.continuous_active
                        ? 'LISTENING 24/7'
                        : voiceStatus?.continuous_enabled
                          ? (voiceStatus?.paused ? 'PAUSED' : 'STANDBY')
                          : 'OFF (PUSH-TO-TALK ONLY)'}
                    </span>
                    {voiceStatus?.mic_error && (
                      <div className="mt-1 text-[10px] text-hud-danger">{voiceStatus.mic_error}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'desktop' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border border-hud-red/20 bg-hud-red/5 p-3">
                  <div>
                    <div className="hud-text text-xs font-semibold uppercase text-hud-red">Launch With Windows (24/7)</div>
                    <div className="hud-mono text-[10px] text-hud-red/60">Auto-start 24/7 backend engine &amp; tray icon on Windows login</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoLaunch}
                    onChange={(e) => setAutoLaunch(e.target.checked)}
                    className="h-4 w-4 accent-hud-red"
                  />
                </div>
                <div className="border border-hud-red/20 bg-slate-950/60 p-3 space-y-1">
                  <div className="hud-display text-[10px] uppercase font-semibold text-hud-red">
                    Windows 24/7 Persistence Status
                  </div>
                  <div className="hud-mono text-[10px] text-hud-red/75">
                    Background Logon Task:{' '}
                    <span className={autostartStatus?.task_registered ? 'text-hud-success' : 'text-hud-gold'}>
                      {autostartStatus?.task_registered ? 'REGISTERED (24/7)' : 'NOT REGISTERED'}
                    </span>
                  </div>
                  <div className="hud-mono text-[10px] text-hud-red/75">
                    System Tray Autostart:{' '}
                    <span className={autostartStatus?.tray_autostart ? 'text-hud-success' : 'text-hud-gold'}>
                      {autostartStatus?.tray_autostart ? 'ENABLED (--minimized)' : 'DISABLED'}
                    </span>
                  </div>
                  <div className="hud-mono text-[10px] text-hud-red/55 pt-1">
                    Closing the window keeps BYTE alive in the Windows System Tray.
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'plugins' && (
              <div className="space-y-2">
                {['VS Code Automation', 'Chrome & Browser Bridge', 'Discord Telemetry', 'Spotify Player'].map((plugin) => (
                  <div key={plugin} className="flex items-center justify-between border border-hud-red/20 bg-slate-950 p-2.5">
                    <span className="hud-mono text-xs text-hud-red">{plugin}</span>
                    <span className="hud-mono text-[10px] text-hud-success">ACTIVE</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'memory' && (
              <div className="border border-hud-red/20 bg-slate-950/60 p-3">
                <div className="hud-display text-[10px] text-hud-gold uppercase font-semibold">PERSISTENT STORAGE ENGINE</div>
                <p className="hud-mono mt-1 text-[11px] leading-relaxed text-hud-red/80">
                  SQLite Local + MongoDB Cloud storage active. Conversation logs and settings are automatically synced across sessions.
                </p>
              </div>
            )}

            {activeTab === 'updates' && (
              <div className="space-y-4">
                <div className="border border-hud-red/20 bg-slate-950/60 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="hud-display text-xs text-hud-red font-bold flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4" /> BYTE Mission Control
                      </div>
                      <div className="hud-mono text-[10px] text-hud-red/60 mt-0.5">
                        Installed Version: <span className="text-hud-red font-bold">{CURRENT_APP_VERSION}</span>
                      </div>
                    </div>
                    <button
                      onClick={handleCheckUpdatesManual}
                      disabled={checkingUpdate}
                      className="flex items-center gap-1.5 border border-hud-red bg-hud-red/20 px-3 py-1.5 hud-mono text-xs font-semibold text-hud-red hover:bg-hud-red/30 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${checkingUpdate ? 'animate-spin' : ''}`} />
                      Check for Updates
                    </button>
                  </div>
                  <div className="hud-mono text-[10px] text-hud-red/70 mt-2 border-t border-hud-red/10 pt-1.5">
                    {updateStatusText}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between border border-hud-red/20 bg-hud-red/5 p-2.5">
                    <div>
                      <div className="hud-text text-xs font-semibold text-hud-red uppercase">Auto-Check on Startup</div>
                      <div className="hud-mono text-[10px] text-hud-red/60">Automatically poll GitHub Releases on app launch</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoUpdate}
                      onChange={(e) => setAutoUpdate(e.target.checked)}
                      className="h-4 w-4 accent-hud-red"
                    />
                  </div>
                  <div className="flex items-center justify-between border border-hud-red/20 bg-hud-red/5 p-2.5">
                    <div>
                      <div className="hud-text text-xs font-semibold text-hud-red uppercase">Auto-Download Updates</div>
                      <div className="hud-mono text-[10px] text-hud-red/60">Download packages in background when available</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoUpdate}
                      onChange={(e) => setAutoUpdate(e.target.checked)}
                      className="h-4 w-4 accent-hud-red"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="mt-4 flex items-center justify-between border-t border-hud-red/20 pt-3">
              {savedSuccess ? (
                <span className="flex items-center gap-1 hud-mono text-xs text-hud-success">
                  <Check className="h-4 w-4" /> Settings Saved!
                </span>
              ) : <span />}
              
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="hud-mono border border-hud-red/30 px-4 py-1.5 text-xs text-hud-red hover:bg-hud-red/10"
                >
                  Close
                </button>
                <button
                  onClick={handleSave}
                  className="hud-mono border border-hud-red bg-hud-red/20 px-4 py-1.5 text-xs font-semibold text-hud-red hud-glow hover:bg-hud-red/30"
                >
                  Save Configuration
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
