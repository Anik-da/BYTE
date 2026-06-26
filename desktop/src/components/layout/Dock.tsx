import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard, MessageSquare, Mic, Eye, Zap, Code, Brain, Puzzle, Settings,
} from "lucide-react";
import { Tooltip } from "../ui/Tooltip";
import { cn } from "../../utils/cn";

const dockItems = [
  { id: "dashboard", icon: <LayoutDashboard size={20} />, label: "Dashboard", path: "/" },
  { id: "ai-chat", icon: <MessageSquare size={20} />, label: "AI Chat", path: "/ai-chat" },
  { id: "voice", icon: <Mic size={20} />, label: "Voice", path: "/voice" },
  { id: "vision", icon: <Eye size={20} />, label: "Vision", path: "/vision" },
  { id: "automation", icon: <Zap size={20} />, label: "Automation", path: "/automation" },
  { id: "code-studio", icon: <Code size={20} />, label: "Code Studio", path: "/code-studio" },
  { id: "memory", icon: <Brain size={20} />, label: "Memory", path: "/memory" },
  { id: "plugins", icon: <Puzzle size={20} />, label: "Plugins", path: "/plugins" },
  { id: "settings", icon: <Settings size={20} />, label: "Settings", path: "/settings" },
];

export function Dock() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-40">
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.2 }}
        className="flex items-center gap-1 px-2 py-1.5 rounded-2xl glass-heavy"
      >
        {dockItems.map((item, index) => {
          const isActive = location.pathname === item.path;
          return (
            <Tooltip key={item.id} content={item.label} side="top">
              <motion.button
                whileHover={{ scale: 1.25, y: -8 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                onClick={() => navigate(item.path)}
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-200 cursor-pointer relative",
                  isActive
                    ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-glass-heavy)]"
                )}
              >
                {item.icon}
                {isActive && (
                  <motion.div
                    layoutId="dock-indicator"
                    className="absolute -bottom-1 w-1 h-1 rounded-full bg-[var(--accent)]"
                  />
                )}
              </motion.button>
              {index === 0 && (
                <div className="w-px h-6 bg-[var(--border-glass)] mx-0.5" />
              )}
            </Tooltip>
          );
        })}
      </motion.div>
    </div>
  );
}
