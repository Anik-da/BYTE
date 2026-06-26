import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  stream?: boolean;
}

export class AIService {
  /**
   * Test connection to a given provider / model
   */
  static async testConnection(
    provider: string,
    model: string,
    apiKey?: string,
    apiUrl?: string
  ): Promise<boolean> {
    try {
      return await invoke<boolean>("test_provider_connection", {
        provider,
        model,
        apiKey,
        apiUrl,
      });
    } catch (error) {
      console.error(`Failed to test connection for provider ${provider}:`, error);
      return false;
    }
  }

  /**
   * Synchronously request full completion
   */
  static async chatComplete(
    provider: string,
    model: string,
    messages: ChatMessage[],
    options: ChatOptions,
    keySeed: string
  ): Promise<string> {
    try {
      return await invoke<string>("ai_chat_complete", {
        provider,
        model,
        messages,
        options,
        keySeed,
      });
    } catch (error) {
      console.error("AI chat completion failed:", error);
      throw error;
    }
  }

  /**
   * Stream response from AI provider chunk-by-chunk using Tauri Event listener
   */
  static async chatStream(
    provider: string,
    model: string,
    messages: ChatMessage[],
    options: ChatOptions,
    keySeed: string,
    onChunk: (chunk: string) => void,
    onDone: () => void
  ): Promise<() => void> {
    let unlistenChunk: UnlistenFn | null = null;
    let unlistenDone: UnlistenFn | null = null;

    const cleanup = () => {
      if (unlistenChunk) unlistenChunk();
      if (unlistenDone) unlistenDone();
    };

    try {
      // Set up chunk listener
      unlistenChunk = await listen<string>("ai-chunk", (event) => {
        onChunk(event.payload);
      });

      // Set up done listener
      unlistenDone = await listen<boolean>("ai-done", () => {
        cleanup();
        onDone();
      });

      // Invoke streaming command on backend
      await invoke("ai_chat_stream", {
        provider,
        model,
        messages,
        options,
        keySeed,
      });
    } catch (error) {
      console.error("AI chat streaming failed:", error);
      cleanup();
      throw error;
    }

    return cleanup;
  }
}
export default AIService;
