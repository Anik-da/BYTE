import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AppLayout } from "./components/layout/AppLayout";
import { SplashScreen } from "./pages/SplashScreen";
import { LoginScreen } from "./pages/LoginScreen";
import { RegisterScreen } from "./pages/RegisterScreen";
import { FirstLaunchWizard } from "./pages/FirstLaunchWizard";
import { LockScreen } from "./pages/LockScreen";
import { Dashboard } from "./pages/Dashboard";
import { Settings } from "./pages/Settings";
import { Profile } from "./pages/Profile";
import { Terminal } from "./pages/Terminal";
import { FileExplorer } from "./pages/FileExplorer";
import { SystemMonitor } from "./pages/SystemMonitor";
import { tauriService } from "./services/tauriService";
import { useThemeStore } from "./stores/useThemeStore";
import { useAuthStore } from "./stores/useAuthStore";
import "./index.css";

function SessionTracker({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLocked, isFirstLaunch, lockSession } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Inactivity auto-lock listener (5 minutes)
  useEffect(() => {
    if (!isAuthenticated || isLocked) return;

    let timeoutId: number;

    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        lockSession();
      }, 5 * 60 * 1000); // 5 minutes inactivity
    };

    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("mousedown", resetTimer);
    window.addEventListener("scroll", resetTimer);

    resetTimer();

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("mousedown", resetTimer);
      window.removeEventListener("scroll", resetTimer);
    };
  }, [isAuthenticated, isLocked, lockSession]);

  // Route security guard
  useEffect(() => {
    const publicPaths = ["/splash", "/login", "/register", "/wizard", "/lock"];
    const isPublic = publicPaths.includes(location.pathname);

    if (isFirstLaunch && location.pathname !== "/wizard") {
      navigate("/wizard", { replace: true });
    } else if (isAuthenticated && isLocked && location.pathname !== "/lock") {
      navigate("/lock", { replace: true });
    } else if (!isAuthenticated && !isPublic) {
      navigate("/splash", { replace: true });
    }
  }, [isAuthenticated, isLocked, isFirstLaunch, location.pathname, navigate]);

  return <>{children}</>;
}

export default function App() {
  useEffect(() => {
    let unsubscribeTheme: (() => void) | null = null;
    let unsubscribeAuth: (() => void) | null = null;

    async function initConfig() {
      try {
        const config = await tauriService.loadConfig();
        
        // Apply initial config to theme store
        useThemeStore.getState().setThemeState({
          mode: config.theme_mode === "light" ? "light" : "dark",
          accentColor: config.accent_color as any,
          animationsEnabled: config.animations_enabled,
        });

        // Apply initial config to auth store
        if (config.user_name) {
          useAuthStore.getState().setAuthState({
            user: {
              name: config.user_name,
              email: config.user_email || "",
              avatar: config.user_avatar || undefined,
            },
            isAuthenticated: true,
          });
        }

        // Set up reactive subscribers to auto-save to native disk
        const saveState = async () => {
          const theme = useThemeStore.getState();
          const auth = useAuthStore.getState();
          try {
            await tauriService.saveConfig({
              theme_mode: theme.mode,
              accent_color: theme.accentColor,
              animations_enabled: theme.animationsEnabled,
              user_name: auth.user?.name || null,
              user_email: auth.user?.email || null,
              user_avatar: auth.user?.avatar || null,
            });
          } catch (e) {
            console.error("Failed to save config natively:", e);
          }
        };

        unsubscribeTheme = useThemeStore.subscribe(saveState);
        unsubscribeAuth = useAuthStore.subscribe(saveState);
      } catch (err) {
        console.error("Failed to bootstrap native config:", err);
      }
    }

    initConfig();

    return () => {
      if (unsubscribeTheme) unsubscribeTheme();
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, []);

  return (
    <BrowserRouter>
      <SessionTracker>
        <Routes>
          <Route path="/splash" element={<SplashScreen />} />
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/register" element={<RegisterScreen />} />
          <Route path="/wizard" element={<FirstLaunchWizard />} />
          <Route path="/lock" element={<LockScreen />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/ai-chat" element={<Dashboard />} />
            <Route path="/voice" element={<Dashboard />} />
            <Route path="/vision" element={<Dashboard />} />
            <Route path="/automation" element={<Dashboard />} />
            <Route path="/code-studio" element={<Dashboard />} />
            <Route path="/memory" element={<Dashboard />} />
            <Route path="/plugins" element={<Dashboard />} />
            <Route path="/terminal" element={<Terminal />} />
            <Route path="/files" element={<FileExplorer />} />
            <Route path="/system-monitor" element={<SystemMonitor />} />
          </Route>
          <Route path="*" element={<Navigate to="/splash" replace />} />
        </Routes>
      </SessionTracker>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-glass)",
            borderRadius: "12px",
            fontSize: "13px",
          },
        }}
      />
    </BrowserRouter>
  );
}
