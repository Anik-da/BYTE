import { invoke } from "@tauri-apps/api/core";
import { DbLog } from "../types/db";

export class LoggingService {
  /**
   * Log an event, warning, error, crash, performance metric, or audit trace
   */
  static async log(
    level: "info" | "warning" | "error" | "crash" | "performance" | "ai" | "automation" | "security",
    category: string,
    message: string
  ): Promise<boolean> {
    try {
      return await invoke<boolean>("save_logs", { level, category, message });
    } catch (error) {
      console.error("Failed to submit log entry:", error);
      return false;
    }
  }

  /**
   * Retrieve recent logs from SQLite database
   */
  static async loadLogs(limit: number): Promise<DbLog[]> {
    try {
      return await invoke<DbLog[]>("load_logs", { limit });
    } catch (error) {
      console.error("Failed to load logs:", error);
      return [];
    }
  }
}
export default LoggingService;
