import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  User as UserIcon, Shield, Palette, Award, Check, ChevronRight,
  FolderOpen, Key, Volume2, Camera
} from "lucide-react";
import { useAuthStore } from "../stores/useAuthStore";
import { useThemeStore } from "../stores/useThemeStore";
import { tauriService } from "../services/tauriService";
import { GlassPanel } from "../components/ui/GlassPanel";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { ACCENT_COLORS } from "../utils/constants";
import type { AccentColor } from "../utils/constants";

export function FirstLaunchWizard() {
  const navigate = useNavigate();
  const { setAuthState } = useAuthStore();
  const { mode, accentColor, setAccentColor, toggleTheme } = useThemeStore();

  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatar, setAvatar] = useState("");
  
  // Security Questions
  const [q1, setQ1] = useState("What was the name of your first pet?");
  const [a1, setA1] = useState("");
  const [q2, setQ2] = useState("In what city were you born?");
  const [a2, setA2] = useState("");

  // Biometrics States
  const [windowsHelloEnabled, setWindowsHelloEnabled] = useState(false);
  const [voiceAuthEnrolled, setVoiceAuthEnrolled] = useState(false);
  const [faceAuthEnrolled, setFaceAuthEnrolled] = useState(false);

  // General Preferences
  const [aiModel, setAiModel] = useState("Claude 3.5 Sonnet");
  const [workspace, setWorkspace] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");

  const presetAvatars = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80"
  ];

  // Auto-fill documents path on load
  useEffect(() => {
    async function loadDefaultWorkspace() {
      try {
        const { documentDir } = await import("@tauri-apps/api/path");
        const docDir = await documentDir();
        setWorkspace(docDir);
      } catch (e) {
        console.warn(e);
      }
    }
    loadDefaultWorkspace();
  }, []);

  const handleSelectWorkspace = async () => {
    try {
      const selected = await tauriService.showFilePicker("Select Default Workspace", true);
      if (selected) {
        setWorkspace(selected);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEnrollWindowsHello = async () => {
    try {
      const verified = await tauriService.verifyWindowsHello("Enroll this device with Windows Hello for BYTE OS");
      if (verified) {
        setWindowsHelloEnabled(true);
        await tauriService.showMessageDialog("Success", "Windows Hello has been successfully linked!", "info");
      }
    } catch (err) {
      await tauriService.showMessageDialog("Windows Hello", String(err), "warning");
    }
  };

  const handleEnrollVoice = async () => {
    // Simulated Voice enrollment for the Voice Authentication Architecture Module
    setVoiceAuthEnrolled(true);
    await tauriService.showMessageDialog("Voice Enrolled", "Mock speaker profile successfully created and stored in local registry.", "info");
  };

  const handleEnrollFace = async () => {
    // Simulated Face enrollment for the OpenCV Face Auth Module
    setFaceAuthEnrolled(true);
    await tauriService.showMessageDialog("Face Enrolled", "Mock face print successfully computed and stored in secure SQLite database.", "info");
  };

  const handleFinish = async () => {
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
        preferences: JSON.stringify({ theme: mode, accentColor, aiModel }),
        settings: JSON.stringify({ windowsHelloEnabled, voiceAuthEnrolled, faceAuthEnrolled }),
        permissions: JSON.stringify({
          camera: faceAuthEnrolled,
          microphone: voiceAuthEnrolled,
          screenCapture: true,
          filesystem: true,
          notifications: true,
          location: false,
          internet: true
        }),
        avatar: avatar || presetAvatars[0],
      });

      setRecoveryKey(result.recovery_key);
      setStep(5); // Go to Success / Recovery Screen
    } catch (err) {
      await tauriService.showMessageDialog("Registration Failed", String(err), "error");
    }
  };

  const nextStep = () => setStep((s) => s + 1);
  const prevStep = () => setStep((s) => s - 1);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Dynamic ambient blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[var(--accent)] opacity-10 blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-purple-500 opacity-10 blur-[120px]" />

      <GlassPanel padding="lg" className="w-full max-w-xl border border-[var(--border-glass)] relative z-10 flex flex-col gap-6">
        
        {/* Wizard Headers */}
        <div className="flex items-center justify-between border-b border-[var(--border-glass)] pb-4">
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)]">Setup Wizard</h1>
            <p className="text-xs text-[var(--text-muted)]">Configure your local BYTE environment</p>
          </div>
          <span className="text-xs font-mono font-bold text-[var(--accent)] bg-[var(--accent-muted)] px-3 py-1 rounded-full">
            Step {step} of 5
          </span>
        </div>

        {/* Step Content */}
        <div className="min-h-[280px] flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex gap-3 items-center text-[var(--accent)]">
                  <UserIcon size={20} />
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">Create Local Account</h2>
                </div>
                <Input
                  label="Full Name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
                <Input
                  label="Username"
                  placeholder="johndoe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                
                {/* Preset Avatars Selection */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">Choose Avatar</label>
                  <div className="flex gap-3">
                    {presetAvatars.map((av) => (
                      <button
                        key={av}
                        onClick={() => setAvatar(av)}
                        className={`w-12 h-12 rounded-full overflow-hidden border-2 cursor-pointer transition-all ${
                          avatar === av ? "border-[var(--accent)] scale-110 shadow-lg" : "border-transparent opacity-60 hover:opacity-100"
                        }`}
                      >
                        <img src={av} alt="avatar" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex gap-3 items-center text-[var(--accent)]">
                  <Key size={20} />
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">Secure Your Account</h2>
                </div>
                <Input
                  type="password"
                  label="Password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Input
                  type="password"
                  label="Confirm Password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />

                {/* Security Questions */}
                <div className="space-y-3 pt-2">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)]">Security Questions</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex gap-3 items-center text-[var(--accent)]">
                  <Palette size={20} />
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">Customization</h2>
                </div>
                
                {/* Theme Toggle */}
                <div className="flex justify-between items-center bg-[var(--bg-glass)] p-3 rounded-xl border border-[var(--border-glass)]">
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--text-primary)]">Select Dark Mode</h3>
                    <p className="text-[10px] text-[var(--text-muted)]">Choose standard UI color mode</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={toggleTheme}>
                    {mode === "dark" ? "Dark Mode" : "Light Mode"}
                  </Button>
                </div>

                {/* Accent Colors list */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">Accent Color</label>
                  <div className="flex gap-3">
                    {ACCENT_COLORS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setAccentColor(c.value as AccentColor)}
                        className={`w-8 h-8 rounded-lg cursor-pointer transition-all border ${
                          accentColor === c.value ? "border-white ring-2 ring-current scale-110" : "border-transparent opacity-80 hover:scale-105"
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>

                {/* AI Model Preference */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)]">Preferred AI Engine</label>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="w-full bg-[var(--bg-glass-heavy)] border border-[var(--border-glass)] text-xs rounded-lg p-2.5 text-[var(--text-primary)]"
                  >
                    <option>Claude 3.5 Sonnet</option>
                    <option>GPT-4o</option>
                    <option>DeepSeek R1</option>
                    <option>Local Llama 3 (Ollama)</option>
                  </select>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex gap-3 items-center text-[var(--accent)]">
                  <Shield size={20} />
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">Biometrics & Permissions</h2>
                </div>

                {/* Windows Hello Enrollment */}
                <div className="flex justify-between items-center bg-[var(--bg-glass)] p-3 rounded-xl border border-[var(--border-glass)]">
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--text-primary)]">Windows Hello</h3>
                    <p className="text-[10px] text-[var(--text-muted)]">Link Windows Hello PIN or biometrics</p>
                  </div>
                  <Button
                    variant={windowsHelloEnabled ? "secondary" : "primary"}
                    size="sm"
                    onClick={handleEnrollWindowsHello}
                    icon={windowsHelloEnabled ? <Check size={12} /> : undefined}
                  >
                    {windowsHelloEnabled ? "Enabled" : "Configure"}
                  </Button>
                </div>

                {/* Voice Enrollment */}
                <div className="flex justify-between items-center bg-[var(--bg-glass)] p-3 rounded-xl border border-[var(--border-glass)]">
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--text-primary)]">Voice Identification</h3>
                    <p className="text-[10px] text-[var(--text-muted)]">Record speech print mock profile</p>
                  </div>
                  <Button
                    variant={voiceAuthEnrolled ? "secondary" : "primary"}
                    size="sm"
                    onClick={handleEnrollVoice}
                    icon={voiceAuthEnrolled ? <Check size={12} /> : <Volume2 size={12} />}
                  >
                    {voiceAuthEnrolled ? "Enrolled" : "Enroll"}
                  </Button>
                </div>

                {/* Face Enrollment */}
                <div className="flex justify-between items-center bg-[var(--bg-glass)] p-3 rounded-xl border border-[var(--border-glass)]">
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--text-primary)]">Face Verification</h3>
                    <p className="text-[10px] text-[var(--text-muted)]">Enroll OpenCV facial template mapping</p>
                  </div>
                  <Button
                    variant={faceAuthEnrolled ? "secondary" : "primary"}
                    size="sm"
                    onClick={handleEnrollFace}
                    icon={faceAuthEnrolled ? <Check size={12} /> : <Camera size={12} />}
                  >
                    {faceAuthEnrolled ? "Enrolled" : "Enroll"}
                  </Button>
                </div>

                {/* Default Workspace */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)]">Default Workspace</label>
                  <div className="flex gap-2">
                    <div className="flex-1 text-xs font-mono bg-[var(--bg-glass-heavy)] border border-[var(--border-glass)] p-2.5 rounded-lg text-[var(--text-muted)] truncate">
                      {workspace || "No workspace selected"}
                    </div>
                    <Button variant="secondary" size="sm" onClick={handleSelectWorkspace} icon={<FolderOpen size={14} />} />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4 text-center flex flex-col items-center"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2 animate-bounce">
                  <Award size={24} />
                </div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">Account Created Successfully!</h2>
                <p className="text-xs text-[var(--text-muted)] max-w-sm">
                  Write down your account recovery key. If you forget your password, this key is required to recover your data.
                </p>

                <div className="w-full bg-black/40 border border-[var(--border-glass)] p-4 rounded-xl font-mono text-sm font-bold text-[var(--accent)] select-all tracking-widest my-2">
                  {recoveryKey || "XXXX-XXXX-XXXX-XXXX"}
                </div>

                <Button
                  variant="primary"
                  className="w-full mt-4"
                  onClick={async () => {
                    // Navigate to Login/Dashboard
                    setAuthState({ isFirstLaunch: false });
                    await useAuthStore.getState().loadLocalUsers();
                    navigate("/login");
                  }}
                >
                  Proceed to Login
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action Buttons */}
        {step < 5 && (
          <div className="flex justify-between border-t border-[var(--border-glass)] pt-4 mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={prevStep}
              disabled={step === 1}
            >
              Back
            </Button>
            {step < 4 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={nextStep}
                disabled={(step === 1 && (!username || !name)) || (step === 2 && (!password || !confirmPassword || !a1 || !a2))}
                icon={<ChevronRight size={14} />}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleFinish}
              >
                Create Account
              </Button>
            )}
          </div>
        )}

      </GlassPanel>
    </div>
  );
}
