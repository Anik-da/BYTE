import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, LayoutDashboard, Settings, User, Sun, Moon,
  MessageSquare, Mic, Eye, Zap, Code, Brain, Puzzle, Activity, ArrowRight,
} from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { useCommandStore } from "../../stores/useCommandStore";
import { useThemeStore } from "../../stores/useThemeStore";
import { useKeyboardShortcut } from "../../hooks/useKeyboardShortcut";
import { cn } from "../../utils/cn";

const iconMap: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard size={16} />,
  Settings: <Settings size={16} />,
  User: <User size={16} />,
  Sun: <Sun size={16} />,
  Moon: <Moon size={16} />,
  MessageSquare: <MessageSquare size={16} />,
  Mic: <Mic size={16} />,
  Eye: <Eye size={16} />,
  Zap: <Zap size={16} />,
  Code: <Code size={16} />,
  Brain: <Brain size={16} />,
  Puzzle: <Puzzle size={16} />,
  Activity: <Activity size={16} />,
};

export function CommandPalette() {
  const navigate = useNavigate();
  const open = useAppStore((s) => s.commandPaletteOpen);
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const themeMode = useThemeStore((s) => s.mode);
  const { searchQuery, setSearchQuery, selectedIndex, setSelectedIndex, registerCommands, filteredCommands } = useCommandStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const createNav = useCallback(
    (label: string, path: string, icon: string) => ({
      id: `nav-${path}`,
      label: `Go to ${label}`,
      icon,
      category: "navigation" as const,
      action: () => { navigate(path); setOpen(false); },
    }),
    [navigate, setOpen]
  );

  useEffect(() => {
    registerCommands([
      createNav("Dashboard", "/", "LayoutDashboard"),
      createNav("Settings", "/settings", "Settings"),
      createNav("Profile", "/profile", "User"),
      createNav("AI Chat", "/ai-chat", "MessageSquare"),
      createNav("Voice", "/voice", "Mic"),
      createNav("Vision", "/vision", "Eye"),
      createNav("Automation", "/automation", "Zap"),
      createNav("Code Studio", "/code-studio", "Code"),
      createNav("Memory", "/memory", "Brain"),
      createNav("Plugins", "/plugins", "Puzzle"),
      createNav("System Monitor", "/system-monitor", "Activity"),
      {
        id: "toggle-theme",
        label: `Switch to ${themeMode === "dark" ? "Light" : "Dark"} Mode`,
        icon: themeMode === "dark" ? "Sun" : "Moon",
        category: "action",
        shortcut: "Ctrl+Shift+T",
        action: () => { toggleTheme(); setOpen(false); },
      },
      {
        id: "toggle-sidebar",
        label: "Toggle Sidebar",
        icon: "LayoutDashboard",
        category: "action",
        shortcut: "Ctrl+B",
        action: () => { useAppStore.getState().toggleSidebar(); setOpen(false); },
      },
    ]);
  }, [registerCommands, createNav, toggleTheme, themeMode, setOpen]);

  useKeyboardShortcut({ key: "k", ctrl: true }, () => {
    setOpen(!open);
    setSearchQuery("");
    setSelectedIndex(0);
  });

  useKeyboardShortcut({ key: "Escape" }, () => setOpen(false), open);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const commands = filteredCommands();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(Math.min(selectedIndex + 1, commands.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(Math.max(selectedIndex - 1, 0));
    } else if (e.key === "Enter" && commands[selectedIndex]) {
      e.preventDefault();
      commands[selectedIndex].action();
      setOpen(false);
    }
  };

  const grouped = commands.reduce<Record<string, typeof commands>>((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {});

  let globalIndex = -1;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[var(--overlay-bg)] z-50"
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 z-50 w-[520px] max-h-[400px] rounded-xl overflow-hidden glass-heavy shadow-2xl"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-glass)]">
              <Search size={18} className="text-[var(--text-muted)] flex-shrink-0" />
              <input
                ref={inputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
              />
              <kbd className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-glass-heavy)] px-1.5 py-0.5 rounded border border-[var(--border-glass)]">
                Esc
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[320px] overflow-y-auto py-2">
              {Object.entries(grouped).map(([category, cmds]) => (
                <div key={category}>
                  <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                    {category}
                  </div>
                  {cmds.map((cmd) => {
                    globalIndex++;
                    const isSelected = globalIndex === selectedIndex;
                    const idx = globalIndex;
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => { cmd.action(); setOpen(false); }}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors cursor-pointer",
                          isSelected
                            ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        )}
                      >
                        <span className="flex-shrink-0">{iconMap[cmd.icon || ""] || <ArrowRight size={16} />}</span>
                        <span className="flex-1 text-left">{cmd.label}</span>
                        {cmd.shortcut && (
                          <kbd className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-glass)] px-1.5 py-0.5 rounded border border-[var(--border-glass)]">
                            {cmd.shortcut}
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
              {commands.length === 0 && (
                <div className="px-4 py-8 text-sm text-[var(--text-muted)] text-center">
                  No commands found
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
