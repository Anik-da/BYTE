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

export interface UseSpeechOptions {
  onSpeechCommand?: (text: string) => void;
  autoStart?: boolean;
}

export function useSpeech(options?: UseSpeechOptions): SpeechHook {
  const autoStart = options?.autoStart ?? false;
  const onSpeechCommandRef = useRef(options?.onSpeechCommand);
  useEffect(() => {
    onSpeechCommandRef.current = options?.onSpeechCommand;
  }, [options?.onSpeechCommand]);

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
    };

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) finalText += res[0].transcript + ' ';
        else interimText += res[0].transcript;
      }
      if (finalText) {
        const text = (finalTranscriptRef.current + ' ' + finalText).trim();
        finalTranscriptRef.current = text;
        setTranscript(text);
        if (text) {
          onSpeechCommandRef.current?.(text);
        }
      }
      setInterim(interimText);
    };

    rec.onerror = (event: Event) => {
      const e = event as unknown as { error?: string };
      if (e.error === 'no-speech' || e.error === 'network' || e.error === 'service-not-allowed') {
        // Suppress browser WebSpeech network errors; backend MediaRecorder + Whisper handles transcription natively
        console.warn(`[SpeechRecognition] WebSpeech API error '${e.error}'. Using backend Whisper recorder.`);
      } else if (e.error === 'not-allowed') {
        setError('Microphone access denied.');
      } else if (e.error === 'aborted') {
        // user-initiated, ignore
      } else {
        setError(e.error ? `Recognition error: ${e.error}` : 'Recognition error.');
      }
    };

    rec.onend = () => {
      setInterim('');
      if (finalTranscriptRef.current.trim()) {
        const text = finalTranscriptRef.current.trim();
        onSpeechCommandRef.current?.(text);
        finalTranscriptRef.current = '';
      }

      // Auto-restart for continuous hands-free wake word listening (no 6s auto-shutoff)
      if (!manualStopRef.current) {
        setTimeout(() => {
          if (!manualStopRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {}
          }
        }, 400);
      } else {
        setListening(false);
      }
    };

    recognitionRef.current = rec;
    return rec;
  }, []);

  // Optional browser speech recognition loop (disabled when 24/7 backend wake-word daemon handles mic)
  useEffect(() => {
    if (!autoStart) return;
    manualStopRef.current = false;
    const rec = ensureRecognition();
    if (rec) {
      try {
        rec.start();
      } catch (e) {}
    }
  }, [autoStart, ensureRecognition]);

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

        let mimeType = '';
        if (typeof MediaRecorder !== 'undefined') {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
          else if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
          else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
          else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
          else if (MediaRecorder.isTypeSupported('audio/wav')) mimeType = 'audio/wav';
        }

        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        recorder.start(200);
        mediaRecorderRef.current = recorder;
        setListening(true);
      }
    } catch (err) {
      console.warn("Microphone access error:", err);
      setError("Microphone permission denied or device busy.");
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

    // Stop MediaRecorder cleanly using onstop event and transcribe via backend AI
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = async () => {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        }
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          if (!finalTranscriptRef.current.trim() && blob.size > 100) {
            try {
              const formData = new FormData();
              formData.append('file', blob, 'recording.webm');
              const res = await fetch('http://127.0.0.1:8000/api/voice/transcribe', {
                method: 'POST',
                body: formData,
              });
              const data = await res.json();
              if (data.transcript && data.transcript.trim()) {
                const text = data.transcript.trim();
                finalTranscriptRef.current = text;
                setTranscript(text);
                onSpeechCommandRef.current?.(text);
              } else {
                setError('No speech detected. Check your microphone and try again.');
              }
            } catch (err) {
              console.warn('Backend transcription fallback error:', err);
              setError('Voice transcription failed. Verify backend is online.');
            }
          }
        }
      };
      recorder.stop();
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
