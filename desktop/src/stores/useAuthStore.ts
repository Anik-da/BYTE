import { create } from "zustand";
import type { User } from "../types";
import { tauriService } from "../services/tauriService";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLocked: boolean;
  isFirstLaunch: boolean;
  localUsers: User[];
  permissions: Record<string, boolean>;
  
  setAuthState: (state: Partial<Pick<AuthState, "user" | "isAuthenticated" | "isLocked" | "isFirstLaunch" | "localUsers">>) => void;
  loadLocalUsers: () => Promise<void>;
  login: (username: string, password_str: string) => Promise<boolean>;
  loginAsGuest: () => void;
  lockSession: () => void;
  unlockSession: () => void;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => void;
  updatePermissions: (perms: Record<string, boolean>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLocked: false,
  isFirstLaunch: false,
  localUsers: [],
  permissions: {
    camera: true,
    microphone: true,
    screenCapture: true,
    automation: true,
    filesystem: true,
    notifications: true,
    location: false,
    internet: true,
  },

  setAuthState: (state) => set(state),

  loadLocalUsers: async () => {
    try {
      const usersList = await tauriService.listLocalUsers();
      const mapped = usersList.map((u: any) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        email: `${u.username}@byte.local`,
        avatar: u.avatar || undefined,
      }));
      set({
        localUsers: mapped,
        isFirstLaunch: mapped.length === 0,
      });
    } catch (e) {
      console.warn("Could not load local users, database might not be initialized yet:", e);
      // Fallback: guest setup
      set({ localUsers: [], isFirstLaunch: true });
    }
  },

  login: async (username, password) => {
    try {
      const profile = await tauriService.loginUser({
        username,
        password,
        deviceName: "Local Host",
      });

      const userObj: User = {
        id: profile.id,
        name: profile.name,
        username: profile.username,
        email: `${profile.username}@byte.local`,
        avatar: profile.avatar || undefined,
        permissions: JSON.parse(profile.permissions || "{}"),
        preferences: JSON.parse(profile.preferences || "{}"),
        settings: JSON.parse(profile.settings || "{}"),
      };

      set({
        user: userObj,
        isAuthenticated: true,
        isLocked: false,
        permissions: { ...get().permissions, ...userObj.permissions },
      });
      return true;
    } catch (e) {
      console.error("Login failed:", e);
      return false;
    }
  },

  loginAsGuest: () => {
    set({
      user: { name: "Guest User", email: "guest@byte.local" },
      isAuthenticated: true,
      isLocked: false,
    });
  },

  lockSession: () => {
    if (get().isAuthenticated) {
      set({ isLocked: true });
    }
  },

  unlockSession: () => {
    set({ isLocked: false });
  },

  logout: () => {
    set({ user: null, isAuthenticated: false, isLocked: false });
  },

  updateProfile: (updates) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    }));
  },

  updatePermissions: (perms) => {
    set((state) => {
      const newPerms = { ...state.permissions, ...perms };
      if (state.user) {
        // Optimistically update local user permissions
        state.user.permissions = newPerms;
      }
      return { permissions: newPerms };
    });
  },
}));
