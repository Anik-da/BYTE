const API_BASE_URL = "http://127.0.0.1:8000/api";

export interface SystemStatus {
  cpu_load: number;
  memory_used_mb: number;
  memory_percent: number;
  battery_percent: number;
  battery_plugged: boolean;
  processes_count: number;
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
