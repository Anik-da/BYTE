import { useEffect, useRef } from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX, Trash2 } from 'lucide-react';

export interface Message {
  id: string;
  role: 'user' | 'byte';
  text: string;
  time: string;
}

interface ConversationLogProps {
  messages: Message[];
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  listening: boolean;
  interim: string;
  onToggleListen: () => void;
  speaking: boolean;
  muted: boolean;
  onToggleMute: () => void;
  speechSupported: boolean;
  selectedModel: string;
  setSelectedModel: (m: any) => void;
  aiProvider?: 'ollama' | 'groq' | 'openrouter';
  ollamaModel?: string;
  openrouterModel?: string;
  onUpdateModelSetting?: (provider: 'ollama' | 'groq' | 'openrouter', model: string) => void;
  onClearHistory?: () => void;
  loading: boolean;
}

export function ConversationLog({
  messages,
  input,
  setInput,
  onSend,
  listening,
  interim,
  onToggleListen,
  speaking,
  muted,
  onToggleMute,
  speechSupported,
  selectedModel,
  setSelectedModel,
  aiProvider = 'groq',
  ollamaModel = 'llama3',
  openrouterModel = 'liquid/lfm-2.5-2.6b:free',
  onUpdateModelSetting,
  onClearHistory,
  loading,
}: ConversationLogProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, interim]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleSelectChange = (val: string) => {
    if (val === 'switch-groq') {
      onUpdateModelSetting?.('groq', 'groq/compound');
    } else if (val === 'switch-ollama') {
      onUpdateModelSetting?.('ollama', 'llama3');
    } else if (val === 'switch-openrouter') {
      onUpdateModelSetting?.('openrouter', 'liquid/lfm-2.5-2.6b:free');
    } else if (aiProvider === 'ollama') {
      onUpdateModelSetting?.('ollama', val);
    } else if (aiProvider === 'openrouter') {
      onUpdateModelSetting?.('openrouter', val);
    } else {
      setSelectedModel(val);
      onUpdateModelSetting?.('groq', val);
    }
  };

  const currentSelectValue =
    aiProvider === 'ollama'
      ? ollamaModel
      : aiProvider === 'openrouter'
        ? openrouterModel
        : selectedModel;

  return (
    <div className="hud-panel hud-corner flex h-full flex-col p-3.5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="hud-display text-xs font-bold tracking-widest text-hud-red hud-glow">
          COMMUNICATION LOG
        </h2>
        <div className="flex items-center gap-2">
          {loading && (
            <span className="hud-mono text-[9px] text-hud-gold animate-pulse mr-1">
              PROCESSING...
            </span>
          )}
          <select
            value={currentSelectValue}
            onChange={(e) => handleSelectChange(e.target.value)}
            className="hud-mono bg-slate-950/80 border border-hud-red/40 text-hud-red text-[9px] uppercase tracking-wider px-2 py-0.5 outline-none cursor-pointer focus:border-hud-red/85"
          >
            {aiProvider === 'ollama' ? (
              <>
                <option value="llama3" className="bg-slate-950">OLLAMA: LLAMA 3 (8B)</option>
                <option value="qwen2" className="bg-slate-950">OLLAMA: QWEN 2 (7B)</option>
                <option value="gemma2" className="bg-slate-950">OLLAMA: GEMMA 2 (9B)</option>
                <option value="deepseek-coder" className="bg-slate-950">OLLAMA: DEEPSEEK CODER</option>
                <option value="switch-openrouter" className="bg-slate-950 text-hud-gold">🌐 SWITCH TO OPENROUTER</option>
                <option value="switch-groq" className="bg-slate-950 text-hud-gold">⚙️ SWITCH TO GROQ CLOUD</option>
              </>
            ) : aiProvider === 'openrouter' ? (
              <>
                <option value="liquid/lfm-2.5-2.6b:free" className="bg-slate-950">OPENROUTER: LIQUID AI LFM2.5 (FREE)</option>
                <option value="fish-audio/s2.1-pro:free" className="bg-slate-950">OPENROUTER: FISH AUDIO S2.1 (FREE)</option>
                <option value="deepseek/deepseek-r1:free" className="bg-slate-950">OPENROUTER: DEEPSEEK R1 (FREE)</option>
                <option value="meta-llama/llama-3.3-70b-instruct:free" className="bg-slate-950">OPENROUTER: LLAMA 3.3 70B (FREE)</option>
                <option value="switch-ollama" className="bg-slate-950 text-hud-gold">⚙️ SWITCH TO LOCAL OLLAMA</option>
                <option value="switch-groq" className="bg-slate-950 text-hud-gold">⚙️ SWITCH TO GROQ CLOUD</option>
              </>
            ) : (
              <>
                <option value="groq/compound" className="bg-slate-950">GROQ COMPOUND</option>
                <option value="groq/compound-mini" className="bg-slate-950">GROQ COMPOUND MINI</option>
                <option value="minimaxai/minimax-m2.7" className="bg-slate-950">MINIMAX M2.7</option>
                <option value="switch-openrouter" className="bg-slate-950 text-hud-gold">🌐 SWITCH TO OPENROUTER</option>
                <option value="switch-ollama" className="bg-slate-950 text-hud-gold">⚙️ SWITCH TO LOCAL OLLAMA</option>
              </>
            )}
          </select>
          {onClearHistory && (
            <button
              onClick={onClearHistory}
              title="Clear non-required conversations from DB (Preserves permanent lifetime memory)"
              className="flex items-center justify-center p-1 border border-hud-red/40 bg-slate-950/60 text-hud-red hover:bg-hud-red/20 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
          <span className="hud-mono text-[10px] text-hud-red/50">
            {messages.length} {messages.length === 1 ? 'ENTRY' : 'ENTRIES'}
          </span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-hud-red/40">
            <Volume2 className="mb-2 h-8 w-8" />
            <p className="hud-text text-sm">Awaiting your command.</p>
            <p className="hud-mono mt-1 text-[10px]">Type below or tap the microphone</p>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex animate-slide-up ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
              <div
                className={`hud-text mb-1 text-[10px] uppercase tracking-wider ${
                  m.role === 'user' ? 'text-hud-red/60' : 'text-hud-gold/80'
                }`}
              >
                {m.role === 'user' ? 'YOU' : 'BYTE'} · {m.time}
              </div>
              <div
                className={`inline-block px-3 py-2 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'border border-hud-red/30 bg-hud-red/10 text-red-50'
                    : 'border border-hud-gold/30 bg-hud-gold/5 text-amber-50'
                }`}
                style={m.role === 'byte' ? { textShadow: '0 0 8px rgba(251,191,36,0.4)' } : undefined}
              >
                {m.text}
              </div>
            </div>
          </div>
        ))}

        {interim && (
          <div className="flex justify-end">
            <div className="max-w-[85%] text-right">
              <div className="hud-text mb-1 text-[10px] uppercase tracking-wider text-hud-red/40">
                YOU · listening...
              </div>
              <div className="inline-block border border-hud-red/20 bg-hud-red/5 px-3 py-2 text-sm italic text-red-200/60">
                {interim}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onToggleListen}
          disabled={!speechSupported}
          className={`flex h-10 w-10 shrink-0 items-center justify-center border transition-all ${
            !speechSupported
              ? 'cursor-not-allowed border-hud-red/10 text-hud-red/20'
              : listening
                ? 'animate-pulse-glow border-hud-success/60 bg-hud-success/20 text-hud-success'
                : 'border-hud-red/40 bg-hud-red/10 text-hud-red hover:bg-hud-red/20'
          }`}
          title={speechSupported ? (listening ? 'Stop listening' : 'Voice input') : 'Voice not supported'}
        >
          {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your command..."
          className="hud-mono h-10 flex-1 min-w-0 border border-hud-red/30 bg-slate-950/60 px-3 text-sm text-hud-red placeholder:text-hud-red/30 focus:border-hud-red/70 focus:outline-none focus:ring-1 focus:ring-hud-red/40"
        />

        <button
          onClick={onSend}
          disabled={!input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center border border-hud-red/40 bg-hud-red/10 text-hud-red transition-all hover:bg-hud-red/20 disabled:cursor-not-allowed disabled:opacity-30"
          title="Send"
        >
          <Send className="h-5 w-5" />
        </button>

        <button
          onClick={onToggleMute}
          className={`flex h-10 w-10 shrink-0 items-center justify-center border transition-all ${
            muted
              ? 'border-hud-danger/40 bg-hud-danger/10 text-hud-danger'
              : 'border-hud-red/40 bg-hud-red/10 text-hud-red hover:bg-hud-red/20'
          }`}
          title={muted ? 'Unmute BYTE voice' : 'Mute BYTE voice'}
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
