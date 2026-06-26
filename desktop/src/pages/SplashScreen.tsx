import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Hexagon } from "lucide-react";
import { APP_NAME, APP_TAGLINE } from "../utils/constants";

const loadingSteps = [
  "Initializing core systems...",
  "Loading AI modules...",
  "Configuring environment...",
  "Starting BYTE engine...",
  "Ready.",
];

export function SplashScreen() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const totalDuration = 2500;
    const stepDuration = totalDuration / loadingSteps.length;
    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 2, 100));
    }, totalDuration / 50);

    const stepInterval = setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, loadingSteps.length - 1));
    }, stepDuration);

    const timeout = setTimeout(() => {
      navigate("/login", { replace: true });
    }, totalDuration + 300);

    return () => {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ x: [0, 50, 0], y: [0, -30, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[var(--accent)] opacity-[0.03] blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -40, 0], y: [0, 40, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-purple-500 opacity-[0.03] blur-3xl"
        />
      </div>

      {/* Logo */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="relative mb-8"
      >
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] flex items-center justify-center shadow-2xl animate-pulse-glow">
          <Hexagon size={48} className="text-white" />
        </div>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-2xl border border-[var(--accent-glow)]"
          style={{ transform: "scale(1.3)" }}
        />
      </motion.div>

      {/* App Name */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-4xl font-bold text-[var(--text-primary)] tracking-[0.3em] mb-2"
      >
        {APP_NAME}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-sm text-[var(--text-muted)] mb-12"
      >
        {APP_TAGLINE}
      </motion.p>

      {/* Progress bar */}
      <motion.div
        initial={{ opacity: 0, width: 0 }}
        animate={{ opacity: 1, width: 280 }}
        transition={{ delay: 0.7 }}
        className="h-1 bg-[var(--bg-glass-heavy)] rounded-full overflow-hidden mb-4"
      >
        <motion.div
          className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] rounded-full"
          style={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
      </motion.div>

      {/* Loading text */}
      <motion.p
        key={stepIndex}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xs text-[var(--text-muted)] font-mono"
      >
        {loadingSteps[stepIndex]}
      </motion.p>
    </div>
  );
}
