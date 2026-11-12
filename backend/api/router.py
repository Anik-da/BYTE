from fastapi import APIRouter, HTTPException, File, UploadFile, BackgroundTasks
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import asyncio
import os
import threading

from backend.ai.engine import ai_engine, ACTIVE_GROQ_MODELS, LEGACY_GROQ_MAP
from backend.ai.command_runner import process_user_prompt, get_voice_events_since
from backend.automation.engine import automation_engine
from backend.vision.engine import vision_engine
from backend.voice.engine import voice_engine
from backend.system.startup import (
    CREATE_NO_WINDOW,
    get_autostart_status,
    sync_windows_autostart,
    request_daemon_stop,
)
from backend.memory.db import (
    save_message,
    get_history,
    get_settings,
    set_setting,
    clear_conversation_history,
    auto_prune_conversation_history,
    delete_conversation_message,
    save_lifetime_fact,
    get_lifetime_facts,
    delete_lifetime_fact,
)
from backend.memory.mongo import mongo_storage

router = APIRouter()

class CommandRequest(BaseModel):
    prompt: str

class SettingsRequest(BaseModel):
    settings: Dict[str, Any]

class LifetimeFactRequest(BaseModel):
    key: str
    fact: str
    category: Optional[str] = "general"

class DownloadModelRequest(BaseModel):
    model_name: str

class ContinuousToggleRequest(BaseModel):
    paused: bool

class MuteRequest(BaseModel):
    muted: bool

class AutostartRequest(BaseModel):
    enabled: bool

@router.get("/health")
async def health_check():
    return {"status": "online", "service": "BYTE Backend Engine"}

def _format_size(size_val: Any) -> str:
    if isinstance(size_val, (int, float)) and size_val > 0:
        gb = size_val / (1024 ** 3)
        if gb >= 1.0:
            return f"{gb:.1f} GB"
        return f"{size_val / (1024 ** 2):.0f} MB"
    return str(size_val or "Local")

@router.get("/system/local_models")
async def get_local_models():
    """Lists locally installed Ollama models on the laptop."""
    import httpx, subprocess
    models = []
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            res = await client.get("http://127.0.0.1:11434/api/tags")
            if res.status_code == 200:
                data = res.json()
                for m in data.get("models", []):
                    models.append({"name": m.get("name"), "size": _format_size(m.get("size"))})
    except Exception:
        pass

    if not models:
        try:
            out = await asyncio.to_thread(
                subprocess.check_output,
                "ollama list",
                shell=True,
                text=True,
                timeout=4.0,
                creationflags=CREATE_NO_WINDOW,
            )
            lines = out.strip().splitlines()
            if len(lines) > 1:
                for line in lines[1:]:
                    parts = line.split()
                    if parts:
                        size_str = f"{parts[2]} {parts[3]}" if len(parts) > 3 else (parts[2] if len(parts) > 2 else "Local")
                        models.append({"name": parts[0], "size": size_str})
        except Exception:
            pass
    return {"status": "success", "models": models}

@router.get("/system/groq_models")
async def get_groq_models():
    """Lists active Groq Cloud chat models (falls back to verified current free-tier list)."""
    import httpx
    settings = get_settings()
    api_key = settings.get("groq_api_key") or os.environ.get("GROQ_API_KEY") or os.environ.get("VITE_GROQ_API_KEY") or ""
    if api_key:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(
                    "https://api.groq.com/openai/v1/models",
                    headers={"Authorization": f"Bearer {api_key}"},
                )
                if res.status_code == 200:
                    excluded_tokens = ("whisper", "orpheus", "guard", "safeguard", "tts")
                    live_models = []
                    for m in sorted(res.json().get("data", []), key=lambda x: x.get("id", "")):
                        mid = m.get("id", "")
                        if not mid or not m.get("active", True):
                            continue
                        if any(tok in mid.lower() for tok in excluded_tokens):
                            continue
                        ctx = m.get("context_window")
                        ctx_label = f"{ctx // 1000}k" if isinstance(ctx, int) and ctx >= 1000 else str(ctx or "")
                        label = f"{mid} ({ctx_label} Context)" if ctx_label else mid
                        live_models.append({"id": mid, "label": label, "owned_by": m.get("owned_by", "Groq")})
                    if live_models:
                        return {"status": "success", "models": live_models}
        except Exception:
            pass
    return {"status": "success", "models": ACTIVE_GROQ_MODELS}

@router.post("/system/download_model")
async def download_local_model(req: DownloadModelRequest):
    """Triggers downloading a local AI model to run 100% locally on the user's laptop."""
    import subprocess
    model = req.model_name.strip()
    if not model:
        raise HTTPException(status_code=400, detail="Model name required")

    try:
        print(f"[BYTE Model Downloader] Pulling local AI model '{model}'...")
        subprocess.Popen(
            ["ollama", "pull", model],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=CREATE_NO_WINDOW,
        )
        return {"status": "started", "message": f"Downloading local AI model '{model}' to your laptop in background."}
    except Exception as e:
        return {"status": "error", "message": f"Failed to start download for '{model}': {e}"}

@router.get("/system_status")
def get_system_status():
    telemetry = dict(automation_engine.get_system_telemetry())
    telemetry["voice_status"] = voice_engine.get_status()
    return telemetry

@router.get("/system/check_github_update")
def check_github_update():
    return automation_engine.check_github_update()

@router.post("/system/apply_github_update")
def apply_github_update():
    return automation_engine.apply_github_update()

@router.get("/vision/analyze")
def analyze_screen_vision():
    return vision_engine.analyze_screen()

@router.post("/voice/transcribe")
async def transcribe_voice(file: UploadFile = File(...)):
    contents = await file.read()
    text = await voice_engine.transcribe_audio_file(contents, filename=file.filename or "audio.webm")
    return {"status": "success", "transcript": text}

@router.post("/process_command")
async def process_command(req: CommandRequest, background_tasks: BackgroundTasks):
    prompt = req.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Empty prompt")
    return await process_user_prompt(
        prompt,
        source="ui",
        spoken_by_backend=False,
        background_tasks=background_tasks,
    )

@router.get("/voice/devices")
async def get_voice_devices():
    return voice_engine.get_audio_devices()

@router.post("/voice/calibrate")
async def calibrate_voice():
    return voice_engine.calibrate_microphone()

@router.post("/voice/stop")
async def stop_voice_output():
    return voice_engine.stop_speaking()

@router.get("/voice/status")
async def get_voice_status():
    return voice_engine.get_status()

@router.post("/voice/arm")
async def arm_voice_listening(announce: bool = False):
    return voice_engine.arm_listening(duration_sec=15.0, announce=announce)

@router.post("/voice/disarm")
async def disarm_voice_listening():
    return voice_engine.disarm_or_flush()

@router.post("/voice/continuous")
async def toggle_continuous_voice(req: ContinuousToggleRequest):
    if not req.paused:
        set_setting("wake_word_enabled", True)
        voice_engine.refresh_settings()
        voice_engine.start_continuous_listener()
    voice_engine.set_paused(req.paused)
    return voice_engine.get_status()

@router.post("/voice/mute")
async def set_voice_mute(req: MuteRequest):
    set_setting("voice_muted", bool(req.muted))
    voice_engine.set_muted(bool(req.muted))
    return voice_engine.get_status()

@router.get("/voice/events")
async def fetch_voice_events(since: int = 0):
    return get_voice_events_since(since)

@router.get("/system/autostart")
async def fetch_autostart_status():
    settings = get_settings()
    status = await asyncio.to_thread(get_autostart_status)
    status["auto_launch_setting"] = bool(settings.get("auto_launch", False))
    return status

@router.post("/system/autostart")
async def configure_autostart(req: AutostartRequest):
    set_setting("auto_launch", bool(req.enabled))
    return await asyncio.to_thread(sync_windows_autostart, bool(req.enabled))

@router.post("/system/shutdown")
async def shutdown_daemon():
    """Cleanly stops the 24/7 backend supervisor and uvicorn worker when requested from Tray."""
    request_daemon_stop()
    voice_engine.stop_continuous_listener()

    def _delayed_exit():
        import time
        time.sleep(0.35)
        os._exit(0)

    threading.Thread(target=_delayed_exit, daemon=True).start()
    return {"status": "stopping", "message": "BYTE 24/7 engine shutting down cleanly."}

@router.get("/memory/history")
async def fetch_history(limit: int = 50):
    return get_history(limit=limit)

@router.delete("/memory/clear")
async def clear_history():
    """Clears non-required conversation logs from database while preserving lifetime memory."""
    deleted_count = clear_conversation_history()
    mongo_storage.clear_logs()
    return {
        "status": "success",
        "message": f"Cleared {deleted_count} conversation logs. Permanent lifetime memory preserved.",
        "deleted_count": deleted_count
    }

@router.delete("/memory/history/{msg_id}")
async def delete_history_message(msg_id: int):
    success = delete_conversation_message(msg_id)
    if not success:
        raise HTTPException(status_code=404, detail="Message ID not found")
    return {"status": "success", "message": f"Deleted conversation message {msg_id}"}

@router.get("/memory/lifetime")
async def fetch_lifetime_facts():
    return get_lifetime_facts()

@router.post("/memory/lifetime")
async def add_lifetime_fact(req: LifetimeFactRequest, background_tasks: BackgroundTasks):
    save_lifetime_fact(req.key, req.fact, req.category or "general")
    background_tasks.add_task(mongo_storage.save_lifetime_fact, req.key, req.fact, req.category or "general")
    return {"status": "success", "key": req.key, "fact": req.fact}

@router.delete("/memory/lifetime/{key}")
async def remove_lifetime_fact(key: str, background_tasks: BackgroundTasks):
    delete_lifetime_fact(key)
    background_tasks.add_task(mongo_storage.delete_lifetime_fact, key)
    return {"status": "success", "message": f"Removed lifetime fact '{key}'"}

@router.get("/settings")
async def fetch_settings():
    return get_settings()

@router.post("/settings")
async def update_settings(req: SettingsRequest):
    for k, v in req.settings.items():
        set_setting(k, v)

    updated = get_settings()
    voice_engine.refresh_settings(updated)

    if "wake_word_enabled" in req.settings:
        if req.settings["wake_word_enabled"]:
            voice_engine.start_continuous_listener()
        else:
            await asyncio.to_thread(voice_engine.stop_continuous_listener)

    if "voice_muted" in req.settings:
        voice_engine.set_muted(bool(req.settings["voice_muted"]))

    autostart_status = None
    if "auto_launch" in req.settings:
        autostart_status = await asyncio.to_thread(sync_windows_autostart, bool(req.settings["auto_launch"]))
    else:
        autostart_status = await asyncio.to_thread(get_autostart_status)

    return {"status": "success", "settings": updated, "autostart": autostart_status}
