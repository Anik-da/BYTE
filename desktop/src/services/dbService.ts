import { invoke } from "@tauri-apps/api/core";
import { DbUser, DbChatHistory } from "../types/db";

export class DatabaseService {
  /**
   * Save user details (name, avatar, organization, role)
   */
  static async saveUser(userId: number, name: string, avatar?: string): Promise<boolean> {
    try {
      return await invoke<boolean>("save_user", { userId, name, avatar });
    } catch (error) {
      console.error("Failed to save user info:", error);
      throw error;
    }
  }

  /**
   * Load user details
   */
  static async loadUser(userId: number): Promise<DbUser | null> {
    try {
      return await invoke<DbUser | null>("load_user", { userId });
    } catch (error) {
      console.error("Failed to load user info:", error);
      return null;
    }
  }

  /**
   * Save settings (supports AES decryption seed)
   */
  static async saveSettings(key: string, value: string, encryptKey?: string): Promise<boolean> {
    try {
      return await invoke<boolean>("save_settings", { key, value, encryptKey });
    } catch (error) {
      console.error(`Failed to save settings for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Load settings (supports AES decryption seed)
   */
  static async loadSettings(key: string, decryptKey?: string): Promise<string | null> {
    try {
      return await invoke<string | null>("load_settings", { key, decryptKey });
    } catch (error) {
      console.error(`Failed to load settings for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Save chat history title and payload
   */
  static async saveChat(
    chatId: string,
    userId: number,
    title: string,
    modelId: string,
    messagesJson: string
  ): Promise<boolean> {
    try {
      return await invoke<boolean>("save_chat", {
        chatId,
        userId,
        title,
        modelId,
        messagesJson,
      });
    } catch (error) {
      console.error(`Failed to save chat ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * Load chat histories for a given user
   */
  static async loadChat(userId: number): Promise<DbChatHistory[]> {
    try {
      return await invoke<DbChatHistory[]>("load_chat", { userId });
    } catch (error) {
      console.error("Failed to load chat history:", error);
      return [];
    }
  }

  /**
   * Indexes top-level files metadata in a specific folder
   */
  static async indexFilesMeta(folderPath: string): Promise<number> {
    try {
      return await invoke<number>("index_files_meta", { folderPath });
    } catch (error) {
      console.error(`Failed to index folder metadata at ${folderPath}:`, error);
      return 0;
    }
  }
}
export default DatabaseService;
