export interface User {
  name: string;
  email: string;
  avatar?: string;
}

export interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

export interface Command {
  id: string;
  label: string;
  icon?: string;
  category: "navigation" | "action" | "settings";
  shortcut?: string;
  action: () => void;
}

export interface SystemInfo {
  os: string;
  arch: string;
  hostname: string;
}

export interface ModuleCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  status: "active" | "coming-soon";
  color: string;
  path?: string;
}

export interface AppConfig {
  theme_mode: string;
  accent_color: string;
  animations_enabled: boolean;
  user_name: string | null;
  user_email: string | null;
  user_avatar: string | null;
}

