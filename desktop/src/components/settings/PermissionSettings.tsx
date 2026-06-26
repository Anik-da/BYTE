import { useAuthStore } from "../../stores/useAuthStore";
import { Camera, Mic, Monitor, Cpu, FolderOpen, Bell, MapPin, Globe, ShieldAlert } from "lucide-react";
import { Toggle } from "../ui/Toggle";

export function PermissionSettings() {
  const { permissions, updatePermissions } = useAuthStore();

  const handleToggle = (key: string, enabled: boolean) => {
    updatePermissions({ [key]: enabled });
  };

  const permissionItems = [
    {
      key: "camera",
      title: "Camera Access",
      desc: "Allow local vision modules to access your physical webcams",
      icon: <Camera size={16} className="text-teal-400" />
    },
    {
      key: "microphone",
      title: "Microphone Access",
      desc: "Allow voice transcription and speaker recognition to listen to your voice",
      icon: <Mic size={16} className="text-blue-400" />
    },
    {
      key: "screenCapture",
      title: "Screen Recording",
      desc: "Allow context analysis to view your screen display and capture window frames",
      icon: <Monitor size={16} className="text-purple-400" />
    },
    {
      key: "automation",
      title: "System Automation",
      desc: "Allow scripts to press keys, click buttons, and run automated mouse macros",
      icon: <Cpu size={16} className="text-amber-400" />
    },
    {
      key: "filesystem",
      title: "File System access",
      desc: "Allow database storage indexing and reading files within workspaces",
      icon: <FolderOpen size={16} className="text-cyan-400" />
    },
    {
      key: "notifications",
      title: "Desktop Notifications",
      desc: "Allow background alerts, reminder prompts, and agent reports",
      icon: <Bell size={16} className="text-pink-400" />
    },
    {
      key: "location",
      title: "Location Services",
      desc: "Allow geographic queries and local timezone adjustments",
      icon: <MapPin size={16} className="text-emerald-400" />
    },
    {
      key: "internet",
      title: "Outbound Network Connections",
      desc: "Allow AI agents to query documentation, download plugins, and fetch models",
      icon: <Globe size={16} className="text-indigo-400" />
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-3 bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl items-start">
        <ShieldAlert className="text-amber-400 flex-shrink-0 mt-0.5" size={16} />
        <div>
          <h4 className="text-xs font-semibold text-[var(--text-primary)]">Privacy Controls Policy</h4>
          <p className="text-[10px] text-[var(--text-muted)] mt-1">
            BYTE operates strictly local-first. System permissions are enforced in-app. Denying access halts the related engine pipeline instantly. No data is sent to external cloud servers.
          </p>
        </div>
      </div>

      <div className="bg-[var(--bg-glass-heavy)] border border-[var(--border-glass)] rounded-xl p-4 divide-y divide-[var(--border-glass)]">
        {permissionItems.map((p) => (
          <div key={p.key} className="flex justify-between items-center py-3.5 first:pt-0 last:pb-0">
            <div className="flex gap-3 items-start">
              <div className="bg-black/30 p-2 rounded-lg border border-[var(--border-glass)] mt-0.5">
                {p.icon}
              </div>
              <div>
                <span className="text-xs font-semibold text-[var(--text-primary)] block">{p.title}</span>
                <span className="text-[9px] text-[var(--text-muted)] max-w-sm block mt-0.5">{p.desc}</span>
              </div>
            </div>
            <Toggle
              checked={permissions[p.key] ?? false}
              onChange={(checked) => handleToggle(p.key, checked)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
