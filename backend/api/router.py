from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional, List

from backend.ai.engine import ai_engine
from backend.automation.engine import automation_engine
from backend.vision.engine import vision_engine
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

from backend.voice.engine import voice_engine

router = APIRouter()

class CommandRequest(BaseModel):
    prompt: str

class SettingsRequest(BaseModel):
    settings: Dict[str, Any]

class LifetimeFactRequest(BaseModel):
    key: str
    fact: str
    category: Optional[str] = "general"

@router.get("/health")
async def health_check():
    return {"status": "online", "service": "BYTE Backend Engine"}

@router.get("/system_status")
async def get_system_status():
    return automation_engine.get_system_telemetry()

@router.get("/vision/analyze")
async def analyze_screen_vision():
    return vision_engine.analyze_screen()

@router.post("/process_command")
async def process_command(req: CommandRequest):
    prompt = req.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Empty prompt")

    # 1. Classify intent
    intent_data = ai_engine.classify_intent(prompt)
    intent = intent_data["intent"]
    target = intent_data["target"]

    # 2. Save user message to SQLite & MongoDB Atlas
    save_message(role="user", content=prompt, intent=intent)
    mongo_storage.save_log(role="user", content=prompt, intent=intent)

    action_result = None
    response_text = ""

    # 3. Execute automation / vision if intent matches
    if intent == "vision_analyze_screen":
        action_result = vision_engine.analyze_screen()
        response_text = action_result.get("message", "Screen analysis complete.")
    elif intent in ["open_application", "play_media", "open_website", "system_command", "file_search", "kill_process"]:
        action_result = automation_engine.execute_action(intent=intent, target=target)
        response_text = action_result.get("message", "Task executed.")
    else:
        # Generate LLM response
        current_settings = get_settings()
        response_text = await ai_engine.generate_llm_response(prompt, current_settings)

    # 4. Save assistant response to SQLite & MongoDB Atlas
    save_message(role="byte", content=response_text, intent=intent, action_executed=str(action_result) if action_result else None)
    mongo_storage.save_log(role="byte", content=response_text, intent=intent)

    # 5. Automatically prune non-required old conversation history, leaving lifetime facts permanent
    auto_prune_conversation_history(max_keep=30)
    mongo_storage.prune_logs(max_keep=30)

    return {
        "intent": intent_data,
        "action_result": action_result,
        "response": response_text
    }

@router.get("/voice/devices")
async def get_voice_devices():
    return voice_engine.get_audio_devices()

@router.post("/voice/calibrate")
async def calibrate_voice():
    return voice_engine.calibrate_microphone()

@router.post("/voice/stop")
async def stop_voice_output():
    return voice_engine.stop_speaking()

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
async def add_lifetime_fact(req: LifetimeFactRequest):
    save_lifetime_fact(req.key, req.fact, req.category or "general")
    mongo_storage.save_lifetime_fact(req.key, req.fact, req.category or "general")
    return {"status": "success", "key": req.key, "fact": req.fact}

@router.delete("/memory/lifetime/{key}")
async def remove_lifetime_fact(key: str):
    delete_lifetime_fact(key)
    mongo_storage.delete_lifetime_fact(key)
    return {"status": "success", "message": f"Removed lifetime fact '{key}'"}

@router.get("/settings")
async def fetch_settings():
    return get_settings()

@router.post("/settings")
async def update_settings(req: SettingsRequest):
    for k, v in req.settings.items():
        set_setting(k, v)
    return {"status": "success", "settings": get_settings()}
