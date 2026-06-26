import { create } from "zustand";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setAuthState: (state: Partial<Pick<AuthState, "user" | "isAuthenticated">>) => void;
  login: (email: string, _password: string) => void;
  loginAsGuest: () => void;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  setAuthState: (state) => set(state),

  login: (email, _password) => {
    const name = email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    set({
      user: { name, email },
      isAuthenticated: true,
    });
  },

  loginAsGuest: () => {
    set({
      user: { name: "Guest User", email: "guest@byte.local" },
      isAuthenticated: true,
    });
  },

  logout: () => {
    set({ user: null, isAuthenticated: false });
  },

  updateProfile: (updates) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    }));
  },
}));

