import type { SystemInfo, AppConfig, FileInfo, SystemMetrics } from "../types";

async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<T>(command, args);
  } catch (error) {
    console.warn(`Tauri invoke failed for "${command}":`, error);
    throw error;
  }
}

export const tauriService = {
  getSystemInfo: () => invokeCommand<SystemInfo>("get_system_info"),
  getAppVersion: () => invokeCommand<string>("get_app_version"),
  loadConfig: () => invokeCommand<AppConfig>("load_config"),
  saveConfig: (config: AppConfig) => invokeCommand<void>("save_config", { config }),
  
  // Clipboard
  writeClipboard: (text: string) => invokeCommand<void>("write_clipboard", { text }),
  readClipboard: () => invokeCommand<string>("read_clipboard"),
  
  // Dialogs
  showMessageDialog: (title: string, message: string, level: string = "info") =>
    invokeCommand<void>("show_message_dialog", { title, message, level }),
  showFilePicker: (title: string, isFolder: boolean) =>
    invokeCommand<string | null>("show_file_picker", { title, isFolder }),
    
  // Filesystem
  readDir: (path: string) => invokeCommand<FileInfo[]>("read_dir", { path }),
  createDir: (path: string) => invokeCommand<void>("create_dir", { path }),
  deleteFileOrDir: (path: string) => invokeCommand<void>("delete_file_or_dir", { path }),
  renameFileOrDir: (oldPath: string, newPath: string) =>
    invokeCommand<void>("rename_file_or_dir", { oldPath, newPath }),
    
  // Telemetry
  getSystemMetrics: () => invokeCommand<SystemMetrics>("get_system_metrics"),
  killProcess: (pid: number) => invokeCommand<void>("kill_process", { pid }),
  
  // Terminal
  spawnTerminal: (sessionId: string, shell: string) =>
    invokeCommand<void>("spawn_terminal", { sessionId, shell }),
  writeTerminalInput: (sessionId: string, input: string) =>
    invokeCommand<void>("write_terminal_input", { sessionId, input }),
  killTerminal: (sessionId: string) =>
    invokeCommand<void>("kill_terminal", { sessionId }),
    
  // Autostart & Window Controls
  setAutostart: (enabled: boolean) => invokeCommand<void>("set_autostart", { enabled }),
  isAutostartEnabled: () => invokeCommand<boolean>("is_autostart_enabled"),
  setAlwaysOnTop: (enabled: boolean) => invokeCommand<void>("set_always_on_top", { enabled }),

  // Authentication & Security Commands
  registerUser: (args: Record<string, any>) => invokeCommand<any>("register_user", args),
  loginUser: (args: Record<string, any>) => invokeCommand<any>("login_user", args),
  verifyWindowsHello: (message: string) => invokeCommand<boolean>("verify_windows_hello", { message }),
  voiceAuthEnroll: (userId: number, profileName: string, samplePath: string) =>
    invokeCommand<boolean>("voice_auth_enroll", { userId, profileName, samplePath }),
  voiceAuthVerify: (userId: number, currentSamplePath: string) =>
    invokeCommand<boolean>("voice_auth_verify", { userId, currentSamplePath }),
  faceAuthEnroll: (userId: number, profileName: string, imagePath: string) =>
    invokeCommand<boolean>("face_auth_enroll", { userId, profileName, imagePath }),
  faceAuthVerify: (userId: number, currentImagePath: string) =>
    invokeCommand<boolean>("face_auth_verify", { userId, currentImagePath }),
  listLocalUsers: () => invokeCommand<any[]>("list_local_users"),
};


