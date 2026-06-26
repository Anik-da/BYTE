import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { StatusBar } from "./StatusBar";
import { Dock } from "./Dock";
import { TitleBar } from "../window/TitleBar";
import { CommandPalette } from "../overlays/CommandPalette";
import { NotificationCenter } from "../overlays/NotificationCenter";

export function AppLayout() {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-primary)]">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <TopBar />
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 pb-24">
            <Outlet />
          </div>
        </main>
      </div>
      <StatusBar />
      <Dock />
      <CommandPalette />
      <NotificationCenter />
    </div>
  );
}
