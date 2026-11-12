import sys
import os
import time
import threading
from contextlib import asynccontextmanager

# Add root directory to sys.path so 'backend' module is recognized when running from any CWD
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.system.startup import (
    load_env_file,
    ensure_headless_stdio,
    acquire_single_instance_mutex,
    is_backend_healthy,
    clear_daemon_stop,
    is_daemon_stop_requested,
    get_autostart_status,
    sync_windows_autostart,
)

load_env_file()
ensure_headless_stdio()

# Fast-path guard when invoked directly as entrypoint so duplicate launches exit
# before importing heavy automation/audio/DB modules.
if __name__ == "__main__":
    if is_backend_healthy():
        print("[BYTE Backend] Backend is already online at 127.0.0.1:8000. Exiting duplicate.")
        sys.exit(0)
    if not acquire_single_instance_mutex(r"Local\BYTE_Backend_Engine_Mutex"):
        print("[BYTE Backend] Another backend instance already holds the lock. Exiting.")
        sys.exit(0)

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api.router import router as api_router
from backend.memory.db import init_db, get_settings
from backend.voice.engine import voice_engine


def _ensure_autostart_bg() -> None:
    try:
        status = get_autostart_status()
        if not status.get("task_registered"):
            sync_windows_autostart(True)
    except Exception as e:
        print(f"[BYTE Backend] Autostart check warning: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[BYTE Backend] Initializing local database and persistent storage...")
    init_db()
    settings = get_settings()
    voice_engine.set_muted(bool(settings.get("voice_muted", False)))

    if settings.get("wake_word_enabled", True):
        print("[BYTE Backend] Starting 24/7 continuous wake-word voice listener...")
        voice_engine.start_continuous_listener()

    if settings.get("auto_launch", False):
        threading.Thread(target=_ensure_autostart_bg, daemon=True).start()

    try:
        yield
    finally:
        print("[BYTE Backend] Shutting down automation engine services cleanly.")
        voice_engine.stop_continuous_listener()


app = FastAPI(title="BYTE Desktop Automation Engine", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


def _run_uvicorn():
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        reload=False,
        access_log=False,
        log_level="warning",
        use_colors=False,
    )


def run_server_forever():
    clear_daemon_stop()
    print("[BYTE Backend Supervisor] Starting continuous backend engine (24/7 mode)...")
    while True:
        if is_daemon_stop_requested():
            print("[BYTE Backend Supervisor] Stop requested. Exiting cleanly.")
            break
        try:
            _run_uvicorn()
        except KeyboardInterrupt:
            print("[BYTE Backend Supervisor] Keyboard interrupt received. Exiting.")
            break
        except SystemExit as e:
            if is_daemon_stop_requested() or is_backend_healthy():
                break
            print(f"[BYTE Backend Supervisor] Server exited ({e}). Restarting in 2 seconds...")
        except Exception as e:
            print(f"[BYTE Backend Supervisor] Server process encountered exception: {e}")
            print("[BYTE Backend Supervisor] Auto-restarting engine in 2 seconds...")
        if is_daemon_stop_requested():
            break
        time.sleep(2)


if __name__ == "__main__":
    if "--once" in sys.argv:
        clear_daemon_stop()
        _run_uvicorn()
    else:
        run_server_forever()
