import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Terminal as TerminalIcon, Trash2, Copy, CornerDownLeft, RefreshCw } from "lucide-react";
import { useAppStore } from "../stores/useAppStore";
import { tauriService } from "../services/tauriService";
import { GlassPanel } from "../components/ui/GlassPanel";
import { Button } from "../components/ui/Button";

export function Terminal() {
  const setCurrentPageTitle = useAppStore((s) => s.setCurrentPageTitle);
  const [shell, setShell] = useState<"powershell" | "cmd">("powershell");
  const [output, setOutput] = useState<string>("");
  const [input, setInput] = useState<string>("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isSpawning, setIsSpawning] = useState(false);
  
  const terminalId = useRef(`term-${Math.random().toString(36).substr(2, 9)}`);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentPageTitle("Terminal");
  }, [setCurrentPageTitle]);

  // Handle spawning process and listening to stdout
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    setOutput("");
    setIsSpawning(true);

    async function initTerminal() {
      try {
        await tauriService.spawnTerminal(terminalId.current, shell);
        setIsSpawning(false);
        const { listen } = await import("@tauri-apps/api/event");
        const unsub = await listen<{ session_id: string; data: string }>(
          "terminal-stdout",
          (event) => {
            if (event.payload.session_id === terminalId.current) {
              setOutput((prev) => prev + event.payload.data);
            }
          }
        );
        unlisten = unsub;
      } catch (err) {
        setOutput((prev) => prev + `\n[System Error]: Failed to spawn shell: ${err}\n`);
        setIsSpawning(false);
      }
    }

    initTerminal();

    return () => {
      if (unlisten) unlisten();
      tauriService.killTerminal(terminalId.current).catch(console.error);
    };
  }, [shell]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [output]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    try {
      const commandToSend = input + "\r\n";
      await tauriService.writeTerminalInput(terminalId.current, commandToSend);
      setHistory((prev) => [input, ...prev]);
      setHistoryIndex(-1);
      setInput("");
    } catch (err) {
      setOutput((prev) => prev + `\n[System Error]: Failed to write stdin: ${err}\n`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0 && historyIndex < history.length - 1) {
        const nextIndex = historyIndex + 1;
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput("");
      }
    }
  };

  const handleCopyAll = async () => {
    try {
      await tauriService.writeClipboard(output);
      await tauriService.showMessageDialog("Clipboard", "Terminal buffer copied to clipboard!", "info");
    } catch (err) {
      console.error(err);
    }
  };

  const handleRestart = () => {
    terminalId.current = `term-${Math.random().toString(36).substr(2, 9)}`;
    setShell(shell); // Trigger reload effect
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-[calc(100vh-140px)] gap-4"
    >
      {/* Shell Controls */}
      <GlassPanel padding="md" className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--bg-glass-heavy)] text-[var(--accent)]">
            <TerminalIcon size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Native System Shell</h3>
            <p className="text-xs text-[var(--text-muted)]">Interactive streaming terminal session</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Shell Select */}
          <div className="flex items-center rounded-lg bg-[var(--bg-glass)] p-1 border border-[var(--border-glass)]">
            {(["powershell", "cmd"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setShell(s)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  shell === s
                    ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {s === "powershell" ? "PowerShell" : "CMD"}
              </button>
            ))}
          </div>

          <Button variant="ghost" size="sm" onClick={handleRestart} title="Restart Shell" icon={<RefreshCw size={14} />} />
          <Button variant="ghost" size="sm" onClick={() => setOutput("")} title="Clear Screen" icon={<Trash2 size={14} />} />
          <Button variant="ghost" size="sm" onClick={handleCopyAll} title="Copy Output" icon={<Copy size={14} />} />
        </div>
      </GlassPanel>

      {/* Terminal View */}
      <GlassPanel padding="none" className="flex-1 flex flex-col bg-black/85 border border-[var(--border-glass)] rounded-xl overflow-hidden font-mono text-sm leading-relaxed">
        {/* Output Area */}
        <div 
          className="flex-1 p-4 overflow-y-auto whitespace-pre-wrap select-text text-neutral-300 scrollbar-thin scrollbar-thumb-neutral-800"
          onClick={() => inputRef.current?.focus()}
        >
          {isSpawning ? (
            <div className="flex items-center gap-2 text-[var(--text-muted)] animate-pulse">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-ping" />
              Spawning session for {shell}...
            </div>
          ) : (
            output || "Session initialized. Type your commands below.\n"
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex items-center border-t border-[var(--border-glass)] bg-black/40 px-4 py-3 gap-2">
          <span className="text-[var(--accent)] font-bold">{shell === "powershell" ? "PS >" : ">"}</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSpawning}
            className="flex-1 bg-transparent text-neutral-100 outline-none border-none placeholder-neutral-700 text-sm font-mono"
            placeholder="Type a command..."
            autoFocus
          />
          <button type="submit" className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors p-1 cursor-pointer">
            <CornerDownLeft size={16} />
          </button>
        </form>
      </GlassPanel>
    </motion.div>
  );
}
