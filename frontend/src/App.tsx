import { useCallback, useEffect, useRef, useState } from 'react';
import { BootSequence } from '@/components/BootSequence';
import { ArcReactor } from '@/components/ArcReactor';
import { SystemPanel } from '@/components/SystemPanel';
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
import { askGroq, type GroqModel } from '@/lib/groq';
import { FileNavigator } from '@/components/FileNavigator';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { sendDesktopCommand, fetchConversationHistory, clearConversationHistory, fetchBackendSettings, saveBackendSettings } from '@/lib/desktopApi';
import { UpdateDialog } from '@/components/UpdateDialog';
import { checkForUpdate } from '@/lib/updater';
import { Update } from '@tauri-apps/plugin-updater';

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
  const [selectedModel, setSelectedModel] = useState<GroqModel>('groq/compound');
  const [loading, setLoading] = useState(false);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [updateVersion, setUpdateVersion] = useState('1.1.0');
  const [updateNotes, setUpdateNotes] = useState('');
  const [updateObj, setUpdateObj] = useState<Update | null>(null);

  const speech = useSpeech();
  const pendingTranscriptRef = useRef(false);

  const [aiProvider, setAiProvider] = useState<'ollama' | 'groq' | 'openrouter'>('groq');
  const [ollamaModel, setOllamaModel] = useState<string>('llama3');
  const [openrouterModel, setOpenrouterModel] = useState<string>('liquid/lfm-2.5-2.6b:free');

  const syncSettings = useCallback(() => {
    fetchBackendSettings().then((s: Record<string, any>) => {
      if (s) {
        if (s.ai_provider) setAiProvider(s.ai_provider as any);
        if (s.ollama_model) setOllamaModel(s.ollama_model);
        if (s.openrouter_model) setOpenrouterModel(s.openrouter_model);
        if (s.groq_model) setSelectedModel(s.groq_model as GroqModel);
      }
    });
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
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      try {
        const desktopRes = await sendDesktopCommand(userText);
        let responseText = desktopRes.response;
        
        if (desktopRes.intent?.intent === 'fallback') {
          responseText = await askGroq(userText, selectedModel);
        }

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
        // Fallback to Groq cloud if backend connection fails
        try {
          const cloudResp = await askGroq(userText, selectedModel);
          const byteMsg: Message = {
            id: makeId(),
            role: 'byte',
            text: cloudResp,
            time: nowTime(),
          };
          setMessages((prev) => [...prev, byteMsg]);
          if (!muted) {
            setTimeout(() => speech.speak(cloudResp), 250);
          }
        } catch {
          const byteMsg: Message = {
            id: makeId(),
            role: 'byte',
            text: 'System command failed to execute. Verify backend engine is active on localhost:8000.',
            time: nowTime(),
          };
          setMessages((prev) => [...prev, byteMsg]);
        }
      } finally {
        setLoading(false);
      }
    },
    [muted, selectedModel]
  );

  // Wake word detection ("Hey BYTE" / "BYTE") and transcript processing
  const lastProcessedTranscriptRef = useRef('');
  useEffect(() => {
    const raw = (speech.transcript || speech.interim).trim();
    if (!raw) return;

    const lower = raw.toLowerCase();
    const wakeWordPattern = /\b(hey\s+byte|byte|wake\s+up\s+byte)\b/i;

    if (wakeWordPattern.test(lower)) {
      const match = lower.match(wakeWordPattern);
      const commandIndex = (match?.index ?? 0) + (match?.[0].length ?? 0);
      const extractedCommand = raw.slice(commandIndex).replace(/^[,\s.:?!]+/, '').trim();

      if (extractedCommand && extractedCommand !== lastProcessedTranscriptRef.current) {
        lastProcessedTranscriptRef.current = extractedCommand;
        pendingTranscriptRef.current = false;
        handleResult(extractedCommand);
      }
    } else if (!speech.listening && pendingTranscriptRef.current && speech.transcript) {
      pendingTranscriptRef.current = false;
      const text = speech.transcript.trim();
      if (text && text !== lastProcessedTranscriptRef.current) {
        lastProcessedTranscriptRef.current = text;
        handleResult(text);
      }
    }
  }, [speech.listening, speech.transcript, speech.interim, handleResult]);

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

  const handleToggleListen = useCallback(() => {
    if (speech.listening) {
      speech.stopListening();
      pendingTranscriptRef.current = true;
    } else {
      pendingTranscriptRef.current = true;
      speech.startListening();
    }
  }, [speech]);

  const handleToggleMute = useCallback(() => {
    setMuted((m) => {
      if (!m) speech.cancelSpeech();
      return !m;
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
              <SystemPanel speaking={speech.speaking} listening={speech.listening} />
              <div className="min-h-0 flex-1 overflow-hidden">
                <EventLog />
              </div>
            </div>

            {/* Center column */}
            <div className="flex min-h-0 flex-col items-center justify-between overflow-y-auto py-2">
              <div className="relative flex flex-col items-center my-auto">
                <ArcReactor
                  active={booted}
                  speaking={speech.speaking}
                  listening={speech.listening}
                />
                <div className="mt-3 text-center">
                  <div className="hud-display text-2xl font-black tracking-[0.3em] text-hud-red hud-glow-strong">
                    BYTE
                  </div>
                  <div className="hud-text mt-1 text-xs uppercase tracking-widest text-hud-red/60">
                    {speech.listening
                      ? 'Listening...'
                      : speech.speaking
                        ? 'Responding...'
                        : muted
                          ? 'Voice muted'
                          : 'Standing by'}
                  </div>
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
                <SystemPanel speaking={speech.speaking} listening={speech.listening} />
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
                  listening={speech.listening}
                  interim={speech.interim}
                  onToggleListen={handleToggleListen}
                  speaking={speech.speaking}
                  muted={muted}
                  onToggleMute={handleToggleMute}
                  speechSupported={speech.supported}
                  selectedModel={selectedModel}
                  setSelectedModel={setSelectedModel}
                  aiProvider={aiProvider}
                  ollamaModel={ollamaModel}
                  openrouterModel={openrouterModel}
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
                listening={speech.listening}
                interim={speech.interim}
                onToggleListen={handleToggleListen}
                speaking={speech.speaking}
                muted={muted}
                onToggleMute={handleToggleMute}
                speechSupported={speech.supported}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                aiProvider={aiProvider}
                ollamaModel={ollamaModel}
                openrouterModel={openrouterModel}
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
