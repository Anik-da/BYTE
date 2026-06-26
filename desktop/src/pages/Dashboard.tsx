import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MessageSquare, Mic, Eye, Zap, Code, Brain, Puzzle, Settings, Activity,
  ArrowRight, Sparkles, Clock, Cpu,
} from "lucide-react";
import { useAuthStore } from "../stores/useAuthStore";
import { useAppStore } from "../stores/useAppStore";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";

interface ModuleItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  status: "active" | "coming-soon";
  color: string;
  path: string;
}

const modules: ModuleItem[] = [
  { id: "ai-chat", title: "AI Chat", description: "Conversational AI with context-aware responses", icon: "MessageSquare", status: "coming-soon", color: "from-blue-500 to-cyan-500", path: "/ai-chat" },
  { id: "voice", title: "Voice", description: "Speech recognition and voice synthesis", icon: "Mic", status: "coming-soon", color: "from-purple-500 to-pink-500", path: "/voice" },
  { id: "vision", title: "Vision", description: "Computer vision and image analysis", icon: "Eye", status: "coming-soon", color: "from-green-500 to-emerald-500", path: "/vision" },
  { id: "automation", title: "Automation", description: "Task scheduling and workflow automation", icon: "Zap", status: "coming-soon", color: "from-amber-500 to-orange-500", path: "/automation" },
  { id: "code-studio", title: "Code Studio", description: "Integrated development environment", icon: "Code", status: "coming-soon", color: "from-indigo-500 to-violet-500", path: "/code-studio" },
  { id: "memory", title: "Memory", description: "Long-term context and knowledge storage", icon: "Brain", status: "coming-soon", color: "from-rose-500 to-red-500", path: "/memory" },
  { id: "plugins", title: "Plugins", description: "Extend BYTE with community modules", icon: "Puzzle", status: "coming-soon", color: "from-teal-500 to-cyan-500", path: "/plugins" },
  { id: "settings", title: "Settings", description: "Configure your BYTE experience", icon: "Settings", status: "active", color: "from-gray-500 to-slate-500", path: "/settings" },
  { id: "system-monitor", title: "System Monitor", description: "Real-time system metrics and logs", icon: "Activity", status: "coming-soon", color: "from-sky-500 to-blue-500", path: "/system-monitor" },
];

const iconMap: Record<string, React.ReactNode> = {
  MessageSquare: <MessageSquare size={24} />,
  Mic: <Mic size={24} />,
  Eye: <Eye size={24} />,
  Zap: <Zap size={24} />,
  Code: <Code size={24} />,
  Brain: <Brain size={24} />,
  Puzzle: <Puzzle size={24} />,
  Settings: <Settings size={24} />,
  Activity: <Activity size={24} />,
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const setCurrentPageTitle = useAppStore((s) => s.setCurrentPageTitle);
  const navigate = useNavigate();

  useEffect(() => { setCurrentPageTitle("Dashboard"); }, [setCurrentPageTitle]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            {getGreeting()}, {user?.name?.split(" ")[0] || "User"} 👋
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <Badge variant="success" size="md">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          All Systems Online
        </Badge>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-3 gap-4">
        {[
          { icon: <Sparkles size={18} />, label: "Active Modules", value: "1 / 9", color: "text-[var(--accent)]" },
          { icon: <Clock size={18} />, label: "Session Time", value: "Just started", color: "text-emerald-400" },
          { icon: <Cpu size={18} />, label: "System Status", value: "Optimal", color: "text-amber-400" },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center gap-3 p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border-glass)] backdrop-blur-xl">
            <div className={`${stat.color} p-2 rounded-lg bg-[var(--bg-glass-heavy)]`}>{stat.icon}</div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">{stat.label}</p>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{stat.value}</p>
            </div>
          </div>
        ))}
      </motion.div>

      <div>
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4">Modules</h2>
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-3 gap-4">
          {modules.map((mod) => (
            <motion.div key={mod.id} variants={item}>
              <Card hover glow onClick={() => navigate(mod.path)}>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${mod.color} flex items-center justify-center text-white shadow-lg`}>
                      {iconMap[mod.icon]}
                    </div>
                    <Badge variant={mod.status === "active" ? "success" : "neutral"} size="sm">
                      {mod.status === "active" ? "Active" : "Coming Soon"}
                    </Badge>
                  </div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{mod.title}</h3>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">{mod.description}</p>
                  <div className="mt-4 flex items-center gap-1 text-xs text-[var(--accent)] font-medium">
                    <span>{mod.status === "active" ? "Open" : "Learn more"}</span>
                    <ArrowRight size={12} />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
