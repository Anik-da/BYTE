export const APP_NAME = "BYTE";
export const APP_VERSION = "0.1.0";
export const APP_TAGLINE = "Your Personal AI Operating System";

export const SIDEBAR_WIDTH_EXPANDED = 240;
export const SIDEBAR_WIDTH_COLLAPSED = 68;
export const TITLEBAR_HEIGHT = 40;
export const STATUSBAR_HEIGHT = 28;

export const ACCENT_COLORS = [
  { name: "Blue", value: "blue", hex: "#3b82f6" },
  { name: "Purple", value: "purple", hex: "#8b5cf6" },
  { name: "Cyan", value: "cyan", hex: "#06b6d4" },
  { name: "Green", value: "green", hex: "#10b981" },
  { name: "Orange", value: "orange", hex: "#f59e0b" },
  { name: "Pink", value: "pink", hex: "#ec4899" },
] as const;

export type AccentColor = (typeof ACCENT_COLORS)[number]["value"];

export const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard", path: "/" },
  { id: "ai-chat", label: "AI Chat", icon: "MessageSquare", path: "/ai-chat", comingSoon: true },
  { id: "voice", label: "Voice", icon: "Mic", path: "/voice", comingSoon: true },
  { id: "vision", label: "Vision", icon: "Eye", path: "/vision", comingSoon: true },
  { id: "automation", label: "Automation", icon: "Zap", path: "/automation", comingSoon: true },
  { id: "code-studio", label: "Code Studio", icon: "Code", path: "/code-studio", comingSoon: true },
  { id: "memory", label: "Memory", icon: "Brain", path: "/memory", comingSoon: true },
  { id: "plugins", label: "Plugins", icon: "Puzzle", path: "/plugins", comingSoon: true },
  { id: "system-monitor", label: "System Monitor", icon: "Activity", path: "/system-monitor", comingSoon: true },
] as const;

export const SETTINGS_TABS = [
  { id: "general", label: "General", icon: "Settings" },
  { id: "appearance", label: "Appearance", icon: "Palette" },
  { id: "performance", label: "Performance", icon: "Gauge" },
  { id: "shortcuts", label: "Shortcuts", icon: "Keyboard" },
  { id: "privacy", label: "Privacy", icon: "Shield" },
  { id: "permissions", label: "Permissions", icon: "Lock" },
  { id: "updates", label: "Updates", icon: "Download" },
  { id: "about", label: "About BYTE", icon: "Info" },
] as const;
