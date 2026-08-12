import { useCallback, useEffect, useRef, useState } from 'react';

// Minimal type declarations for the Web Speech API (not in lib.dom by default)
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionStatic {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionStatic;
    webkitSpeechRecognition?: SpeechRecognitionStatic;
  }
}

export interface SpeechHook {
  supported: boolean;
  listening: boolean;
  transcript: string;
  interim: string;
  speaking: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  speak: (text: string, onEnd?: () => void) => void;
  cancelSpeech: () => void;
  setVoice: (v: SpeechSynthesisVoice) => void;
  voices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
}

export function useSpeech(): SpeechHook {
  const [supported] = useState(() =>
    typeof window !== 'undefined' &&
    (('SpeechRecognition' in window) ||
     ('webkitSpeechRecognition' in window) ||
     (!!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia)),
  );
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const manualStopRef = useRef(false);
  const finalTranscriptRef = useRef('');
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    // Turn OFF microphone if no speech/command detected within 6 seconds of silence
    silenceTimerRef.current = setTimeout(() => {
      manualStopRef.current = true;
      setListening(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    }, 6000);
  }, []);

  // Initialize recognition lazily
  const ensureRecognition = useCallback(() => {
    if (recognitionRef.current) return recognitionRef.current;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return null;
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setListening(true);
      setError(null);
      resetSilenceTimer();
    };

    rec.onresult = (event: SpeechRecognitionEvent) => {
      resetSilenceTimer();
      let interimText = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) finalText += res[0].transcript + ' ';
        else interimText += res[0].transcript;
      }
      if (finalText) {
        finalTranscriptRef.current = (finalTranscriptRef.current + ' ' + finalText).trim();
        setTranscript(finalTranscriptRef.current);
      }
      setInterim(interimText);
    };

    rec.onerror = (event: Event) => {
      const e = event as unknown as { error?: string };
      if (e.error === 'no-speech') {
        // Continuous mode no-speech is normal
      } else if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Microphone access denied.');
      } else if (e.error === 'aborted') {
        // user-initiated, ignore
      } else {
        setError(e.error ? `Recognition error: ${e.error}` : 'Recognition error.');
      }
    };

    rec.onend = () => {
      setListening(false);
      setInterim('');
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };

    recognitionRef.current = rec;
    return rec;
  }, [resetSilenceTimer]);

  // Auto-initialize background voice listener on mount
  useEffect(() => {
    const rec = ensureRecognition();
    if (rec) {
      try {
        rec.start();
      } catch {
        // Ignore if already active
      }
    }
  }, [ensureRecognition]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const startListening = useCallback(async () => {
    finalTranscriptRef.current = '';
    setTranscript('');
    setInterim('');
    setError(null);
    manualStopRef.current = false;
    audioChunksRef.current = [];

    // Cancel speech output
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setSpeaking(false);

    // 1. Start MediaRecorder for guaranteed backend AI Whisper transcription
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
        const recorder = new MediaRecorder(stream, { mimeType });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        recorder.start(200);
        mediaRecorderRef.current = recorder;
        setListening(true);
      }
    } catch (err) {
      console.warn("Microphone access error:", err);
      setError("Microphone permission denied.");
    }

    // 2. Try WebSpeech API parallel recognition
    const rec = ensureRecognition();
    if (rec) {
      try {
        rec.start();
      } catch (e) {
        // Recognition already active
      }
    }
  }, [ensureRecognition]);

  const stopListening = useCallback(async () => {
    manualStopRef.current = true;
    setListening(false);

    // Stop WebSpeech
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }

    // Stop MediaRecorder and transcribe via backend AI if needed
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setTimeout(async () => {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        }
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          if (!finalTranscriptRef.current.trim() && blob.size > 1000) {
            try {
              const formData = new FormData();
              formData.append('file', blob, 'recording.webm');
              const res = await fetch('http://127.0.0.1:8000/api/voice/transcribe', {
                method: 'POST',
                body: formData,
              });
              const data = await res.json();
              if (data.transcript && data.transcript.trim()) {
                finalTranscriptRef.current = data.transcript.trim();
                setTranscript(data.transcript.trim());
              }
            } catch (err) {
              console.warn("Backend transcription fallback error:", err);
            }
          }
        }
      }, 300);
    }
  }, []);

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        onEnd?.();
        return;
      }
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1;
      utter.pitch = 0.9;
      utter.volume = 1;
      if (selectedVoice) utter.voice = selectedVoice;
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => {
        setSpeaking(false);
        onEnd?.();
      };
      utter.onerror = () => {
        setSpeaking(false);
        onEnd?.();
      };
      window.speechSynthesis.speak(utter);
    },
    [selectedVoice],
  );

  const cancelSpeech = useCallback(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const setVoice = useCallback((v: SpeechSynthesisVoice) => {
    setSelectedVoice(v);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  return {
    supported,
    listening,
    transcript,
    interim,
    speaking,
    error,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
    setVoice,
    voices,
    selectedVoice,
  };
}
