import asyncio
import threading
import time
from collections import deque
from typing import Dict, Any, List, Optional

from backend.ai.engine import ai_engine
from backend.automation.engine import automation_engine
from backend.vision.engine import vision_engine
from backend.memory.db import (
    save_message,
    get_settings,
    auto_prune_conversation_history,
)
from backend.memory.mongo import mongo_storage

_automation_lock = threading.Lock()
_event_lock = threading.Lock()
_voice_events: deque = deque(maxlen=120)
_event_seq = 0


def record_voice_event(
    role: str,
    text: str,
    intent: Optional[str] = None,
    source: str = "voice",
    spoken_by_backend: bool = True,
) -> Dict[str, Any]:
    """Appends a live voice interaction event for Mission Control UI synchronization."""
    global _event_seq
    with _event_lock:
        _event_seq += 1
        evt = {
            "seq": _event_seq,
            "id": f"voice_{_event_seq}_{int(time.time() * 1000)}",
            "role": role,
            "text": text,
            "intent": intent,
            "source": source,
            "spoken_by_backend": spoken_by_backend,
            "timestamp": time.time(),
        }
        _voice_events.append(evt)
        return evt


def get_current_event_seq() -> int:
    with _event_lock:
        return _event_seq


def get_voice_events_since(since_seq: int = 0) -> Dict[str, Any]:
    with _event_lock:
        events = [e for e in _voice_events if e["seq"] > since_seq]
        return {"seq": _event_seq, "events": events}


def _run_blocking_automation(intent: str, target: str, intent_data: Dict[str, Any]) -> Dict[str, Any]:
    with _automation_lock:
        if intent == "vision_analyze_screen":
            return vision_engine.analyze_screen()
        return automation_engine.execute_action(intent=intent, target=target, data=intent_data)


def _persist_mongo(role: str, content: str, intent: Optional[str]) -> None:
    try:
        mongo_storage.save_log(role=role, content=content, intent=intent)
        mongo_storage.prune_logs(max_keep=30)
    except Exception:
        pass


async def process_user_prompt(
    prompt: str,
    source: str = "ui",
    spoken_by_backend: bool = False,
    background_tasks: Any = None,
) -> Dict[str, Any]:
    """
    Unified command execution pipeline shared by UI HTTP requests and 24/7 voice wake-word daemon.
    """
    clean_prompt = prompt.strip()
    intent_data = ai_engine.classify_intent(clean_prompt)
    intent = intent_data["intent"]
    target = intent_data["target"]

    save_message(role="user", content=clean_prompt, intent=intent)
    if source == "voice":
        record_voice_event("user", clean_prompt, intent=intent, source="voice", spoken_by_backend=False)

    if background_tasks is not None:
        background_tasks.add_task(mongo_storage.save_log, role="user", content=clean_prompt, intent=intent)
    else:
        threading.Thread(target=mongo_storage.save_log, kwargs={"role": "user", "content": clean_prompt, "intent": intent}, daemon=True).start()

    action_result = None
    response_text = ""

    automation_intents = {
        "vision_analyze_screen",
        "open_application",
        "in_app_action",
        "play_media",
        "open_website",
        "system_command",
        "file_search",
        "kill_process",
        "auto_reply_friend",
        "check_incoming_messages",
        "add_friend",
    }

    if intent in automation_intents:
        action_result = await asyncio.to_thread(_run_blocking_automation, intent, target, intent_data)
        default_msg = "Screen analysis complete." if intent == "vision_analyze_screen" else "Task executed."
        response_text = action_result.get("message", default_msg)
    else:
        current_settings = get_settings()
        response_text = await ai_engine.generate_llm_response(clean_prompt, current_settings)

    save_message(
        role="byte",
        content=response_text,
        intent=intent,
        action_executed=str(action_result) if action_result else None,
    )
    if source == "voice":
        record_voice_event(
            "byte",
            response_text,
            intent=intent,
            source="voice",
            spoken_by_backend=spoken_by_backend,
        )

    auto_prune_conversation_history(max_keep=30)
    if background_tasks is not None:
        background_tasks.add_task(mongo_storage.save_log, role="byte", content=response_text, intent=intent)
        background_tasks.add_task(mongo_storage.prune_logs, max_keep=30)
    else:
        threading.Thread(target=_persist_mongo, args=("byte", response_text, intent), daemon=True).start()

    return {
        "intent": intent_data,
        "action_result": action_result,
        "response": response_text,
    }

