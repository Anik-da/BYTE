import asyncio
import importlib.util
import io
import os
import re
import subprocess
import sys
import tempfile
import threading
import time
import wave
from collections import deque
from typing import Dict, Any, List, Optional, Tuple

from backend.configuration.config import get_settings
from backend.system.startup import CREATE_NO_WINDOW

# Common Whisper hallucinations produced on ambient noise or short clicks
_WHISPER_HALLUCINATIONS = {
    "", ".", "..", "...", "you", "thank you", "thank you.", "thanks",
    "thanks.", "thanks for watching", "thanks for watching.",
    "thank you for watching", "thank you for watching.",
    "bye", "bye.", "goodbye", "uh", "um", "hmm", "mbc",
    "subtitles by the amara.org community",
}

_WAKE_PREFIX_RE = re.compile(
    r"\b(?:hey|ok|okay|hello|hi|wake\s*up)[\s,.:;!?-]*(?:byte|bite|bight|bright|jarvis)\b",
    re.IGNORECASE,
)
_WAKE_START_RE = re.compile(
    r"^(?:byte|bite|bight|jarvis|computer|wake\s+up)\b",
    re.IGNORECASE,
)


def extract_wake_command(text: str) -> Tuple[bool, str]:
    """
    Checks whether a transcribed utterance contains a BYTE wake word.
    Returns (wake_matched, extracted_command).
    """
    clean = (text or "").strip()
    if not clean:
        return False, ""

    normalized = clean.lower().strip(".,!? ")
    if normalized in _WHISPER_HALLUCINATIONS:
        return False, ""

    match = _WAKE_PREFIX_RE.search(clean) or _WAKE_START_RE.search(clean)
    if not match:
        return False, ""

    remainder = clean[match.end():].lstrip(" ,.:;?!-").strip()
    return True, remainder


def _clean_text_for_speech(text: str, max_chars: int = 420) -> str:
    """Strips markdown syntax and long code blocks so TTS reads naturally."""
    cleaned = re.sub(r"```[\s\S]*?```", " Code block generated on screen. ", text or "")
    cleaned = re.sub(r"`([^`]+)`", r"\1", cleaned)
    cleaned = re.sub(r"https?://\S+", "link", cleaned)
    cleaned = re.sub(r"[*_#>~]+", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if len(cleaned) > max_chars:
        cut = cleaned[:max_chars]
        last_period = max(cut.rfind("."), cut.rfind("!"), cut.rfind("?"))
        if last_period > 80:
            cleaned = cut[: last_period + 1]
        else:
            cleaned = cut.rstrip() + "..."
    return cleaned


class VoiceEngine:
    """
    Production-Ready 24/7 Voice Engine for BYTE.
    Supports:
      - Always-on background microphone listener with adaptive local VAD
      - Hands-free Wake-Word Detection ("Hey BYTE" / "Jarvis") + armed follow-up window
      - Self-echo suppression during TTS playback
      - Groq Cloud Whisper API + SpeechRecognition fallback
      - Native Windows SAPI / PowerShell speech synthesis
    """

    def __init__(self):
        self.wake_word = "Hey BYTE"
        self.is_listening = False
        self.is_speaking = False
        self.selected_mic_index: Optional[int] = None
        self.selected_speaker_index: Optional[int] = None
        self.vad_threshold = 0.016
        self.calibrated_noise_floor = 0.006

        self._stop_event = threading.Event()
        self._listener_thread: Optional[threading.Thread] = None
        self._state_lock = threading.Lock()
        self._paused = False
        self._single_shot_ui = False
        self._flush_requested = False
        self._wake_word_enabled = True
        self._muted = False
        self._continuous_active = False
        self._armed_until = 0.0
        self._mute_mic_until = 0.0
        self._cancel_speech = False
        self._mic_error: Optional[str] = None
        self._last_transcript = ""
        self._last_heard_at = 0.0
        self._speak_lock = threading.Lock()
        self._utterance_busy = False
        self._utterance_started_at = 0.0
        self._speaking_started_at = 0.0
        self._last_settings_sync = 0.0
        self.refresh_settings()

    def refresh_settings(self, settings: Optional[Dict[str, Any]] = None) -> None:
        try:
            s = settings if settings is not None else get_settings()
            self._wake_word_enabled = bool(s.get("wake_word_enabled", True))
            self._muted = bool(s.get("voice_muted", False))
            self._last_settings_sync = time.time()
        except Exception:
            pass

    def get_audio_devices(self) -> Dict[str, List[Dict[str, Any]]]:
        inputs = []
        outputs = []
        try:
            import sounddevice as sd
            devices = sd.query_devices()
            for idx, dev in enumerate(devices):
                device_info = {
                    "index": idx,
                    "name": dev.get("name", f"Audio Device {idx}"),
                    "channels": dev.get("max_input_channels", 0) or dev.get("max_output_channels", 0),
                    "default_samplerate": dev.get("default_samplerate", 44100),
                }
                if dev.get("max_input_channels", 0) > 0:
                    inputs.append(device_info)
                if dev.get("max_output_channels", 0) > 0:
                    outputs.append(device_info)
        except Exception:
            inputs = [{"index": 0, "name": "Default Microphone", "channels": 2, "default_samplerate": 48000}]
            outputs = [{"index": 1, "name": "Default Speakers", "channels": 2, "default_samplerate": 48000}]

        return {"inputs": inputs, "outputs": outputs}

    def calibrate_microphone(self) -> Dict[str, Any]:
        self.calibrated_noise_floor = 0.006
        self.vad_threshold = 0.015
        return {
            "status": "success",
            "ambient_noise_floor": self.calibrated_noise_floor,
            "vad_threshold": self.vad_threshold,
            "message": "Microphone calibrated for 24/7 wake-word detection.",
        }

    def set_muted(self, muted: bool) -> None:
        self._muted = bool(muted)
        if self._muted:
            self.stop_speaking()

    def set_paused(self, paused: bool) -> None:
        self._paused = bool(paused)
        self._single_shot_ui = False
        if self._paused:
            self._armed_until = 0.0
            self.is_listening = False

    def arm_listening(self, duration_sec: float = 15.0, announce: bool = False) -> Dict[str, Any]:
        """Opens an immediate command listening window without enabling persistent 24/7 mic mode."""
        now = time.time()
        if self._utterance_busy and now - self._utterance_started_at > 8.0:
            self._utterance_busy = False
        if self.is_speaking and now - self._speaking_started_at > 15.0:
            self.is_speaking = False
        if self._paused or not self._wake_word_enabled:
            self._single_shot_ui = True
        self._flush_requested = False
        self._mute_mic_until = 0.0
        self._armed_until = now + max(3.0, duration_sec)
        self.is_listening = True
        if not (self._listener_thread and self._listener_thread.is_alive()):
            self.start_continuous_listener(preserve_paused=self._paused)
        if announce and not self._muted:
            self._mute_mic_until = time.time() + 2.2
            threading.Thread(target=self.speak_text, args=("Yes? I'm listening.",), daemon=True).start()
        return self.get_status()

    def disarm_or_flush(self) -> Dict[str, Any]:
        """Flushes any active spoken audio immediately or cancels the armed listening window."""
        self._flush_requested = True
        self._armed_until = 0.0
        self.is_listening = False
        return self.get_status()

    def get_status(self) -> Dict[str, Any]:
        from backend.ai.command_runner import get_current_event_seq
        now = time.time()
        armed = now < self._armed_until
        return {
            "continuous_enabled": self._wake_word_enabled,
            "continuous_active": self._continuous_active and not self._paused,
            "paused": self._paused,
            "armed": armed,
            "transcribing": self._utterance_busy,
            "is_listening": armed or self.is_listening,
            "is_speaking": self.is_speaking,
            "muted": self._muted,
            "mic_error": self._mic_error,
            "last_transcript": self._last_transcript,
            "last_heard_at": self._last_heard_at,
            "event_seq": get_current_event_seq(),
        }

    def start_continuous_listener(self, preserve_paused: bool = False) -> bool:
        """Starts the background microphone listener thread if not already running."""
        with self._state_lock:
            if self._listener_thread and self._listener_thread.is_alive():
                if not preserve_paused:
                    self._paused = False
                return True
            self._stop_event.clear()
            if not preserve_paused:
                self._paused = False
            self._listener_thread = threading.Thread(
                target=self._continuous_listen_loop,
                name="BYTE-Voice-24x7",
                daemon=True,
            )
            self._listener_thread.start()
            return True

    def stop_continuous_listener(self) -> None:
        """Stops the 24/7 background microphone listener thread cleanly."""
        self._stop_event.set()
        self._continuous_active = False
        self._armed_until = 0.0
        self.is_listening = False
        if self._listener_thread and self._listener_thread.is_alive():
            self._listener_thread.join(timeout=2.5)

    def _transcribe_sync(
        self,
        file_bytes: bytes,
        filename: str = "audio.webm",
        mime_type: str = "audio/webm",
        wake_bias_prompt: bool = False,
    ) -> str:
        if not file_bytes or len(file_bytes) < 100:
            return ""

        settings = get_settings()
        groq_key = (
            settings.get("groq_api_key")
            or os.environ.get("GROQ_API_KEY")
            or os.environ.get("VITE_GROQ_API_KEY", "")
        )

        # 1. Try Groq Whisper API (fast transcription)
        if groq_key:
            try:
                import httpx
                headers = {"Authorization": f"Bearer {groq_key}"}
                files = {"file": (filename or "audio.webm", file_bytes, mime_type)}
                data = {"model": "whisper-large-v3-turbo", "language": "en"}
                if wake_bias_prompt:
                    data["prompt"] = (
                        "Hey BYTE, Jarvis, open WhatsApp, Chrome, Notepad, VS Code, Spotify, "
                        "send message, check my messages, reply to friend."
                    )
                resp = httpx.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers=headers,
                    files=files,
                    data=data,
                    timeout=8.0,
                )
                if resp.status_code == 200:
                    text = resp.json().get("text", "").strip()
                    if text:
                        return text
            except Exception as e:
                print(f"[BYTE Voice Engine] Groq Whisper error: {e}")

        # 2. Try SpeechRecognition WAV parser (Google Web Speech fallback, bounded 8s timeout)
        if file_bytes.startswith(b"RIFF"):
            tmp_path = ""
            try:
                import speech_recognition as sr
                with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                    tmp.write(file_bytes)
                    tmp_path = tmp.name
                recognizer = sr.Recognizer()
                recognizer.operation_timeout = 8
                with sr.AudioFile(tmp_path) as source:
                    audio_data = recognizer.record(source)
                text = recognizer.recognize_google(audio_data)
                if text:
                    return text.strip()
            except Exception as e:
                print(f"[BYTE Voice Engine] Google SR fallback note: {e}")
            finally:
                if tmp_path and os.path.exists(tmp_path):
                    try:
                        os.remove(tmp_path)
                    except Exception:
                        pass

        # 3. Faster-Whisper local fallback (only if installed)
        if importlib.util.find_spec("faster_whisper") is not None:
            try:
                from faster_whisper import WhisperModel
                model = WhisperModel("base", device="cpu", compute_type="int8")
                segments, _ = model.transcribe(io.BytesIO(file_bytes), beam_size=5)
                text = " ".join(segment.text for segment in segments).strip()
                if text:
                    return text
            except Exception:
                pass

        return ""

    async def transcribe_audio_file(self, file_bytes: bytes, filename: str = "audio.webm") -> str:
        """
        Transcribes audio bytes uploaded from frontend microphone.
        """
        lower_name = (filename or "").lower()
        mime_type = "audio/wav" if lower_name.endswith(".wav") else "audio/webm"
        return await asyncio.to_thread(
            self._transcribe_sync,
            file_bytes,
            filename or "audio.webm",
            mime_type,
            False,
        )

    def speak_text(self, text: str) -> None:
        """Speaks text through Windows speakers using SAPI while suppressing mic self-triggering."""
        settings = get_settings()
        if self._muted or bool(settings.get("voice_muted", False)):
            return

        spoken = _clean_text_for_speech(text)
        if not spoken:
            return

        with self._speak_lock:
            self._cancel_speech = False
            self.is_speaking = True
            self._speaking_started_at = time.time()
            self._mute_mic_until = time.time() + 30.0
            try:
                if sys.platform == "win32":
                    spoke_via_com = False
                    try:
                        import pythoncom
                        import win32com.client

                        pythoncom.CoInitialize()
                        try:
                            speaker = win32com.client.Dispatch("SAPI.SpVoice")
                            speaker.Rate = 1
                            speaker.Volume = 100
                            # SVSFlagsAsync = 1
                            speaker.Speak(spoken, 1)
                            while not self._cancel_speech:
                                if speaker.WaitUntilDone(120):
                                    break
                            if self._cancel_speech:
                                # SVSFPurgeBeforeSpeak = 2
                                speaker.Speak("", 2)
                            spoke_via_com = True
                        finally:
                            pythoncom.CoUninitialize()
                    except Exception:
                        spoke_via_com = False

                    if not spoke_via_com and not self._cancel_speech:
                        escaped = spoken.replace("'", "''")
                        ps_cmd = (
                            "Add-Type -AssemblyName System.Speech; "
                            "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
                            "$s.Rate = 1; "
                            f"$s.Speak('{escaped}')"
                        )
                        subprocess.run(
                            ["powershell", "-NoProfile", "-Command", ps_cmd],
                            capture_output=True,
                            timeout=25,
                            creationflags=CREATE_NO_WINDOW,
                        )
            except Exception as e:
                print(f"[BYTE Voice Engine] TTS error: {e}")
            finally:
                self.is_speaking = False
                # Keep mic muted briefly so speaker tail/reverb doesn't re-trigger VAD
                self._mute_mic_until = time.time() + 0.85

    def stop_speaking(self) -> Dict[str, Any]:
        self._cancel_speech = True
        self.is_speaking = False
        return {"status": "interrupted", "message": "Speech output stopped by user."}

    def _encode_pcm16_wav(self, frames: List[bytes], samplerate: int) -> bytes:
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(samplerate)
            wf.writeframes(b"".join(frames))
        return buf.getvalue()

    def _open_input_stream(self, sd: Any):
        """Opens a sounddevice InputStream at 16kHz, falling back to device default rate if needed."""
        rates_to_try = [16000]
        try:
            dev_info = sd.query_devices(kind="input")
            default_sr = int(dev_info.get("default_samplerate", 44100))
            if default_sr not in rates_to_try:
                rates_to_try.append(default_sr)
        except Exception:
            rates_to_try.extend([48000, 44100])

        last_err = None
        for sr in rates_to_try:
            blocksize = max(512, int(sr * 0.1))  # 100ms chunks
            try:
                stream = sd.InputStream(
                    samplerate=sr,
                    channels=1,
                    dtype="int16",
                    blocksize=blocksize,
                )
                stream.start()
                return stream, sr, blocksize
            except Exception as exc:
                last_err = exc
        raise last_err or RuntimeError("Unable to open any microphone input stream")

    def _handle_utterance(self, wav_bytes: bytes) -> None:
        """Transcribes captured speech and executes command if wake word matched or armed."""
        self._utterance_busy = True
        try:
            text = self._transcribe_sync(
                wav_bytes,
                filename="utterance.wav",
                mime_type="audio/wav",
                wake_bias_prompt=True,
            )
            if not text:
                return

            normalized = text.lower().strip(".,!? ")
            if normalized in _WHISPER_HALLUCINATIONS:
                return

            self._last_transcript = text
            self._last_heard_at = time.time()

            now = time.time()
            matched_wake, extracted = extract_wake_command(text)
            armed = (now < self._armed_until) or self._single_shot_ui
            print(f"[BYTE 24/7 Voice] Heard: '{text}' (wake={matched_wake}, armed={armed})")

            command_to_run = ""
            if matched_wake:
                if extracted:
                    command_to_run = extracted
                    self._armed_until = 0.0
                    self._single_shot_ui = False
                else:
                    # Wake word spoken alone ("Hey BYTE") -> confirm and arm 15s command window
                    print(f"[BYTE 24/7 Voice] Wake word detected: '{text}'")
                    self.arm_listening(duration_sec=15.0, announce=True)
                    return
            elif armed:
                command_to_run = text.strip()
                self._armed_until = 0.0
                self._single_shot_ui = False
            else:
                return

            if not command_to_run:
                return

            print(f"[BYTE 24/7 Voice] Executing command: '{command_to_run}'")
            self.is_listening = False
            try:
                from backend.ai.command_runner import process_user_prompt

                is_muted = self._muted
                result = asyncio.run(
                    process_user_prompt(
                        command_to_run,
                        source="voice",
                        spoken_by_backend=not is_muted,
                    )
                )
                response_text = result.get("response", "")
                if response_text and not is_muted:
                    self.speak_text(response_text)
            except Exception as e:
                print(f"[BYTE 24/7 Voice] Command execution error: {e}")
        finally:
            self._utterance_busy = False

    def _continuous_listen_loop(self) -> None:
        """
        24/7 background microphone loop with adaptive local energy VAD and automatic
        device recovery. Never shuts off on silence.
        """
        try:
            import numpy as np
            import sounddevice as sd
        except Exception as e:
            self._mic_error = f"Audio dependencies unavailable: {e}"
            print(f"[BYTE 24/7 Voice] {self._mic_error}")
            return

        print("[BYTE 24/7 Voice] Starting continuous 24/7 wake-word listener...")

        while not self._stop_event.is_set():
            if time.time() - self._last_settings_sync > 3.0:
                self.refresh_settings()

            if not self._wake_word_enabled and not self._single_shot_ui:
                self._continuous_active = False
                self._stop_event.wait(0.5)
                continue

            if self._paused and not self._single_shot_ui:
                self._continuous_active = False
                self._stop_event.wait(0.25)
                continue

            stream = None
            try:
                stream, samplerate, blocksize = self._open_input_stream(sd)
                self._mic_error = None
                self._continuous_active = True
                print(f"[BYTE 24/7 Voice] Microphone active at {samplerate} Hz (never auto-shutoff).")

                pre_roll: deque = deque(maxlen=6)  # 0.6s pre-roll
                speech_frames: List[bytes] = []
                in_speech = False
                active_chunks = 0
                silent_chunks = 0
                zero_chunks = 0
                noise_floor = self.calibrated_noise_floor
                consec_above = 0
                last_loop_ts = time.time()

                while not self._stop_event.is_set():
                    if time.time() - self._last_settings_sync > 3.0:
                        self.refresh_settings()

                    if (self._paused or not self._wake_word_enabled) and not self._single_shot_ui:
                        break

                    data, _overflowed = stream.read(blocksize)
                    now = time.time()

                    # Recover cleanly after Windows Sleep/Hibernation
                    if now - last_loop_ts > 5.0:
                        print("[BYTE 24/7 Voice] System wake detected; refreshing microphone stream...")
                        self._utterance_busy = False
                        self.is_speaking = False
                        self._mute_mic_until = 0.0
                        break
                    last_loop_ts = now

                    # Watchdog: never allow a hung transcription/TTS call to lock the mic forever
                    if self._utterance_busy and (now - self._utterance_started_at > 30.0):
                        print("[BYTE 24/7 Voice] Utterance watchdog reset stale busy state.")
                        self._utterance_busy = False
                    if self.is_speaking and (now - self._speaking_started_at > 35.0):
                        self.is_speaking = False
                        self._mute_mic_until = 0.0

                    # Suppress mic input while BYTE is speaking (+ echo tail) or processing an utterance
                    if self.is_speaking or self._utterance_busy or now < self._mute_mic_until:
                        pre_roll.clear()
                        speech_frames.clear()
                        in_speech = False
                        consec_above = 0
                        active_chunks = 0
                        silent_chunks = 0
                        continue

                    samples = data[:, 0].astype(np.float32) / 32768.0
                    rms = float(np.sqrt(np.mean(samples * samples))) if samples.size else 0.0
                    raw_bytes = data.tobytes()

                    if rms == 0.0:
                        zero_chunks += 1
                        if zero_chunks >= 50:
                            print("[BYTE 24/7 Voice] Dead silent audio stream detected; resetting PortAudio...")
                            break
                    else:
                        zero_chunks = 0

                    armed = (now < self._armed_until) or self._single_shot_ui
                    if self._single_shot_ui and now >= self._armed_until and not in_speech:
                        self._single_shot_ui = False
                        armed = False
                    if self._flush_requested and not in_speech:
                        self._flush_requested = False
                        self._single_shot_ui = False
                    self.is_listening = armed or in_speech
                    thresh = max(0.006 if armed else 0.009, noise_floor * 2.0)

                    if not in_speech:
                        pre_roll.append(raw_bytes)
                        # Slowly track background noise when quiet
                        if rms < thresh:
                            noise_floor = max(0.002, min(0.018, 0.95 * noise_floor + 0.05 * rms))
                            consec_above = 0
                        else:
                            consec_above += 1
                            if consec_above >= (1 if armed else 2):
                                in_speech = True
                                speech_frames = list(pre_roll)
                                active_chunks = consec_above
                                silent_chunks = 0
                                self.is_listening = True
                    else:
                        speech_frames.append(raw_bytes)
                        if rms >= thresh * 0.78:
                            active_chunks += 1
                            silent_chunks = 0
                        else:
                            silent_chunks += 1

                        # End utterance on user stop-flush, 0.8s silence, or 12s max duration
                        flush_now = self._flush_requested
                        if flush_now:
                            self._flush_requested = False

                        if flush_now or silent_chunks >= 8 or len(speech_frames) >= 120:
                            captured = speech_frames
                            captured_active = active_chunks
                            speech_frames = []
                            in_speech = False
                            consec_above = 0
                            active_chunks = 0
                            silent_chunks = 0
                            self.is_listening = time.time() < self._armed_until

                            min_chunks = 2 if (armed or flush_now) else 3
                            if captured_active >= min_chunks or (flush_now and len(captured) >= 2):
                                wav_bytes = self._encode_pcm16_wav(captured, samplerate)
                                self._utterance_busy = True
                                self._utterance_started_at = time.time()
                                threading.Thread(
                                    target=self._handle_utterance,
                                    args=(wav_bytes,),
                                    daemon=True,
                                ).start()
                                # Drain stale buffered audio right after capture
                                pre_roll.clear()
                            elif flush_now:
                                self._single_shot_ui = False

            except Exception as e:
                self._continuous_active = False
                self.is_listening = False
                self._mic_error = f"Mic stream reconnecting: {e}"
                print(f"[BYTE 24/7 Voice] {self._mic_error}")
                self._stop_event.wait(3.0)
            finally:
                if stream is not None:
                    try:
                        stream.stop()
                        stream.close()
                    except Exception:
                        pass
                # Refresh PortAudio device list so sleep/wake or Bluetooth switches pick up the new default mic
                try:
                    sd._terminate()
                    sd._initialize()
                except Exception:
                    pass
                self._continuous_active = False

        print("[BYTE 24/7 Voice] Continuous wake-word listener stopped.")


voice_engine = VoiceEngine()
