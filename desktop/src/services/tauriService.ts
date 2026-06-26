import type { SystemInfo, AppConfig } from "../types";

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
};

