import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, ArrowRight, Shield, Volume2, Camera, LogOut } from "lucide-react";
import { useAuthStore } from "../stores/useAuthStore";
import { tauriService } from "../services/tauriService";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { GlassPanel } from "../components/ui/GlassPanel";

export function LockScreen() {
  const navigate = useNavigate();
  const { user, login, logout, unlockSession } = useAuthStore();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.username) return;
    setLoading(true);
    setErrorMsg("");

    const success = await login(user.username, password);
    setLoading(false);
    if (success) {
      unlockSession();
      navigate("/");
    } else {
      setErrorMsg("Incorrect password. Please try again.");
    }
  };

  const handleWindowsHello = async () => {
    if (!user) return;
    try {
      const verified = await tauriService.verifyWindowsHello(`Unlock session for ${user.name}`);
      if (verified) {
        unlockSession();
        navigate("/");
      }
    } catch (err) {
      setErrorMsg(String(err));
    }
  };

  const handleVoiceVerify = async () => {
    if (!user || !user.id) return;
    try {
      const verified = await tauriService.voiceAuthVerify(user.id, "mock_path_record.wav");
      if (verified) {
        unlockSession();
        navigate("/");
      }
    } catch (err) {
      setErrorMsg(String(err));
    }
  };

  const handleFaceVerify = async () => {
    if (!user || !user.id) return;
    try {
      const verified = await tauriService.faceAuthVerify(user.id, "mock_path_capture.jpg");
      if (verified) {
        unlockSession();
        navigate("/");
      }
    } catch (err) {
      setErrorMsg(String(err));
    }
  };

  const handleSignOut = () => {
    logout();
    navigate("/login");
  };

  if (!user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <Button onClick={() => navigate("/login")}>Go to Login</Button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg-primary)] relative overflow-hidden z-50">
      {/* Blurred overlay backdrop of the app content */}
      <div className="absolute inset-0 bg-cover bg-center filter blur-xl scale-110 opacity-40 bg-[radial-gradient(circle_at_center,var(--accent-glow)_0%,transparent_70%)]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
        className="w-full max-w-sm z-10"
      >
        <GlassPanel padding="lg" className="border border-[var(--border-glass)] flex flex-col gap-6 text-center shadow-2xl">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[var(--accent)] mb-3 shadow-lg shadow-[var(--accent-glow)]">
              <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
            </div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">{user.name}</h2>
            <p className="text-[10px] text-[var(--text-muted)] font-mono">Session Locked</p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <Input
              type="password"
              placeholder="Enter password to unlock"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock size={15} />}
              required
              autoFocus
            />

            {errorMsg && (
              <p className="text-red-400 text-[10px] font-semibold bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                {errorMsg}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              loading={loading}
              icon={<ArrowRight size={16} />}
            >
              Unlock
            </Button>
          </form>

          {/* Biometrics Actions */}
          <div className="flex justify-center gap-3 border-t border-[var(--border-glass)] pt-4">
            <Button variant="ghost" size="sm" onClick={handleWindowsHello} icon={<Shield size={13} />} className="text-[10px]">
              Hello
            </Button>
            <Button variant="ghost" size="sm" onClick={handleVoiceVerify} icon={<Volume2 size={13} />} className="text-[10px]">
              Voice
            </Button>
            <Button variant="ghost" size="sm" onClick={handleFaceVerify} icon={<Camera size={13} />} className="text-[10px]">
              Face
            </Button>
          </div>

          <div className="flex justify-center border-t border-[var(--border-glass)] pt-4 mt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              icon={<LogOut size={13} />}
              className="text-[10px] hover:text-red-400"
            >
              Switch User / Sign Out
            </Button>
          </div>
        </GlassPanel>
      </motion.div>
    </div>
  );
}
