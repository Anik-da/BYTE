import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

export interface AudioDevice {
  id: string;
  name: string;
  is_input: boolean;
  is_default: boolean;
}

export interface VoiceConfig {
  microphone_id: string;
  speaker_id: string;
  wake_word_enabled: boolean;
  wake_word_sensitivity: number;
  always_listening: boolean;
  push_to_talk: boolean;
  language: string;
  voice_speed: number;
  voice_pitch: number;
  voice_type: string;
  noise_reduction: boolean;
  voice_auth_enabled: boolean;
}

export class VoiceService {
  /**
   * Play speech using system native synthesis
   */
  static async speakText(text: string, config?: VoiceConfig): Promise<boolean> {
    try {
      return await invoke<boolean>("speak_text", { text, config });
    } catch (e) {
      console.error("Speech synthesis failed:", e);
      return false;
    }
  }

  /**
   * Enumerate system audio input / output endpoints
   */
  static async getAudioDevices(): Promise<AudioDevice[]> {
    try {
      return await invoke<AudioDevice[]>("get_audio_devices");
    } catch (e) {
      console.error("Failed to query audio devices:", e);
      return [
        { id: "default_input", name: "Default Microphone", is_input: true, is_default: true },
        { id: "default_output", name: "Default Speaker", is_input: false, is_default: true },
      ];
    }
  }

  /**
   * Monitor microphone audio levels in real-time
   */
  static async testMicrophoneLevel(onLevel: (amplitude: number) => void): Promise<() => void> {
    let unlisten: UnlistenFn | null = null;
    
    const setupListener = async () => {
      unlisten = await listen<number>("audio-level", (event) => {
        onLevel(event.payload);
      });
      await invoke("test_microphone_level");
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }

  /**
   * Bind always-listening / wake-word detection loops
   */
  static async startListening(
    onStatus: (status: string) => void,
    onTranscript: (phrase: string) => void
  ): Promise<() => void> {
    let unlistenStatus: UnlistenFn | null = null;
    let unlistenTranscript: UnlistenFn | null = null;

    const setupListeners = async () => {
      unlistenStatus = await listen<string>("voice-status", (event) => {
        onStatus(event.payload);
      });

      unlistenTranscript = await listen<string>("voice-transcript", (event) => {
        onTranscript(event.payload);
      });

      await invoke("start_voice_listening");
    };

    setupListeners();

    return () => {
      if (unlistenStatus) unlistenStatus();
      if (unlistenTranscript) unlistenTranscript();
      invoke("stop_voice_listening");
    };
  }

  /**
   * Save settings to DB settings table
   */
  static async saveSettings(config: VoiceConfig): Promise<boolean> {
    try {
      return await invoke<boolean>("save_voice_settings", { config });
    } catch (e) {
      console.error("Failed to save voice configuration settings:", e);
      return false;
    }
  }

  /**
   * Fetch current settings config from DB
   */
  static async loadSettings(): Promise<VoiceConfig> {
    try {
      return await invoke<VoiceConfig>("load_voice_settings");
    } catch (e) {
      console.warn("Failed to load voice configuration settings. Falling back to defaults:", e);
      return {
        microphone_id: "default",
        speaker_id: "default",
        wake_word_enabled: true,
        wake_word_sensitivity: 0.5,
        always_listening: false,
        push_to_talk: true,
        language: "en-US",
        voice_speed: 1.0,
        voice_pitch: 1.0,
        voice_type: "female",
        noise_reduction: true,
        voice_auth_enabled: false,
      };
    }
  }
}
export default VoiceService;
