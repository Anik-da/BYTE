import os
import sys
import time
import subprocess

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.system.startup import (
    PROJECT_ROOT,
    CREATE_NO_WINDOW,
    load_env_file,
    ensure_headless_stdio,
    acquire_single_instance_mutex,
    is_backend_healthy,
    clear_daemon_stop,
    is_daemon_stop_requested,
    get_pythonw_executable,
)


def main():
    load_env_file()
    ensure_headless_stdio(os.path.join(PROJECT_ROOT, "backend_supervisor.log"))

    if is_backend_healthy():
        print("[BYTE Daemon] Backend already active on 127.0.0.1:8000. Supervisor exiting.")
        return

    if not acquire_single_instance_mutex(r"Local\BYTE_Supervisor_Mutex"):
        print("[BYTE Daemon] Another supervisor instance is already active. Exiting.")
        return

    clear_daemon_stop()
    backend_main = os.path.join(os.path.dirname(__file__), "main.py")
    py_executable = get_pythonw_executable()

    print(f"[BYTE Daemon] Launching BYTE 24/7 Persistent Engine using '{py_executable}'...")

    while True:
        if is_daemon_stop_requested():
            print("[BYTE Daemon] Graceful shutdown marker found. Stopping supervisor.")
            clear_daemon_stop()
            break
        try:
            if is_backend_healthy():
                time.sleep(5)
                continue
            proc = subprocess.Popen(
                [py_executable, backend_main, "--once"],
                creationflags=CREATE_NO_WINDOW,
            )
            proc.wait()
            if is_daemon_stop_requested():
                print("[BYTE Daemon] Stop requested by user. Supervisor exiting cleanly.")
                clear_daemon_stop()
                break
            print(f"[BYTE Daemon] Backend exited with code {proc.returncode}. Respawning in 2 seconds...")
        except KeyboardInterrupt:
            print("[BYTE Daemon] Shutdown requested by user.")
            break
        except Exception as e:
            print(f"[BYTE Daemon] Error running backend process: {e}. Retrying in 3 seconds...")
            time.sleep(3)
        time.sleep(2)


if __name__ == "__main__":
    main()
