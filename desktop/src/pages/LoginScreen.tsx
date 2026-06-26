import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Hexagon, Lock, ArrowRight, UserCircle, Shield, Volume2, Camera, UserPlus } from "lucide-react";
import { useAuthStore } from "../stores/useAuthStore";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { tauriService } from "../services/tauriService";
import { APP_NAME, APP_TAGLINE } from "../utils/constants";

export function LoginScreen() {
  const navigate = useNavigate();
  const { localUsers, loadLocalUsers, login, loginAsGuest, isFirstLaunch } = useAuthStore();
  
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Load local users on mount
  useEffect(() => {
    async function initialize() {
      await loadLocalUsers();
    }
    initialize();
  }, [loadLocalUsers]);

  // Redirect to wizard if there are no local users and it's first launch
  useEffect(() => {
    if (isFirstLaunch) {
      navigate("/wizard");
    }
  }, [isFirstLaunch, navigate]);

  // Auto-select first user if available
  useEffect(() => {
    if (localUsers.length > 0 && !selectedUser) {
      setSelectedUser(localUsers[0]);
    }
  }, [localUsers, selectedUser]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setLoading(true);
    setErrorMsg("");

    const success = await login(selectedUser.username, password);
    setLoading(false);
    if (success) {
      navigate("/", { replace: true });
    } else {
      setErrorMsg("Incorrect password. Please try again.");
    }
  };

  const handleGuest = () => {
    loginAsGuest();
    navigate("/", { replace: true });
  };

  const handleWindowsHello = async () => {
    if (!selectedUser) return;
    try {
      const verified = await tauriService.verifyWindowsHello(`Unlock BYTE for ${selectedUser.name}`);
      if (verified) {
        // Quick bypass for verified biometric
        useAuthStore.setState({
          user: selectedUser,
          isAuthenticated: true,
          isLocked: false,
        });
        navigate("/", { replace: true });
      }
    } catch (err) {
      setErrorMsg(String(err));
    }
  };

  const handleVoiceVerify = async () => {
    if (!selectedUser) return;
    try {
      const verified = await tauriService.voiceAuthVerify(selectedUser.id, "mock_path_record.wav");
      if (verified) {
        useAuthStore.setState({
          user: selectedUser,
          isAuthenticated: true,
          isLocked: false,
        });
        navigate("/", { replace: true });
      }
    } catch (err) {
      setErrorMsg(String(err));
    }
  };

  const handleFaceVerify = async () => {
    if (!selectedUser) return;
    try {
      const verified = await tauriService.faceAuthVerify(selectedUser.id, "mock_path_capture.jpg");
      if (verified) {
        useAuthStore.setState({
          user: selectedUser,
          isAuthenticated: true,
          isLocked: false,
        });
        navigate("/", { replace: true });
      }
    } catch (err) {
      setErrorMsg(String(err));
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg-primary)] relative overflow-hidden">
      {/* Ambient backgrounds */}
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
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
        className="relative w-[440px] glass-heavy rounded-2xl p-8 shadow-2xl z-10 flex flex-col gap-6"
      >
        {/* Header Logo */}
        <div className="flex flex-col items-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.1 }}
            className="w-14 h-14 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] flex items-center justify-center mb-3 shadow-lg shadow-[var(--accent-glow)]"
          >
            <Hexagon size={28} className="text-white" />
          </motion.div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-wider">{APP_NAME}</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">{APP_TAGLINE}</p>
        </div>

        {/* User Account Selection List */}
        {localUsers.length > 1 && (
          <div className="flex justify-center gap-4 overflow-x-auto py-2 border-b border-[var(--border-glass)]">
            {localUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  setSelectedUser(u);
                  setPassword("");
                  setErrorMsg("");
                }}
                className="flex flex-col items-center gap-1.5 cursor-pointer group"
              >
                <div className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-all ${
                  selectedUser?.id === u.id ? "border-[var(--accent)] scale-110 shadow-md" : "border-transparent opacity-60 group-hover:opacity-100"
                }`}>
                  <img src={u.avatar} alt="avatar" className="w-full h-full object-cover" />
                </div>
                <span className="text-[10px] text-[var(--text-secondary)] font-medium max-w-[60px] truncate">{u.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Login Credentials Prompt */}
        {selectedUser && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="flex items-center gap-3 bg-[var(--bg-glass-heavy)] p-3 rounded-xl border border-[var(--border-glass)]">
              <img src={selectedUser.avatar} alt="avatar" className="w-9 h-9 rounded-full object-cover border border-[var(--border-glass)]" />
              <div>
                <h3 className="text-xs font-semibold text-[var(--text-primary)]">{selectedUser.name}</h3>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">@{selectedUser.username}</span>
              </div>
            </div>

            <Input
              label="Password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock size={15} />}
              required
            />

            {errorMsg && (
              <p className="text-red-400 text-[10px] font-semibold text-center mt-1 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                {errorMsg}
              </p>
            )}

            <Button
              type="submit"
              className="w-full mt-2"
              size="md"
              loading={loading}
              icon={<ArrowRight size={16} />}
            >
              Sign In
            </Button>
          </form>
        )}

        {/* Biometrics Actions Panel */}
        {selectedUser && (
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
        )}

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[var(--border-glass)]" />
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-[var(--border-glass)]" />
        </div>

        {/* Guest & New Profile */}
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            className="w-full"
            size="md"
            onClick={handleGuest}
            icon={<UserCircle size={16} />}
          >
            Continue as Guest
          </Button>

          <Link to="/register" className="w-full">
            <Button
              variant="secondary"
              className="w-full"
              size="md"
              icon={<UserPlus size={16} />}
            >
              Add Profile
            </Button>
          </Link>
        </div>

        <p className="text-center text-[10px] text-[var(--text-muted)]">
          All security keys, passwords, and sessions are kept offline.
        </p>
      </motion.div>
    </div>
  );
}
