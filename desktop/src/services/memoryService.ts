import { invoke } from "@tauri-apps/api/core";
import { DbMemoryEntry } from "../types/db";

export class MemoryService {
  /**
   * Save a new memory entry (automatically encrypts on backend)
   */
  static async saveMemory(
    userId: number,
    keySeed: string,
    content: string,
    category: "LongTerm" | "ShortTerm" | "Conversation" | "Workspace" | "Coding" | "Preferences" | "Project",
    importance: number,
    tags: string[],
    source: string
  ): Promise<string> {
    try {
      return await invoke<string>("save_memory", {
        userId,
        keySeed,
        content,
        category,
        importance,
        tags,
        source,
      });
    } catch (error) {
      console.error("Failed to save memory entry:", error);
      throw error;
    }
  }

  /**
   * Load and decrypt memory entries for the active user
   */
  static async loadMemory(userId: number, keySeed: string): Promise<DbMemoryEntry[]> {
    try {
      return await invoke<DbMemoryEntry[]>("load_memory", { userId, keySeed });
    } catch (error) {
      console.error("Failed to load memory entries:", error);
      return [];
    }
  }
}
export default MemoryService;
