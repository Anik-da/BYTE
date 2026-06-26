export interface User {
  id?: number;
  name: string;
  username?: string;
  email: string;
  avatar?: string;
  recovery_key?: string;
  security_questions?: { q1: string; q2: string };
  permissions?: Record<string, boolean>;
  preferences?: Record<string, any>;
  settings?: Record<string, any>;
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

export interface FileInfo {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
}

export interface DiskInfo {
  name: string;
  mount_point: string;
  total: number;
  available: number;
}

export interface SystemMetrics {
  cpu_usage: number;
  ram_used: number;
  ram_total: number;
  disks: DiskInfo[];
  processes: ProcessInfo[];
}


