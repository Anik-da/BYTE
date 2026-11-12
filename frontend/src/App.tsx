import { useCallback, useEffect, useRef, useState } from 'react';
import { BootSequence } from '@/components/BootSequence';
import { ArcReactor } from '@/components/ArcReactor';
import { SystemPanel } from '@/components/SystemPanel';
import { soundFx } from '@/lib/soundFx';
import { ConversationLog, type Message } from '@/components/ConversationLog';
import { DiagnosticsOverlay } from '@/components/DiagnosticsOverlay';
import { StatusBar } from '@/components/StatusBar';
import { RadarSweep } from '@/components/RadarSweep';
import { NeuralNetwork } from '@/components/NeuralNetwork';
import { DataStream } from '@/components/DataStream';
import { ThreatPanel } from '@/components/ThreatPanel';
import { WorldClock } from '@/components/WorldClock';
import { EventLog } from '@/components/EventLog';
import { QuickCommands } from '@/components/QuickCommands';
import { useSpeech } from '@/hooks/useSpeech';
import { parseCommand } from '@/lib/commandEngine';
import { askGroq, DEFAULT_GROQ_MODEL, normalizeGroqModel, type GroqModel } from '@/lib/groq';
import { FileNavigator } from '@/components/FileNavigator';
import { SettingsModal } from '@/components/settings/SettingsModal';
import {
  sendDesktopCommand,
  fetchConversationHistory,
  clearConversationHistory,
  fetchBackendSettings,
  saveBackendSettings,
  fetchVoiceStatus,
  fetchVoiceEvents,
  armVoiceListening,
  disarmVoiceListening,
  stopBackendSpeech,
  toggleContinuousVoice,
  setBackendVoiceMuted,
  fetchLocalModels,
  fetchGroqModels,
  type VoiceStatus,
  type LocalOllamaModel,
  type GroqModelInfo,
} from '@/lib/desktopApi';
import { UpdateDialog } from '@/components/UpdateDialog';
import { checkForUpdate } from '@/lib/updater';
import { Update } from '@tauri-apps/plugin-updater';
import { WorldMapBackground } from '@/components/WorldMapBackground';

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function App() {
  const [booted, setBooted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [muted, setMuted] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [scanActive, setScanActive] = useState(false);
  const [lockdownActive, setLockdownActive] = useState(false);
  const [decryptActive, setDecryptActive] = useState(false);
  const [selectedModel, setSelectedModel] = useState<GroqModel>(DEFAULT_GROQ_MODEL);
  const [loading, setLoading] = useState(false);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [updateVersion, setUpdateVersion] = useState('1.1.0');
  const [updateNotes, setUpdateNotes] = useState('');
  const [updateObj, setUpdateObj] = useState<Update | null>(null);

  const handleResultRef = useRef<(text: string) => void>(() => {});
  const handleSpeechCommand = useCallback((text: string) => {
    const raw = text.trim();
    if (!raw) return;
    const wakeWordPattern = /\b(hey\s+byte|byte|hey\s+jarvis|jarvis|wake\s+up|wake\s+up\s+byte|hello\s+byte|ok\s+byte|computer)\b/i;
    const match = raw.toLowerCase().match(wakeWordPattern);
    if (match && match.index !== undefined) {
      const commandIndex = match.index + match[0].length;
      const extracted = raw.slice(commandIndex).replace(/^[,\s.:?!]+/, '').trim();
      if (extracted) {
        soundFx.playChirp();
        handleResultRef.current?.(extracted);
        return;
      }
    }
    handleResultRef.current?.(raw);
  }, []);
  const speech = useSpeech({ onSpeechCommand: handleSpeechCommand, autoStart: false });
  const pendingTranscriptRef = useRef(false);

  const [backendVoice, setBackendVoice] = useState<VoiceStatus | null>(null);
  const lastVoiceSeqRef = useRef<number | null>(null);
  const voiceSyncInFlightRef = useRef(false);

  const [aiProvider, setAiProvider] = useState<'ollama' | 'groq' | 'openrouter'>('groq');
  const [ollamaModel, setOllamaModel] = useState<string>('gemma3:4b');
  const [openrouterModel, setOpenrouterModel] = useState<string>('liquid/lfm-2.5-2.6b:free');
  const [localModels, setLocalModels] = useState<LocalOllamaModel[]>([]);
  const [groqModels, setGroqModels] = useState<GroqModelInfo[]>([]);

  const syncSettings = useCallback(() => {
    Promise.all([fetchBackendSettings(), fetchLocalModels(), fetchGroqModels()]).then(
      ([s, locals, groqs]) => {
        if (locals && locals.length > 0) setLocalModels(locals);
        if (groqs && groqs.length > 0) setGroqModels(groqs);
        if (s) {
          if (s.ai_provider) setAiProvider(s.ai_provider as any);
          if (s.ollama_model) {
            const installedNames = (locals || []).map((m) => m.name);
            if (installedNames.length > 0 && !installedNames.includes(s.ollama_model)) {
              setOllamaModel(installedNames[0]);
            } else {
              setOllamaModel(s.ollama_model);
            }
          } else if (locals && locals.length > 0) {
            setOllamaModel(locals[0].name);
          }
          if (s.openrouter_model) setOpenrouterModel(s.openrouter_model);
          if (s.groq_model) setSelectedModel(normalizeGroqModel(s.groq_model));
          if (s.voice_muted !== undefined) setMuted(Boolean(s.voice_muted));
        }
      },
    );
  }, []);

  useEffect(() => {
    if (booted) syncSettings();
  }, [booted, syncSettings]);

  const handleUpdateModelSetting = useCallback(async (provider: 'ollama' | 'groq' | 'openrouter', model: string) => {
    setAiProvider(provider);
    if (provider === 'ollama') setOllamaModel(model);
    else if (provider === 'openrouter') setOpenrouterModel(model);
    else setSelectedModel(model as GroqModel);

    try {
      await saveBackendSettings({
        ai_provider: provider,
        ollama_model: provider === 'ollama' ? model : ollamaModel,
        openrouter_model: provider === 'openrouter' ? model : openrouterModel,
        groq_model: provider === 'groq' ? model : selectedModel,
      });
    } catch (err) {
      console.warn("Failed to persist model setting:", err);
    }
  }, [ollamaModel, openrouterModel, selectedModel]);

  // Check for updates after boot
  useEffect(() => {
    if (!booted) return;
    checkForUpdate().then((res) => {
      if (res.updateAvailable) {
        setUpdateVersion(res.version || '1.1.0');
        setUpdateNotes(res.body || '• Enhanced performance\n• Dynamic dynamic system automation\n• Security patch');
        setUpdateObj(res.updateObj);
        setIsUpdateOpen(true);
      }
    });
  }, [booted]);

  // Load conversation history after boot
  useEffect(() => {
    if (!booted) return;
    fetchConversationHistory().then((history) => {
      if (history && history.length > 0) {
        setMessages(history);
      } else {
        const greeting: Message = {
          id: makeId(),
          role: 'byte',
          text: 'BYTE online. All systems operational. How may I assist you?',
          time: nowTime(),
        };
        setMessages([greeting]);
        if (!muted) {
          setTimeout(() => speech.speak(greeting.text), 400);
        }
      }
    });
  }, [booted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync live 24/7 backend voice listener state & spoken command log
  useEffect(() => {
    if (!booted) return;
    let active = true;

    const pollVoice = async () => {
      if (voiceSyncInFlightRef.current) return;
      voiceSyncInFlightRef.current = true;
      try {
        const vs = await fetchVoiceStatus();
        if (!active || !vs) return;
        setBackendVoice(vs);

        if (lastVoiceSeqRef.current === null) {
          lastVoiceSeqRef.current = vs.event_seq;
          return;
        }

        if (vs.event_seq > lastVoiceSeqRef.current) {
          const res = await fetchVoiceEvents(lastVoiceSeqRef.current);
          if (!active) return;
          lastVoiceSeqRef.current = res.seq;
          if (res.events && res.events.length > 0) {
            setMessages((prev) => {
              const seen = new Set(prev.map((m) => m.id));
              const appended: Message[] = [];
              for (const evt of res.events) {
                if (!seen.has(evt.id)) {
                  appended.push({
                    id: evt.id,
                    role: evt.role,
                    text: evt.text,
                    time: new Date(evt.timestamp * 1000).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  });
                }
              }
              return appended.length > 0 ? [...prev, ...appended] : prev;
            });
          }
        }
      } finally {
        voiceSyncInFlightRef.current = false;
      }
    };

    pollVoice();
    const interval = setInterval(pollVoice, 800);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [booted]);

  const handleResult = useCallback(
    async (userText: string) => {
      const userMsg: Message = {
        id: makeId(),
        role: 'user',
        text: userText,
        time: nowTime(),
      };

      const result = parseCommand(userText);

      // Handle UI-only simulation commands (clear_log, scan, lockdown, reboot)
      if (['clear_log', 'scan', 'lockdown', 'decrypt', 'reboot'].includes(result.action || '')) {
        const byteMsg: Message = {
          id: makeId(),
          role: 'byte',
          text: result.response,
          time: nowTime(),
        };
        setMessages((prev) => [...prev, userMsg, byteMsg]);

        if (result.action === 'clear_log') setMessages([byteMsg]);
        if (result.action === 'scan') {
          setScanActive(true);
          setTimeout(() => setScanActive(false), 4000);
        }
        if (result.action === 'lockdown') {
          setLockdownActive(true);
          setTimeout(() => setLockdownActive(false), 5000);
        }
        if (result.action === 'decrypt') {
          setDecryptActive(true);
          setTimeout(() => setDecryptActive(false), 4000);
        }
        if (result.action === 'reboot') {
          setMessages([byteMsg]);
          setTimeout(() => {
            setBooted(false);
            setMessages([]);
          }, 1500);
        }

        if (!muted) {
          setTimeout(() => speech.speak(result.response), 250);
        }
        return;
      }

      // Send all real automation & AI queries to local FastAPI backend
      // The backend handles AI inference using the API key saved in Settings
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      try {
        const desktopRes = await sendDesktopCommand(userText);
        const responseText = desktopRes.response;

        const byteMsg: Message = {
          id: makeId(),
          role: 'byte',
          text: responseText,
          time: nowTime(),
        };
        setMessages((prev) => [...prev, byteMsg]);

        if (!muted) {
          setTimeout(() => speech.speak(responseText), 250);
        }
      } catch (err) {
        console.error('Desktop command execution error:', err);
        const byteMsg: Message = {
          id: makeId(),
          role: 'byte',
          text: 'Backend engine offline. Please verify Python backend is running on localhost:8000. Start it with: python backend/main.py',
          time: nowTime(),
        };
        setMessages((prev) => [...prev, byteMsg]);
      } finally {
        setLoading(false);
      }
    },
    [muted, selectedModel]
  );
  handleResultRef.current = handleResult;

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    handleResult(text);
  }, [input, handleResult]);

  const handleQuickCommand = useCallback(
    (cmd: string) => {
      handleResult(cmd);
    },
    [handleResult],
  );

  const handleToggleListen = useCallback(async () => {
    if (backendVoice && !backendVoice.mic_error) {
      if (backendVoice.is_speaking) {
        await stopBackendSpeech();
        const updated = await fetchVoiceStatus();
        if (updated) setBackendVoice(updated);
        return;
      }
      if (backendVoice.armed) {
        const updated = await disarmVoiceListening();
        if (updated) setBackendVoice(updated);
        return;
      }
      soundFx.playWakeChime();
      const updated = await armVoiceListening();
      if (updated) setBackendVoice(updated);
      return;
    }

    if (speech.listening) {
      speech.stopListening();
      pendingTranscriptRef.current = true;
    } else {
      pendingTranscriptRef.current = true;
      speech.startListening();
    }
  }, [backendVoice, speech]);

  const handleToggleWakeWord = useCallback(async () => {
    const currentlyOn = Boolean(backendVoice?.continuous_enabled && !backendVoice?.paused);
    const nextEnabled = !currentlyOn;
    await saveBackendSettings({ wake_word_enabled: nextEnabled });
    const updated = await fetchVoiceStatus();
    if (updated) setBackendVoice(updated);
  }, [backendVoice]);

  const handleToggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      if (next) speech.cancelSpeech();
      void setBackendVoiceMuted(next);
      return next;
    });
  }, [speech]);

  const handleClearHistory = useCallback(async () => {
    await clearConversationHistory();
    setMessages([]);
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-radial-fade bg-grid text-red-50">
      {/* Ambient scanline overlay */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute left-0 h-px w-full bg-gradient-to-r from-transparent via-hud-red/30 to-transparent animate-scan" />
      </div>

      {/* Action overlays */}
      {scanActive && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-slate-950/40">
          <div className="hud-panel hud-corner clip-notch px-8 py-4 animate-fade-in">
            <div className="hud-display text-sm font-bold tracking-widest text-hud-red hud-glow animate-pulse">
              SCANNING SECTORS...
            </div>
          </div>
        </div>
      )}
      {lockdownActive && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-hud-danger/10">
          <div className="hud-panel-bright hud-corner clip-notch border-hud-danger/60 px-8 py-4 animate-fade-in">
            <div className="hud-display text-sm font-bold tracking-widest text-hud-danger hud-glow-strong animate-pulse">
              LOCKDOWN ENGAGED
            </div>
          </div>
        </div>
      )}
      {decryptActive && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-slate-950/40">
          <div className="hud-panel hud-corner clip-notch px-8 py-4 animate-fade-in">
            <div className="hud-display text-sm font-bold tracking-widest text-hud-gold hud-glow animate-pulse">
              DECRYPTING SIGNAL...
            </div>
          </div>
        </div>
      )}

      {!booted && <BootSequence onComplete={() => setBooted(true)} />}

      {showDiagnostics && (
        <DiagnosticsOverlay onComplete={() => setShowDiagnostics(false)} />
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          syncSettings();
        }}
      />

      <UpdateDialog
        isOpen={isUpdateOpen}
        onClose={() => setIsUpdateOpen(false)}
        version={updateVersion}
        releaseNotes={updateNotes}
        updateObj={updateObj}
      />

      {booted && (
        <div className="flex h-screen w-screen flex-col overflow-hidden p-3 bg-grid bg-radial-fade">
          <div className="shrink-0 mb-2">
            <StatusBar onOpenSettings={() => setIsSettingsOpen(true)} />
          </div>

          {/* Main grid: left column | center | right column */}
          <div className="grid flex-1 grid-cols-1 gap-2.5 overflow-hidden lg:grid-cols-[280px_1fr_340px]">
            {/* Left column */}
            <div className="hidden flex-col gap-2.5 overflow-hidden lg:flex">
              <SystemPanel
                speaking={speech.speaking || Boolean(backendVoice?.is_speaking)}
                listening={speech.listening || Boolean(backendVoice?.armed) || Boolean(backendVoice?.is_listening)}
              />
              <div className="min-h-0 flex-1 overflow-hidden">
                <EventLog />
              </div>
            </div>

            {/* Center column */}
            <div className="relative flex min-h-0 flex-col items-center justify-between overflow-hidden py-2">
              <WorldMapBackground />
              <div className="relative flex flex-col items-center my-auto">
                <ArcReactor
                  active={booted}
                  speaking={speech.speaking || Boolean(backendVoice?.is_speaking)}
                  listening={speech.listening || Boolean(backendVoice?.armed)}
                  onClick={handleToggleListen}
                />
                <div className="mt-3 text-center">
                  <div className="hud-display text-2xl font-black tracking-[0.3em] text-hud-red hud-glow-strong">
                    BYTE
                  </div>
                  <div className="hud-text mt-1 text-xs uppercase tracking-widest text-hud-red/60">
                    {speech.listening || backendVoice?.armed
                      ? 'Listening... Speak your command'
                      : backendVoice?.transcribing
                        ? 'Processing voice...'
                        : speech.speaking || backendVoice?.is_speaking
                          ? 'Responding...'
                          : muted || backendVoice?.muted
                            ? 'Voice muted'
                            : backendVoice?.continuous_active && !backendVoice?.paused
                              ? '24/7 Wake Word Active ("Hey BYTE")'
                              : backendVoice?.paused
                                ? '24/7 Wake Word Paused'
                                : 'Standing by'}
                  </div>
                  {backendVoice && (
                    <button
                      type="button"
                      onClick={handleToggleWakeWord}
                      className={`mt-2 border px-2.5 py-0.5 hud-mono text-[10px] uppercase tracking-wider transition-colors ${
                        backendVoice.continuous_active && !backendVoice.paused
                          ? 'border-hud-success/50 bg-hud-success/10 text-hud-success hover:bg-hud-success/20'
                          : 'border-hud-red/30 bg-hud-red/10 text-hud-red/70 hover:bg-hud-red/20'
                      }`}
                    >
                      {backendVoice.continuous_active && !backendVoice.paused
                        ? '● 24/7 Mic Always On (Click to Turn Off)'
                        : '○ 24/7 Mic Off (Click to Enable)'}
                    </button>
                  )}
                </div>
              </div>

              {/* Radar + Neural side by side */}
              <div className="mt-2 grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2 shrink-0">
                <div className="hud-panel hud-corner flex flex-col items-center p-2.5">
                  <h3 className="hud-display mb-1.5 text-[10px] font-bold tracking-widest text-hud-red hud-glow">
                    RADAR SWEEP
                  </h3>
                  <RadarSweep active={booted} />
                </div>
                <div className="hud-panel hud-corner flex flex-col p-2.5">
                  <h3 className="hud-display mb-1.5 text-[10px] font-bold tracking-widest text-hud-red hud-glow">
                    NEURAL NETWORK
                  </h3>
                  <div className="h-[120px] w-full">
                    <NeuralNetwork />
                  </div>
                </div>
              </div>

              {/* Mobile system panel */}
              <div className="mt-2 w-full max-w-sm lg:hidden">
                <SystemPanel
                  speaking={speech.speaking || Boolean(backendVoice?.is_speaking)}
                  listening={speech.listening || Boolean(backendVoice?.armed) || Boolean(backendVoice?.is_listening)}
                />
              </div>
            </div>

            {/* Right column */}
            <div className="hidden flex-col gap-2.5 overflow-hidden lg:flex">
              <div className="grid grid-cols-2 gap-2.5 shrink-0">
                <ThreatPanel />
                <WorldClock />
              </div>
              <div className="h-[140px] shrink-0">
                <FileNavigator
                  activeFileId={activeFileId}
                  onSelectFile={setActiveFileId}
                />
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <ConversationLog
                  messages={messages}
                  input={input}
                  setInput={setInput}
                  onSend={handleSend}
                  listening={speech.listening || Boolean(backendVoice?.armed)}
                  interim={speech.interim}
                  onToggleListen={handleToggleListen}
                  speaking={speech.speaking || Boolean(backendVoice?.is_speaking)}
                  muted={muted}
                  onToggleMute={handleToggleMute}
                  speechSupported={speech.supported}
                  selectedModel={selectedModel}
                  setSelectedModel={setSelectedModel}
                  aiProvider={aiProvider}
                  ollamaModel={ollamaModel}
                  openrouterModel={openrouterModel}
                  localModels={localModels}
                  groqModels={groqModels}
                  onUpdateModelSetting={handleUpdateModelSetting}
                  onClearHistory={handleClearHistory}
                  loading={loading}
                />
              </div>
            </div>

            {/* Mobile/tablet conversation log (full width) */}
            <div className="min-h-0 flex-1 lg:hidden">
              <ConversationLog
                messages={messages}
                input={input}
                setInput={setInput}
                onSend={handleSend}
                listening={speech.listening || Boolean(backendVoice?.armed)}
                interim={speech.interim}
                onToggleListen={handleToggleListen}
                speaking={speech.speaking || Boolean(backendVoice?.is_speaking)}
                muted={muted}
                onToggleMute={handleToggleMute}
                speechSupported={speech.supported}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                aiProvider={aiProvider}
                ollamaModel={ollamaModel}
                openrouterModel={openrouterModel}
                localModels={localModels}
                groqModels={groqModels}
                onUpdateModelSetting={handleUpdateModelSetting}
                onClearHistory={handleClearHistory}
                loading={loading}
              />
            </div>
          </div>

          {/* Quick commands bar */}
          <div className="mt-2 shrink-0">
            <QuickCommands onCommand={handleQuickCommand} />
          </div>

          {speech.error && (
            <div className="mt-1 shrink-0 border border-hud-danger/40 bg-hud-danger/10 px-3 py-1 hud-mono text-[11px] text-hud-danger">
              {speech.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
