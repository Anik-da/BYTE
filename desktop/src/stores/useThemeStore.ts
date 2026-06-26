import { create } from "zustand";
import type { AccentColor } from "../utils/constants";

interface ThemeState {
  mode: "dark" | "light";
  accentColor: AccentColor;
  animationsEnabled: boolean;
  setThemeState: (state: Partial<Pick<ThemeState, "mode" | "accentColor" | "animationsEnabled">>) => void;
  toggleTheme: () => void;
  setAccentColor: (color: AccentColor) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
}

const applyTheme = (mode: "dark" | "light", accent: AccentColor) => {
  const html = document.documentElement;
  html.className = html.className
    .replace(/theme-\w+/g, "")
    .replace(/accent-\w+/g, "")
    .trim();
  html.classList.add(`theme-${mode}`, `accent-${accent}`);
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: "dark",
  accentColor: "blue",
  animationsEnabled: true,

  setThemeState: (state) => {
    set(state);
    const mode = state.mode ?? get().mode;
    const accentColor = state.accentColor ?? get().accentColor;
    applyTheme(mode, accentColor);
  },

  toggleTheme: () => {
    const newMode = get().mode === "dark" ? "light" : "dark";
    applyTheme(newMode, get().accentColor);
    set({ mode: newMode });
  },

  setAccentColor: (color) => {
    applyTheme(get().mode, color);
    set({ accentColor: color });
  },

  setAnimationsEnabled: (enabled) => {
    set({ animationsEnabled: enabled });
  },
}));

