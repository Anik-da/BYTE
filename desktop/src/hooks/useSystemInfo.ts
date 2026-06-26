import { useState, useEffect, useCallback } from "react";
import type { SystemInfo } from "../types";

export function useSystemInfo() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [appVersion, setAppVersion] = useState<string>("0.1.0");

  const fetchInfo = useCallback(async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const info = await invoke<SystemInfo>("get_system_info");
      setSystemInfo(info);
      const version = await invoke<string>("get_app_version");
      setAppVersion(version);
    } catch {
      setSystemInfo({ os: "unknown", arch: "unknown", hostname: "localhost" });
    }
  }, []);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  return { systemInfo, appVersion };
}
