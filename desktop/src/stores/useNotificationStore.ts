import { create } from "zustand";
import type { Notification } from "../types";

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  add: (notification: Omit<Notification, "id" | "timestamp" | "read">) => void;
  markAsRead: (id: string) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

let notifId = 0;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [
    {
      id: "welcome-1",
      type: "info",
      title: "Welcome to BYTE",
      message: "Your personal AI operating system is ready.",
      timestamp: Date.now(),
      read: false,
    },
    {
      id: "welcome-2",
      type: "success",
      title: "System Online",
      message: "All core systems initialized successfully.",
      timestamp: Date.now() - 60000,
      read: false,
    },
  ],
  unreadCount: 2,

  add: (notification) => {
    const id = `notif-${++notifId}`;
    const newNotif: Notification = {
      ...notification,
      id,
      timestamp: Date.now(),
      read: false,
    };
    set((s) => ({
      notifications: [newNotif, ...s.notifications],
      unreadCount: s.unreadCount + 1,
    }));
  },

  markAsRead: (id) => {
    const notif = get().notifications.find((n) => n.id === id);
    if (notif && !notif.read) {
      set((s) => ({
        notifications: s.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }));
    }
  },

  dismiss: (id) => {
    const notif = get().notifications.find((n) => n.id === id);
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
      unreadCount: notif && !notif.read ? Math.max(0, s.unreadCount - 1) : s.unreadCount,
    }));
  },

  clearAll: () => {
    set({ notifications: [], unreadCount: 0 });
  },
}));
