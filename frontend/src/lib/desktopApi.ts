const API_BASE_URL = "http://127.0.0.1:8000/api";

export interface VoiceStatus {
  continuous_enabled: boolean;
  continuous_active: boolean;
  paused: boolean;
  armed: boolean;
  transcribing?: boolean;
  is_listening: boolean;
  is_speaking: boolean;
  muted: boolean;
  mic_error?: string | null;
  last_transcript?: string;
  last_heard_at?: number;
  event_seq: number;
}

export interface VoiceEvent {
  seq: number;
  id: string;
  role: 'user' | 'byte';
  text: string;
  intent?: string | null;
  source: string;
  spoken_by_backend: boolean;
  timestamp: number;
}

export interface AutostartStatus {
  task_registered: boolean;
  tray_autostart: boolean;
  enabled: boolean;
  auto_launch_setting?: boolean;
  desktop_exe?: string | null;
}

export interface SystemStatus {
  cpu_load: number;
  memory_used_mb: number;
  memory_percent: number;
  battery_percent: number;
  battery_plugged: boolean;
  processes_count: number;
  voice_status?: VoiceStatus;
}

export interface ProcessCommandResponse {
  intent: {
    intent: string;
    target: string;
    requires_confirmation?: boolean;
  };
  action_result?: {
    status: string;
    message: string;
    matches?: string[];
  };
  response: string;
}

export async function fetchSystemStatus(): Promise<SystemStatus | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/system_status`);
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Backend offline fallback
  }
  return null;
}

export async function sendDesktopCommand(prompt: string): Promise<ProcessCommandResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/process_command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err: any) {
    console.warn("Backend API offline:", err.message);
  }

  // Fallback response if local backend service is starting up
  return {
    intent: { intent: "fallback", target: prompt },
    response: `[BYTE Desktop Standby] Prompt logged. Ensure backend engine is running on localhost:8000.`
  };
}

export async function fetchBackendSettings(): Promise<Record<string, any>> {
  try {
    const res = await fetch(`${API_BASE_URL}/settings`);
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Ignore
  }
  return {};
}

export async function saveBackendSettings(settings: Record<string, any>): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchConversationHistory(): Promise<Array<{ id: string; role: 'user' | 'byte'; text: string; time: string }>> {
  try {
    const res = await fetch(`${API_BASE_URL}/memory/history?limit=50`);
    if (res.ok) {
      const rows = await res.json();
      return rows.map((r: any) => ({
        id: String(r.id),
        role: r.role === 'user' ? 'user' : 'byte',
        text: r.content,
        time: r.timestamp ? new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'LOGGED',
      }));
    }
  } catch {
    // Return empty fallback array
  }
  return [];
}

export async function clearConversationHistory(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/memory/clear`, {
      method: "DELETE",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteHistoryMessage(msgId: string | number): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/memory/history/${msgId}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchLifetimeFacts(): Promise<Array<{ key: string; fact: string; category?: string; timestamp?: string }>> {
  try {
    const res = await fetch(`${API_BASE_URL}/memory/lifetime`);
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Return empty fallback array
  }
  return [];
}

export async function saveLifetimeFact(key: string, fact: string, category: string = "general"): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/memory/lifetime`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, fact, category }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteLifetimeFact(key: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/memory/lifetime/${key}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function checkGitHubUpdate(): Promise<{ update_available: boolean; commit_message?: string; local_commit?: string; remote_commit?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/system/check_github_update`);
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Backend offline
  }
  return { update_available: false };
}

export async function applyGitHubUpdate(): Promise<{ status: string; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/system/apply_github_update`, { method: "POST" });
    if (res.ok) {
      return await res.json();
    }
    const errText = await res.text();
    return { status: "error", message: errText || "HTTP request failed" };
  } catch (err: any) {
    return { status: "error", message: err.message || "Network request failed" };
  }
}

let _telemetryCache: Record<string, any> | null = null;
let _telemetryCacheAt = 0;
let _telemetryInFlight: Promise<Record<string, any> | null> | null = null;

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs: number = 3500): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function fetchSystemTelemetry(): Promise<Record<string, any> | null> {
  const now = Date.now();
  if (_telemetryCache && now - _telemetryCacheAt < 1200) {
    return _telemetryCache;
  }
  if (_telemetryInFlight) {
    return _telemetryInFlight;
  }
  _telemetryInFlight = (async () => {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/system_status`, undefined, 3500);
      if (res.ok) {
        const data = await res.json();
        _telemetryCache = data;
        _telemetryCacheAt = Date.now();
        return data;
      }
    } catch {
      // Backend offline or timeout
    } finally {
      _telemetryInFlight = null;
    }
    return _telemetryCache;
  })();
  return _telemetryInFlight;
}

export async function fetchVoiceStatus(): Promise<VoiceStatus | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/voice/status`, undefined, 3000);
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Backend offline or timeout
  }
  return null;
}

export async function armVoiceListening(): Promise<VoiceStatus | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/voice/arm`, { method: "POST" });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Ignore
  }
  return null;
}

export async function disarmVoiceListening(): Promise<VoiceStatus | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/voice/disarm`, { method: "POST" });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Ignore
  }
  return null;
}

export async function stopBackendSpeech(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/voice/stop`, { method: "POST" });
  } catch {
    // Ignore
  }
}

export async function toggleContinuousVoice(paused: boolean): Promise<VoiceStatus | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/voice/continuous`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paused }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Ignore
  }
  return null;
}

export async function setBackendVoiceMuted(muted: boolean): Promise<VoiceStatus | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/voice/mute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ muted }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Ignore
  }
  return null;
}

export async function fetchVoiceEvents(since: number): Promise<{ seq: number; events: VoiceEvent[] }> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/voice/events?since=${since}`, undefined, 3500);
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Ignore
  }
  return { seq: since, events: [] };
}

export async function fetchAutostartStatus(): Promise<AutostartStatus | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/system/autostart`);
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Ignore
  }
  return null;
}

export interface LocalOllamaModel {
  name: string;
  size?: string;
}

export interface GroqModelInfo {
  id: string;
  label: string;
  owned_by?: string;
}

export async function fetchLocalModels(): Promise<LocalOllamaModel[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/system/local_models`);
    if (res.ok) {
      const data = await res.json();
      return data.models || [];
    }
  } catch {
    // Ignore
  }
  return [];
}

export async function fetchGroqModels(): Promise<GroqModelInfo[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/system/groq_models`);
    if (res.ok) {
      const data = await res.json();
      return data.models || [];
    }
  } catch {
    // Ignore
  }
  return [];
}

export async function updateAutostart(enabled: boolean): Promise<AutostartStatus | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/system/autostart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Ignore
  }
  return null;
}
