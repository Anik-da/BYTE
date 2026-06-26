import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Shield, ChevronRight } from "lucide-react";
import { useAuthStore } from "../stores/useAuthStore";
import { tauriService } from "../services/tauriService";
import { GlassPanel } from "../components/ui/GlassPanel";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

export function RegisterScreen() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Security Questions
  const [q1, setQ1] = useState("What was the name of your first pet?");
  const [a1, setA1] = useState("");
  const [q2, setQ2] = useState("In what city were you born?");
  const [a2, setA2] = useState("");

  const [recoveryKey, setRecoveryKey] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    try {
      const result = await tauriService.registerUser({
        username,
        name,
        password,
        securityQ1: q1,
        securityA1: a1,
        securityQ2: q2,
        securityA2: a2,
        preferences: JSON.stringify({}),
        settings: JSON.stringify({}),
        permissions: JSON.stringify({
          camera: false,
          microphone: false,
          screenCapture: true,
          filesystem: true,
          notifications: true,
          location: false,
          internet: true
        }),
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
      });

      setRecoveryKey(result.recovery_key);
    } catch (err) {
      await tauriService.showMessageDialog("Registration Failed", String(err), "error");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[var(--accent)] opacity-10 blur-[120px]" />
      
      <GlassPanel padding="lg" className="w-full max-w-md border border-[var(--border-glass)] relative z-10 flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Add Local Profile</h1>
          <p className="text-xs text-[var(--text-muted)]">Create another secure profile on this computer</p>
        </div>

        {!recoveryKey ? (
          <form onSubmit={handleRegister} className="space-y-4">
            <Input
              label="Full Name"
              placeholder="Alice Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="Username"
              placeholder="alice"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <Input
              type="password"
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Input
              type="password"
              label="Confirm Password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            {/* Security Questions */}
            <div className="space-y-2 pt-2 border-t border-[var(--border-glass)]">
              <span className="block text-xs font-semibold text-[var(--text-secondary)]">Security Verification</span>
              <div className="space-y-3">
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] block mb-1">Question 1</span>
                  <select
                    value={q1}
                    onChange={(e) => setQ1(e.target.value)}
                    className="w-full bg-[var(--bg-glass-heavy)] border border-[var(--border-glass)] text-xs rounded-lg p-2 text-[var(--text-primary)]"
                  >
                    <option>What was the name of your first pet?</option>
                    <option>What is your mother's maiden name?</option>
                  </select>
                  <input
                    type="password"
                    placeholder="Answer"
                    value={a1}
                    onChange={(e) => setA1(e.target.value)}
                    className="w-full bg-transparent border-b border-[var(--border-glass)] text-xs py-1.5 px-1 outline-none text-[var(--text-primary)] mt-1.5"
                    required
                  />
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] block mb-1">Question 2</span>
                  <select
                    value={q2}
                    onChange={(e) => setQ2(e.target.value)}
                    className="w-full bg-[var(--bg-glass-heavy)] border border-[var(--border-glass)] text-xs rounded-lg p-2 text-[var(--text-primary)]"
                  >
                    <option>In what city were you born?</option>
                    <option>What was the name of your high school?</option>
                  </select>
                  <input
                    type="password"
                    placeholder="Answer"
                    value={a2}
                    onChange={(e) => setA2(e.target.value)}
                    className="w-full bg-transparent border-b border-[var(--border-glass)] text-xs py-1.5 px-1 outline-none text-[var(--text-primary)] mt-1.5"
                    required
                  />
                </div>
              </div>
            </div>

            <Button type="submit" variant="primary" className="w-full mt-4" icon={<ChevronRight size={14} />}>
              Create Profile
            </Button>
            <div className="text-center mt-2">
              <Link to="/login" className="text-xs text-[var(--accent)] hover:underline">
                Back to Login
              </Link>
            </div>
          </form>
        ) : (
          <div className="space-y-4 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Shield size={24} />
            </div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Profile Registered!</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Store this recovery key safely. It is required if you forget your password.
            </p>
            <div className="w-full bg-black/40 border border-[var(--border-glass)] p-4 rounded-xl font-mono text-sm font-bold text-[var(--accent)] tracking-widest select-all my-2">
              {recoveryKey}
            </div>
            <Button
              variant="primary"
              className="w-full mt-2"
              onClick={async () => {
                await useAuthStore.getState().loadLocalUsers();
                navigate("/login");
              }}
            >
              Back to Login
            </Button>
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
