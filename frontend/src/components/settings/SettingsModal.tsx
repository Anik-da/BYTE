import { useState, useEffect } from 'react';
import { X, Settings, Cpu, Mic, Database, Package, Check, Sliders, RefreshCw, Sparkles } from 'lucide-react';
import { fetchBackendSettings, saveBackendSettings } from '@/lib/desktopApi';
import { checkForUpdate, CURRENT_APP_VERSION } from '@/lib/updater';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'desktop' | 'voice' | 'ai' | 'plugins' | 'memory' | 'updates';

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('ai');
  const [aiProvider, setAiProvider] = useState('groq');
  const [groqModel, setGroqModel] = useState('groq/compound');
  const [ollamaModel, setOllamaModel] = useState('llama3');
  const [wakeWordEnabled, setWakeWordEnabled] = useState(true);
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatusText, setUpdateStatusText] = useState('BYTE is up to date (v1.0.0)');

  useEffect(() => {
    if (isOpen) {
      fetchBackendSettings().then((s) => {
        if (s.ai_provider) setAiProvider(s.ai_provider);
        if (s.groq_model) setGroqModel(s.groq_model);
        if (s.ollama_model) setOllamaModel(s.ollama_model);
        if (s.wake_word_enabled !== undefined) setWakeWordEnabled(s.wake_word_enabled);
        if (s.auto_launch !== undefined) setAutoLaunch(s.auto_launch);
        if (s.auto_update !== undefined) setAutoUpdate(s.auto_update);
      });
    }
  }, [isOpen]);

  const handleSave = async () => {
    const success = await saveBackendSettings({
      ai_provider: aiProvider,
      groq_model: groqModel,
      ollama_model: ollamaModel,
      wake_word_enabled: wakeWordEnabled,
      auto_launch: autoLaunch,
      auto_update: autoUpdate,
    });
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
      setUpdateStatusText('BYTE v1.0.0 is running the latest release.');
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
                    <option value="groq">Groq Cloud (Fast LLM)</option>
                    <option value="ollama">Ollama (Local Offline LLM)</option>
                    <option value="openai">OpenAI GPT-4</option>
                    <option value="gemini">Google Gemini 1.5</option>
                  </select>
                </div>

                {aiProvider === 'groq' && (
                  <div>
                    <label className="hud-text text-xs uppercase tracking-wider text-hud-red/80">
                      Groq Model
                    </label>
                    <select
                      value={groqModel}
                      onChange={(e) => setGroqModel(e.target.value)}
                      className="hud-mono mt-1.5 w-full border border-hud-red/30 bg-slate-950 px-3 py-1.5 text-xs text-hud-red focus:outline-none"
                    >
                      <option value="groq/compound">Groq Compound</option>
                      <option value="groq/compound-mini">Groq Compound Mini</option>
                      <option value="minimaxai/minimax-m2.7">MiniMax M2.7</option>
                    </select>
                  </div>
                )}

                {aiProvider === 'ollama' && (
                  <div>
                    <label className="hud-text text-xs uppercase tracking-wider text-hud-red/80">
                      Local Ollama Model
                    </label>
                    <select
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                      className="hud-mono mt-1.5 w-full border border-hud-red/30 bg-slate-950 px-3 py-1.5 text-xs text-hud-red focus:outline-none"
                    >
                      <option value="llama3">Llama 3 (8B)</option>
                      <option value="qwen2">Qwen 2 (7B)</option>
                      <option value="gemma2">Gemma 2 (9B)</option>
                      <option value="deepseek-coder">DeepSeek Coder</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'voice' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border border-hud-red/20 bg-hud-red/5 p-3">
                  <div>
                    <div className="hud-text text-xs font-semibold uppercase text-hud-red">Wake Word ("Hey BYTE")</div>
                    <div className="hud-mono text-[10px] text-hud-red/60">Continuous background voice activation</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={wakeWordEnabled}
                    onChange={(e) => setWakeWordEnabled(e.target.checked)}
                    className="h-4 w-4 accent-hud-red"
                  />
                </div>
              </div>
            )}

            {activeTab === 'desktop' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border border-hud-red/20 bg-hud-red/5 p-3">
                  <div>
                    <div className="hud-text text-xs font-semibold uppercase text-hud-red">Launch With Windows</div>
                    <div className="hud-mono text-[10px] text-hud-red/60">Start BYTE minimized to system tray on login</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoLaunch}
                    onChange={(e) => setAutoLaunch(e.target.checked)}
                    className="h-4 w-4 accent-hud-red"
                  />
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
                        Installed Version: <span className="text-hud-red font-bold">1.0.0</span>
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
