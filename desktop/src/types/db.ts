// TypeScript model definitions matching the 26 backend SQLite tables

export interface DbUser {
  id: number;
  username: string;
  name: string;
  password_hash: string;
  recovery_key: string;
  security_question_1: string;
  security_answer_hash_1: string;
  security_question_2: string;
  security_answer_hash_2: string;
  preferences: string; // JSON
  settings: string; // JSON
  permissions: string; // JSON
  avatar?: string;
}

export interface DbProfile {
  id: number;
  user_id: number;
  bio?: string;
  organization?: string;
  role?: string;
  custom_fields?: string; // JSON
}

export interface DbSession {
  id: string;
  user_id: number;
  device_name: string;
  created_at: number;
  last_active: number;
  is_active: boolean;
  token?: string; // Encrypted session payload
}

export interface DbPermission {
  id: number;
  user_id: number;
  resource: string; // e.g. "camera", "microphone"
  allowed: boolean;
}

export interface DbSetting {
  key: string;
  value: string;
}

export interface DbTheme {
  id: number;
  name: string;
  mode: "dark" | "light";
  accent_color: string;
  custom_styles?: string; // JSON
}

export interface DbChatHistory {
  id: string;
  user_id: number;
  title: string;
  created_at: number;
  updated_at: number;
  model_id: string;
}

export interface DbConversationMessage {
  id: string;
  chat_id: string;
  role: "user" | "assistant" | "system";
  content: string; // Encrypted message payload
  timestamp: number;
  metadata?: string; // JSON string containing context/sources
}

export interface DbMemoryEntry {
  id: string;
  user_id: number;
  content: string; // Encrypted memory payload
  category: "LongTerm" | "ShortTerm" | "Conversation" | "Workspace" | "Coding" | "Preferences" | "Project";
  importance: number; // 1 to 10
  tags: string[];
  source: string;
  created_at: number;
  archived: boolean;
}

export interface DbRecentFile {
  id: number;
  path: string;
  name: string;
  mime_type?: string;
  size_bytes?: number;
  accessed_at: number;
}

export interface DbPinnedFile {
  id: number;
  path: string;
  name: string;
  pinned_at: number;
}

export interface DbPinnedFolder {
  id: number;
  path: string;
  name: string;
  pinned_at: number;
}

export interface DbWorkspace {
  id: string;
  path: string;
  name: string;
  created_at: number;
  is_active: boolean;
}

export interface DbInstalledPlugin {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  manifest?: string; // JSON manifest definition
}

export interface DbPluginSetting {
  plugin_id: string;
  key: string;
  value: string;
}

export interface DbVoiceProfile {
  id: number;
  user_id: number;
  profile_name: string;
  sample_path: string;
  created_at: number;
}

export interface DbFaceProfile {
  id: number;
  user_id: number;
  profile_name: string;
  image_path: string;
  created_at: number;
}

export interface DbAIModel {
  id: string;
  name: string;
  provider: string; // e.g. "openai", "anthropic", "ollama"
  model_type: string; // e.g. "chat", "embedding"
  settings?: string; // JSON settings
}

export interface DbAutomationHistory {
  id: string;
  trigger_type: string;
  action_name: string;
  status: "success" | "failed";
  executed_at: number;
  details?: string;
}

export interface DbTask {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  due_date?: number;
  created_at: number;
}

export interface DbNotification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: number;
}

export interface DbLog {
  id: number;
  level: "info" | "warning" | "error" | "crash" | "performance" | "ai" | "automation" | "security";
  category: string;
  message: string;
  timestamp: number;
}

export interface DbCrashReport {
  id: string;
  error_message: string;
  stack_trace?: string;
  timestamp: number;
}

export interface DbSystemInformation {
  timestamp: number;
  cpu_usage: number;
  ram_usage: number;
  disk_usage: number;
}

export interface DbDevice {
  id: string;
  name: string;
  device_type: string;
  ip_address?: string;
  last_seen: number;
}

export interface DbDeveloperSetting {
  key: string;
  value: string;
}
