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
import { sendDesktopCommand, fetchConversationHistory } from '@/lib/desktopApi';
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

      if (result.intent !== 'unknown') {
        // Handle local simulation commands locally
        const byteMsg: Message = {
          id: makeId(),
          role: 'byte',
          text: result.response,
          time: nowTime(),
        };
        setMessages((prev) => [...prev, userMsg, byteMsg]);

        if (result.action === 'run_diagnostics') {
          setShowDiagnostics(true);
        }
        if (result.action === 'clear_log') {
          setMessages([byteMsg]);
        }
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
        if (result.action === 'open_file') {
          const fid = (result.data as { fileId?: string | null })?.fileId ?? null;
          if (fid) setActiveFileId(fid);

          const url = (result.data as { url?: string })?.url;
          if (url) {
            window.open(url, '_blank');
          }

          const app = (result.data as { app?: string })?.app;
          if (app) {
            sendDesktopCommand(`open app ${app}`).catch(() => {});
          }
        }

        if (!muted) {
          setTimeout(() => speech.speak(result.response), 250);
        }
      } else {
        // Send command to local FastAPI automation backend
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
            speech.speak(responseText);
          }
        } catch (err: any) {
          const errMsg = err.message || "Failed to connect to desktop server.";
          const byteMsg: Message = {
            id: makeId(),
            role: 'byte',
            text: `[SYSTEM ALERT] ${errMsg}`,
            time: nowTime(),
          };
          setMessages((prev) => [...prev, byteMsg]);
          if (!muted) {
            speech.speak("Unable to process desktop instruction.");
          }
        } finally {
          setLoading(false);
        }
      }
    },
    [muted, speech, selectedModel],
  );

  // When listening finishes, process the transcript
  useEffect(() => {
    if (speech.listening) return;
    if (pendingTranscriptRef.current && speech.transcript) {
      pendingTranscriptRef.current = false;
      const text = speech.transcript.trim();
      if (text) handleResult(text);
    }
  }, [speech.listening, speech.transcript]); // eslint-disable-line react-hooks/exhaustive-deps

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
        onClose={() => setIsSettingsOpen(false)}
      />

      <UpdateDialog
        isOpen={isUpdateOpen}
        onClose={() => setIsUpdateOpen(false)}
        version={updateVersion}
        releaseNotes={updateNotes}
        updateObj={updateObj}
      />

      {booted && (
        <div className="flex h-full flex-col p-3 sm:p-4">
          <StatusBar onOpenSettings={() => setIsSettingsOpen(true)} />

          {/* Main grid: left column | center | right column */}
          <div className="mt-3 grid flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[280px_1fr_320px]">
            {/* Left column */}
            <div className="hidden min-h-0 flex-col gap-3 lg:flex">
              <SystemPanel speaking={speech.speaking} listening={speech.listening} />
              <div className="min-h-0 flex-1">
                <EventLog />
              </div>
            </div>

            {/* Center column */}
            <div className="flex min-h-0 flex-col items-center justify-center">
              <div className="relative flex flex-col items-center">
                <ArcReactor
                  active={booted}
                  speaking={speech.speaking}
                  listening={speech.listening}
                />
                <div className="mt-4 text-center">
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
              <div className="mt-4 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="hud-panel hud-corner clip-notch flex flex-col items-center p-3">
                  <h3 className="hud-display mb-2 text-[10px] font-bold tracking-widest text-hud-red hud-glow">
                    RADAR SWEEP
                  </h3>
                  <RadarSweep active={booted} />
                </div>
                <div className="hud-panel hud-corner clip-notch flex flex-col p-3">
                  <h3 className="hud-display mb-2 text-[10px] font-bold tracking-widest text-hud-red hud-glow">
                    NEURAL NETWORK
                  </h3>
                  <div className="h-[140px] w-full">
                    <NeuralNetwork />
                  </div>
                </div>
              </div>

              {/* Mobile system panel */}
              <div className="mt-4 w-full max-w-sm lg:hidden">
                <SystemPanel speaking={speech.speaking} listening={speech.listening} />
              </div>
            </div>

            {/* Right column */}
            <div className="hidden min-h-0 flex-col gap-2.5 lg:flex">
              <div className="grid grid-cols-2 gap-2.5">
                <ThreatPanel />
                <WorldClock />
              </div>
              <div className="h-[170px] shrink-0">
                <FileNavigator
                  activeFileId={activeFileId}
                  onSelectFile={setActiveFileId}
                />
              </div>
              <div className="min-h-0 flex-1">
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
                loading={loading}
              />
            </div>
          </div>

          {/* Quick commands bar */}
          <div className="mt-3">
            <QuickCommands onCommand={handleQuickCommand} />
          </div>

          {speech.error && (
            <div className="mt-2 border border-hud-danger/40 bg-hud-danger/10 px-3 py-1.5 hud-mono text-[11px] text-hud-danger">
              {speech.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
