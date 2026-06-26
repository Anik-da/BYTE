import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Hexagon, Mail, Lock, ArrowRight, UserCircle } from "lucide-react";
import { useAuthStore } from "../stores/useAuthStore";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { APP_NAME, APP_TAGLINE } from "../utils/constants";

export function LoginScreen() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const loginAsGuest = useAuthStore((s) => s.loginAsGuest);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    login(email, password);
    navigate("/", { replace: true });
  };

  const handleGuest = () => {
    loginAsGuest();
    navigate("/", { replace: true });
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg-primary)] relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <motion.div
          animate={{
            background: [
              "radial-gradient(circle at 20% 50%, var(--accent-glow) 0%, transparent 50%)",
              "radial-gradient(circle at 80% 50%, var(--accent-glow) 0%, transparent 50%)",
              "radial-gradient(circle at 50% 20%, var(--accent-glow) 0%, transparent 50%)",
              "radial-gradient(circle at 20% 50%, var(--accent-glow) 0%, transparent 50%)",
            ],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 opacity-30"
        />
        <div className="absolute top-1/3 left-1/4 w-72 h-72 rounded-full bg-[var(--accent)] opacity-[0.02] blur-3xl animate-float" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full bg-purple-500 opacity-[0.02] blur-3xl animate-float" style={{ animationDelay: "3s" }} />
      </div>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
        className="relative w-[420px] glass-heavy rounded-2xl p-8 shadow-2xl"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.1 }}
            className="w-16 h-16 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] flex items-center justify-center mb-4 shadow-lg shadow-[var(--accent-glow)]"
          >
            <Hexagon size={32} className="text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-wider">{APP_NAME}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{APP_TAGLINE}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail size={16} />}
          />
          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock size={16} />}
          />
          <Button
            type="submit"
            className="w-full mt-2"
            size="lg"
            loading={loading}
            icon={<ArrowRight size={18} />}
          >
            Sign In
          </Button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-[var(--border-glass)]" />
          <span className="text-xs text-[var(--text-muted)]">or</span>
          <div className="flex-1 h-px bg-[var(--border-glass)]" />
        </div>

        {/* Guest */}
        <Button
          variant="ghost"
          className="w-full"
          size="lg"
          onClick={handleGuest}
          icon={<UserCircle size={18} />}
        >
          Continue as Guest
        </Button>

        <p className="text-center text-[10px] text-[var(--text-muted)] mt-6">
          Your data stays local. No internet required.
        </p>
      </motion.div>
    </div>
  );
}
