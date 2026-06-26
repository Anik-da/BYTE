import { useState, useCallback, useEffect } from "react";

let windowApi: {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
} | null = null;

async function getWindowApi() {
  if (windowApi) return windowApi;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    windowApi = {
      minimize: () => win.minimize(),
      toggleMaximize: () => win.toggleMaximize(),
      close: () => win.close(),
      isMaximized: () => win.isMaximized(),
    };
    return windowApi;
  } catch {
    return null;
  }
}

export function useWindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  const checkMaximized = useCallback(async () => {
    const api = await getWindowApi();
    if (api) {
      const maximized = await api.isMaximized();
      setIsMaximized(maximized);
    }
  }, []);

  useEffect(() => {
    checkMaximized();
    const interval = setInterval(checkMaximized, 500);
    return () => clearInterval(interval);
  }, [checkMaximized]);

  const minimize = useCallback(async () => {
    const api = await getWindowApi();
    await api?.minimize();
  }, []);

  const toggleMaximize = useCallback(async () => {
    const api = await getWindowApi();
    await api?.toggleMaximize();
    setTimeout(checkMaximized, 100);
  }, [checkMaximized]);

  const close = useCallback(async () => {
    const api = await getWindowApi();
    await api?.close();
  }, []);

  return { isMaximized, minimize, toggleMaximize, close };
}
