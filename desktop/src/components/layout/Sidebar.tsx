import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, MessageSquare, Mic, Eye, Zap, Code, Brain,
  Puzzle, Activity, Settings, User, ChevronLeft, ChevronRight, Hexagon,
} from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { Tooltip } from "../ui/Tooltip";
import { cn } from "../../utils/cn";
import { NAV_ITEMS, SIDEBAR_WIDTH_COLLAPSED, SIDEBAR_WIDTH_EXPANDED } from "../../utils/constants";

const iconMap: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard size={20} />,
  MessageSquare: <MessageSquare size={20} />,
  Mic: <Mic size={20} />,
  Eye: <Eye size={20} />,
  Zap: <Zap size={20} />,
  Code: <Code size={20} />,
  Brain: <Brain size={20} />,
  Puzzle: <Puzzle size={20} />,
  Activity: <Activity size={20} />,
  Settings: <Settings size={20} />,
  User: <User size={20} />,
};

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  const bottomItems = [
    { id: "settings", label: "Settings", icon: "Settings", path: "/settings" },
    { id: "profile", label: "Profile", icon: "User", path: "/profile" },
  ];

  const renderItem = (item: { id: string; label: string; icon: string; path: string; comingSoon?: boolean }) => {
    const isActive = location.pathname === item.path;
    const content = (
      <motion.button
        key={item.id}
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => navigate(item.path)}
        className={cn(
          "w-full flex items-center gap-3 rounded-lg transition-all duration-200 cursor-pointer relative group",
          sidebarCollapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
          isActive
            ? "bg-[var(--accent-muted)] text-[var(--accent)]"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-glass-heavy)]"
        )}
      >
        {isActive && (
          <motion.div
            layoutId="sidebar-indicator"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[var(--accent)]"
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
        <span className="flex-shrink-0">{iconMap[item.icon]}</span>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
              className="text-sm font-medium whitespace-nowrap overflow-hidden"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>
        {!sidebarCollapsed && item.comingSoon && (
          <span className="ml-auto text-[9px] uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-glass-heavy)] px-1.5 py-0.5 rounded">
            Soon
          </span>
        )}
      </motion.button>
    );

    if (sidebarCollapsed) {
      return (
        <Tooltip key={item.id} content={item.label} side="right">
          {content}
        </Tooltip>
      );
    }
    return content;
  };

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="h-full flex flex-col bg-[var(--sidebar-bg)] backdrop-blur-xl border-r border-[var(--border-default)] flex-shrink-0 relative"
    >
      {/* Logo area */}
      <div className={cn("flex items-center gap-2 p-4 pb-2", sidebarCollapsed && "justify-center")}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] flex items-center justify-center flex-shrink-0 animate-pulse-glow">
          <Hexagon size={18} className="text-white" />
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="overflow-hidden"
            >
              <h1 className="text-base font-bold text-[var(--text-primary)] tracking-wider">BYTE</h1>
              <p className="text-[10px] text-[var(--text-muted)] -mt-0.5">AI Operating System</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(renderItem)}
      </nav>

      {/* Divider */}
      <div className="mx-3 border-t border-[var(--border-default)]" />

      {/* Bottom items */}
      <div className="px-3 py-2 space-y-0.5">
        {bottomItems.map(renderItem)}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-glass-heavy)] transition-all z-10 cursor-pointer"
      >
        {sidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.aside>
  );
}
