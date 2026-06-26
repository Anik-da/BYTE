import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Mic, MicOff, Volume2, Settings, Activity, RefreshCw,
  Play, Square, Radio, Info
} from "lucide-react";
import { VoiceService, AudioDevice, VoiceConfig } from "../services/voiceService";
import toast from "react-hot-toast";

export function VoiceDashboard() {
  const [config, setConfig] = useState<VoiceConfig>({
    microphone_id: "default",
    speaker_id: "default",
    wake_word_enabled: true,
    wake_word_sensitivity: 0.5,
    always_listening: false,
    push_to_talk: true,
    language: "en-US",
    voice_speed: 1.0,
    voice_pitch: 1.0,
    voice_type: "female",
    noise_reduction: true,
    voice_auth_enabled: false,
  });

  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string>("sleeping");
  const [transcriptHistory, setTranscriptHistory] = useState<string[]>([]);
  const [audioLevel, setAudioLevel] = useState<number>(0.0);
  const [isTestingLevel, setIsTestingLevel] = useState(false);
  const [ttsTextInput, setTtsTextInput] = useState("");
  const [isPlayingTts, setIsPlayingTts] = useState(false);

  // References for subscriptions
  const unsubscribeListening = useRef<(() => void) | null>(null);
  const unsubscribeLevel = useRef<(() => void) | null>(null);

  // Load config & devices
  useEffect(() => {
    async function loadData() {
      const savedConfig = await VoiceService.loadSettings();
      setConfig(savedConfig);

      const queriedDevices = await VoiceService.getAudioDevices();
      setDevices(queriedDevices);
    }
    loadData();

    return () => {
      if (unsubscribeListening.current) unsubscribeListening.current();
      if (unsubscribeLevel.current) unsubscribeLevel.current();
    };
  }, []);

  const handleStartListening = async () => {
    if (isListening) {
      if (unsubscribeListening.current) {
        unsubscribeListening.current();
        unsubscribeListening.current = null;
      }
      setIsListening(false);
      setVoiceStatus("sleeping");
      toast.success("Stopped listening loop.");
      return;
    }

    try {
      const cleanup = await VoiceService.startListening(
        (status) => {
          setVoiceStatus(status);
        },
        (phrase) => {
          setTranscriptHistory(prev => [phrase, ...prev]);
          toast.success(`Heard: "${phrase}"`);
        }
      );
      unsubscribeListening.current = cleanup;
      setIsListening(true);
      toast.success("Always-Listening Wake Word daemon online.");
    } catch (e) {
      toast.error("Failed to start voice listening engine.");
    }
  };

  const handleTestLevel = async () => {
    if (isTestingLevel) {
      if (unsubscribeLevel.current) {
        unsubscribeLevel.current();
        unsubscribeLevel.current = null;
      }
      setIsTestingLevel(false);
      setAudioLevel(0);
      return;
    }

    setIsTestingLevel(true);
    const cleanup = await VoiceService.testMicrophoneLevel((level) => {
      setAudioLevel(level);
    });
    unsubscribeLevel.current = cleanup;

    // Auto cleanup test after 5 seconds
    setTimeout(() => {
      setIsTestingLevel(false);
      setAudioLevel(0);
      if (unsubscribeLevel.current) {
        unsubscribeLevel.current();
        unsubscribeLevel.current = null;
      }
    }, 5000);
  };

  const handleSpeakText = async () => {
    if (!ttsTextInput.trim()) return;
    setIsPlayingTts(true);
    await VoiceService.speakText(ttsTextInput, config);
    setTimeout(() => setIsPlayingTts(false), 2000);
  };

  const handleSaveConfig = async (updatedConfig: VoiceConfig) => {
    setConfig(updatedConfig);
    const ok = await VoiceService.saveSettings(updatedConfig);
    if (ok) {
      toast.success("Voice engine configuration updated.");
    }
  };

  const inputs = devices.filter(d => d.is_input);
  const outputs = devices.filter(d => !d.is_input);

  // Generate waves styling based on levels
  const waveBarsCount = 14;
  const currentHeightFactor = isTestingLevel ? audioLevel : (isListening ? 0.3 : 0.05);

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto p-6 space-y-6">
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">BYTE Voice Engine</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Configure spatial audio devices, custom wake words, and offline speech loops.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              const queriedDevices = await VoiceService.getAudioDevices();
              setDevices(queriedDevices);
              toast.success("Hot-swapped audio devices re-enumerated.");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border-default)] hover:bg-[var(--bg-glass-heavy)] text-xs text-[var(--text-primary)] rounded-lg transition duration-200 cursor-pointer"
          >
            <RefreshCw size={13} />
            Scan Devices
          </button>
        </div>
      </div>

      {/* 2. Visualizer and Status HUD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-[var(--bg-glass-heavy)] border border-[var(--border-default)] rounded-xl p-5 flex flex-col items-center justify-center relative overflow-hidden h-64 shadow-xl">
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <Radio className="text-[var(--accent)] animate-pulse" size={14} />
            <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)]">Input Monitor</span>
          </div>

          {/* Animated Waveforms */}
          <div className="flex items-center justify-center gap-1 h-28 w-full max-w-sm mb-4">
            {Array.from({ length: waveBarsCount }).map((_, idx) => {
              // Calculate random height modifier to make it look like a real audio stream
              const randModifier = 0.5 + Math.sin((idx / waveBarsCount) * Math.PI) * 0.5;
              const heightPct = Math.max(10, Math.min(100, Math.floor(currentHeightFactor * 100 * randModifier)));
              
              return (
                <motion.div
                  key={idx}
                  animate={{ height: `${heightPct}%` }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="w-2.5 rounded-full bg-gradient-to-t from-[var(--accent)] to-cyan-400"
                />
              );
            })}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleStartListening}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-xs tracking-wider uppercase transition shadow-lg cursor-pointer ${
                isListening
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white"
              }`}
            >
              {isListening ? <MicOff size={14} /> : <Mic size={14} />}
              {isListening ? "Mute Always Listening" : "Start Voice Daemon"}
            </button>

            <button
              onClick={handleTestLevel}
              className="flex items-center gap-1.5 px-4 py-2 bg-[var(--bg-glass-heavy)] border border-[var(--border-default)] hover:text-[var(--text-primary)] text-[var(--text-secondary)] text-xs font-semibold rounded-full transition cursor-pointer"
            >
              <Activity size={13} />
              {isTestingLevel ? "Muted Test" : "Test Mic Level"}
            </button>
          </div>
        </div>

        {/* HUD Info Status */}
        <div className="bg-[var(--bg-glass-heavy)] border border-[var(--border-default)] rounded-xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-3">Daemon HUD Status</h3>
            <div className="space-y-3.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-muted)]">Voice Engine State:</span>
                <span className="font-semibold capitalize px-2 py-0.5 rounded bg-[var(--bg-glass-heavy)] border border-[var(--border-default)] text-[var(--text-primary)]">{voiceStatus}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-muted)]">Audio Decibel:</span>
                <span className="font-semibold text-cyan-400">{(audioLevel * 100).toFixed(0)} dB</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-muted)]">Wake Word Status:</span>
                <span className="font-semibold text-emerald-400">{config.wake_word_enabled ? "Enabled ('Hey BYTE')" : "Disabled"}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-muted)]">Speaker Auth Lock:</span>
                <span className="font-semibold text-amber-500">{config.voice_auth_enabled ? "Active" : "Bypassed"}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--border-default)]/30 flex items-center gap-2 text-[10px] text-[var(--text-muted)] leading-relaxed">
            <Info size={14} className="flex-shrink-0 text-[var(--accent)]" />
            <span>Voice commands route through internal threads to maintain low CPU profiles.</span>
          </div>
        </div>
      </div>

      {/* 3. Audio Device Selection & Wake Word settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Device Selectors */}
        <div className="bg-[var(--bg-glass-heavy)] border border-[var(--border-default)] rounded-xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Volume2 size={16} className="text-[var(--accent)]" />
            Spatial Device Configuration
          </h3>
          <div className="space-y-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[var(--text-muted)]">Active Microphone Input</label>
              <select
                value={config.microphone_id}
                onChange={(e) => handleSaveConfig({ ...config, microphone_id: e.target.value })}
                className="w-full bg-[var(--bg-glass-heavy)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              >
                {inputs.map(dev => (
                  <option key={dev.id} value={dev.id}>{dev.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[var(--text-muted)]">Active Speaker Output</label>
              <select
                value={config.speaker_id}
                onChange={(e) => handleSaveConfig({ ...config, speaker_id: e.target.value })}
                className="w-full bg-[var(--bg-glass-heavy)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              >
                {outputs.map(dev => (
                  <option key={dev.id} value={dev.id}>{dev.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Wake Word config details */}
        <div className="bg-[var(--bg-glass-heavy)] border border-[var(--border-default)] rounded-xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Settings size={16} className="text-[var(--accent)]" />
            Wake Word & Listening Modes
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[var(--text-primary)]">Custom Wake Word Daemon</span>
                <span className="text-[10px] text-[var(--text-muted)]">Start voice analysis on keyword trigger</span>
              </div>
              <input
                type="checkbox"
                checked={config.wake_word_enabled}
                onChange={(e) => handleSaveConfig({ ...config, wake_word_enabled: e.target.checked })}
                className="w-4 h-4 text-[var(--accent)] rounded cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-muted)]">Sensitivity Threshold</span>
                <span className="text-[var(--accent)] font-semibold">{Math.floor(config.wake_word_sensitivity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={config.wake_word_sensitivity}
                onChange={(e) => handleSaveConfig({ ...config, wake_word_sensitivity: parseFloat(e.target.value) })}
                className="w-full h-1 bg-[var(--border-default)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. TTS speech synthesizer playground & Transcripts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* TTS Simulator */}
        <div className="bg-[var(--bg-glass-heavy)] border border-[var(--border-default)] rounded-xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Play size={16} className="text-[var(--accent)]" />
            Speech Synthesizer Playground
          </h3>
          <div className="space-y-3">
            <textarea
              value={ttsTextInput}
              onChange={(e) => setTtsTextInput(e.target.value)}
              placeholder="Type phrase here and click Speak to test audio outputs..."
              className="w-full h-24 bg-[var(--bg-glass-heavy)] border border-[var(--border-default)] rounded-lg p-3 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
            />
            <button
              onClick={handleSpeakText}
              disabled={isPlayingTts || !ttsTextInput.trim()}
              className="w-full flex items-center justify-center gap-2 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
            >
              {isPlayingTts ? <Square size={13} className="animate-spin" /> : <Play size={13} />}
              Speak text aloud
            </button>
          </div>
        </div>

        {/* Live transcripts */}
        <div className="bg-[var(--bg-glass-heavy)] border border-[var(--border-default)] rounded-xl p-5 shadow-xl flex flex-col h-60">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <Activity size={16} className="text-[var(--accent)]" />
            Live Transcription History
          </h3>
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-2">
            {transcriptHistory.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center text-xs text-[var(--text-muted)] select-none">
                No active audio transcription history yet. Say "Hey BYTE" to trigger.
              </div>
            ) : (
              transcriptHistory.map((line, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-[var(--bg-glass-light)] border border-[var(--border-default)] rounded-lg text-xs text-[var(--text-secondary)] leading-relaxed"
                >
                  <div className="text-[9px] uppercase font-bold text-[var(--text-muted)] mb-1">Speaker Query</div>
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export default VoiceDashboard;
