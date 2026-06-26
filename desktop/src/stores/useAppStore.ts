import { create } from "zustand";

interface AppState {
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  notificationCenterOpen: boolean;
  currentPageTitle: string;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setNotificationCenterOpen: (open: boolean) => void;
  setCurrentPageTitle: (title: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  notificationCenterOpen: false,
  currentPageTitle: "Dashboard",

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setNotificationCenterOpen: (open) => set({ notificationCenterOpen: open }),
  setCurrentPageTitle: (title) => set({ currentPageTitle: title }),
}));
