import { useState } from "react";
import { Shield, Key, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useAuthStore } from "../../stores/useAuthStore";
import { tauriService } from "../../services/tauriService";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

export function SecuritySettings() {
  const { user } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [showRecoveryKey, setShowRecoveryKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });

  const sessions = [
    { id: "1", device: "This Device (Windows Host)", active: true, ip: "127.0.0.1", date: "Just now" },
    { id: "2", device: "Tauri Webview Core", active: false, ip: "127.0.0.1", date: "2 hours ago" }
  ];

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMsg({ text: "New passwords do not match!", type: "error" });
      return;
    }
    setLoading(true);
    setMsg({ text: "", type: "" });
    // Mock update request simulating local SQLite re-hash
    await new Promise((r) => setTimeout(r, 600));
    setLoading(false);
    setMsg({ text: "Password updated successfully!", type: "success" });
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const enrollVoice = async () => {
    try {
      if (!user?.id) return;
      const success = await tauriService.voiceAuthEnroll(user.id, "Default Voice", "voice_profile.wav");
      if (success) {
        await tauriService.showMessageDialog("Enrolled", "Voice profile successfully enrolled offline.", "info");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const enrollFace = async () => {
    try {
      if (!user?.id) return;
      const success = await tauriService.faceAuthEnroll(user.id, "Default Face", "face_profile.jpg");
      if (success) {
        await tauriService.showMessageDialog("Enrolled", "Face profile successfully enrolled offline.", "info");
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Local Authentication Settings</h2>
        <p className="text-[10px] text-[var(--text-muted)]">Configure how you sign in and unlock your personal AI environment</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Update Password */}
        <div className="bg-[var(--bg-glass-heavy)] border border-[var(--border-glass)] rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Key size={14} className="text-[var(--accent)]" /> Change Password
          </h3>
          <form onSubmit={handleUpdatePassword} className="space-y-3">
            <Input
              type="password"
              placeholder="Current Password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            {msg.text && (
              <p className={`text-[10px] p-2 rounded-lg border text-center ${
                msg.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}>
                {msg.text}
              </p>
            )}

            <Button type="submit" variant="primary" size="sm" loading={loading} className="w-full">
              Update Password
            </Button>
          </form>
        </div>

        {/* Biometrics Status */}
        <div className="bg-[var(--bg-glass-heavy)] border border-[var(--border-glass)] rounded-xl p-4 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Shield size={14} className="text-[var(--accent)]" /> Biometric Registrations
            </h3>
            
            {/* Windows Hello */}
            <div className="flex justify-between items-center bg-black/20 p-2.5 rounded-lg border border-[var(--border-glass)]">
              <div>
                <span className="text-xs font-semibold text-[var(--text-primary)] block">Windows Hello</span>
                <span className="text-[9px] text-[var(--text-muted)]">Linked to native Windows security credential provider</span>
              </div>
              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                Ready
              </span>
            </div>

            {/* Voice Auth */}
            <div className="flex justify-between items-center bg-black/20 p-2.5 rounded-lg border border-[var(--border-glass)]">
              <div>
                <span className="text-xs font-semibold text-[var(--text-primary)] block">Speaker Recognition</span>
                <span className="text-[9px] text-[var(--text-muted)]">Offline audio fingerprint modeling profile</span>
              </div>
              <Button variant="ghost" size="sm" onClick={enrollVoice} className="text-[9px] px-3 py-1">
                Re-enroll
              </Button>
            </div>

            {/* Face Auth */}
            <div className="flex justify-between items-center bg-black/20 p-2.5 rounded-lg border border-[var(--border-glass)]">
              <div>
                <span className="text-xs font-semibold text-[var(--text-primary)] block">Facial Verification</span>
                <span className="text-[9px] text-[var(--text-muted)]">Offline OpenCV biometric face print template</span>
              </div>
              <Button variant="ghost" size="sm" onClick={enrollFace} className="text-[9px] px-3 py-1">
                Re-enroll
              </Button>
            </div>
          </div>

          {/* Recovery Key Toggle */}
          <div className="border-t border-[var(--border-glass)] pt-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold text-[var(--text-secondary)] block">Recovery Key</span>
              <span className="text-[8px] text-[var(--text-muted)]">Required if you forget your master password</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRecoveryKey(!showRecoveryKey)}
              icon={showRecoveryKey ? <EyeOff size={12} /> : <Eye size={12} />}
              className="text-[9px] px-3 py-1"
            >
              {showRecoveryKey ? "Hide" : "Show"}
            </Button>
          </div>
          {showRecoveryKey && (
            <div className="bg-black/40 border border-[var(--border-glass)] p-2.5 rounded-lg font-mono text-[10px] text-center font-bold text-[var(--accent)] select-all tracking-wider">
              {user?.recovery_key || "XXXX-XXXX-XXXX-XXXX"}
            </div>
          )}
        </div>
      </div>

      {/* Sessions Management */}
      <div className="bg-[var(--bg-glass-heavy)] border border-[var(--border-glass)] rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <RefreshCw size={14} className="text-[var(--accent)] animate-spin-slow" /> Active Security Sessions
        </h3>
        <div className="divide-y divide-[var(--border-glass)]">
          {sessions.map((s) => (
            <div key={s.id} className="flex justify-between items-center py-2.5 first:pt-0 last:pb-0">
              <div>
                <span className="text-xs font-semibold text-[var(--text-primary)] block">
                  {s.device} {s.active && <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 ml-2">Active</span>}
                </span>
                <span className="text-[9px] text-[var(--text-muted)] font-mono">{s.ip} • logged in {s.date}</span>
              </div>
              {!s.active && (
                <Button variant="ghost" size="sm" className="text-[9px] hover:text-red-400 border border-transparent hover:border-red-500/20 px-3 py-1">
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
