import { create } from "zustand";
import type { Command } from "../types";

interface CommandState {
  commands: Command[];
  searchQuery: string;
  selectedIndex: number;
  registerCommands: (commands: Command[]) => void;
  setSearchQuery: (query: string) => void;
  setSelectedIndex: (index: number) => void;
  filteredCommands: () => Command[];
}

export const useCommandStore = create<CommandState>((set, get) => ({
  commands: [],
  searchQuery: "",
  selectedIndex: 0,

  registerCommands: (commands) => {
    set((s) => {
      const existingIds = new Set(s.commands.map((c) => c.id));
      const newCommands = commands.filter((c) => !existingIds.has(c.id));
      return { commands: [...s.commands, ...newCommands] };
    });
  },

  setSearchQuery: (query) => set({ searchQuery: query, selectedIndex: 0 }),
  setSelectedIndex: (index) => set({ selectedIndex: index }),

  filteredCommands: () => {
    const { commands, searchQuery } = get();
    if (!searchQuery.trim()) return commands;
    const q = searchQuery.toLowerCase();
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
    );
  },
}));
