import os
import sys
import json
import ctypes
import subprocess
import urllib.request
from logging.handlers import RotatingFileHandler
import logging
from typing import Dict, Any, Optional

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
LOG_PATH = os.path.join(PROJECT_ROOT, "backend_run.log")
STOP_MARKER_PATH = os.path.join(PROJECT_ROOT, "backend", "database", ".stop_daemon")
TASK_NAME = "BYTE_Backend_24x7"
REG_RUN_PATH = r"Software\Microsoft\Windows\CurrentVersion\Run"
REG_VALUE_NAME = "BYTE Assistant"
CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0

_MUTEX_HANDLES: Dict[str, Any] = {}


def load_env_file() -> None:
    """Loads key=value pairs from .env at project root into os.environ if unset."""
    env_path = os.path.join(PROJECT_ROOT, ".env")
    if not os.path.exists(env_path):
        return
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for raw_line in f:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                if key:
                    os.environ.setdefault(key, val)
    except Exception:
        pass


class _RotatingLogStream:
    """Minimal file-like stream backed by RotatingFileHandler for headless pythonw.exe runs."""

    encoding = "utf-8"
    errors = "replace"

    def __init__(self, log_path: str = LOG_PATH, max_bytes: int = 4 * 1024 * 1024, backup_count: int = 2):
        os.makedirs(os.path.dirname(log_path), exist_ok=True)
        self._logger = logging.getLogger(f"byte.stdio.{os.path.basename(log_path)}")
        self._logger.setLevel(logging.INFO)
        self._logger.propagate = False
        if not self._logger.handlers:
            handler = RotatingFileHandler(
                log_path, maxBytes=max_bytes, backupCount=backup_count, encoding="utf-8"
            )
            handler.setFormatter(logging.Formatter("%(asctime)s %(message)s", "%Y-%m-%d %H:%M:%S"))
            self._logger.addHandler(handler)
        self._buf = ""

    def write(self, msg: str) -> int:
        if not msg:
            return 0
        self._buf += msg
        while "\n" in self._buf:
            line, self._buf = self._buf.split("\n", 1)
            if line.strip():
                self._logger.info(line)
        return len(msg)

    def flush(self) -> None:
        if self._buf.strip():
            self._logger.info(self._buf.rstrip())
            self._buf = ""

    def isatty(self) -> bool:
        return False


def _stream_needs_redirect(stream: Any) -> bool:
    if stream is None:
        return True
    try:
        return stream.fileno() < 0
    except Exception:
        return False


def ensure_headless_stdio(log_path: str = LOG_PATH) -> None:
    """
    Redirects sys.stdout and sys.stderr to a rotating log file when running under
    pythonw.exe or Task Scheduler without a valid console handle.
    """
    if _stream_needs_redirect(sys.stdout) or _stream_needs_redirect(sys.stderr):
        stream = _RotatingLogStream(log_path)
        if _stream_needs_redirect(sys.stdout):
            sys.stdout = stream  # type: ignore[assignment]
        if _stream_needs_redirect(sys.stderr):
            sys.stderr = stream  # type: ignore[assignment]


def acquire_single_instance_mutex(mutex_name: str = r"Local\BYTE_Backend_Engine_Mutex") -> bool:
    """
    Acquires a named Windows mutex so duplicate backend instances exit cleanly.
    Returns True if this process owns the mutex, False if another instance already exists.
    """
    if sys.platform != "win32":
        return True
    try:
        kernel32 = ctypes.windll.kernel32
        handle = kernel32.CreateMutexW(None, False, mutex_name)
        last_err = kernel32.GetLastError()
        if not handle:
            return True
        if last_err == 183:  # ERROR_ALREADY_EXISTS
            kernel32.CloseHandle(handle)
            return False
        _MUTEX_HANDLES[mutex_name] = handle
        return True
    except Exception:
        return True


def is_backend_healthy(host: str = "127.0.0.1", port: int = 8000, timeout: float = 0.7) -> bool:
    """Checks whether the BYTE backend HTTP API is already responding."""
    try:
        req = urllib.request.Request(f"http://{host}:{port}/api/health", method="GET")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                return data.get("status") == "online"
    except Exception:
        pass
    return False


def request_daemon_stop() -> None:
    os.makedirs(os.path.dirname(STOP_MARKER_PATH), exist_ok=True)
    with open(STOP_MARKER_PATH, "w", encoding="utf-8") as f:
        f.write("stop")


def clear_daemon_stop() -> None:
    if os.path.exists(STOP_MARKER_PATH):
        try:
            os.remove(STOP_MARKER_PATH)
        except Exception:
            pass


def is_daemon_stop_requested() -> bool:
    return os.path.exists(STOP_MARKER_PATH)


def get_pythonw_executable() -> str:
    """Finds pythonw.exe for silent background execution without console windows."""
    exe = sys.executable or "python"
    if exe.lower().endswith("python.exe"):
        candidate = exe[:-10] + "pythonw.exe"
        if os.path.exists(candidate):
            return candidate
    if sys.platform == "win32":
        user_profile = os.environ.get("USERPROFILE", "")
        for rel in (
            r"AppData\Local\Python\bin\pythonw.exe",
            r"AppData\Local\Programs\Python\Python314\pythonw.exe",
        ):
            p = os.path.join(user_profile, rel)
            if os.path.exists(p):
                return p
    return exe


def get_desktop_exe_path() -> Optional[str]:
    """Resolves the compiled/installed BYTE desktop executable path if present."""
    local_app = os.environ.get("LOCALAPPDATA", "")
    candidates = [
        os.path.join(local_app, "BYTE Assistant", "byte-desktop.exe") if local_app else "",
        os.path.join(PROJECT_ROOT, "desktop", "src-tauri", "target", "release", "byte-desktop.exe"),
    ]
    for path in candidates:
        if path and os.path.exists(path):
            return path
    return None


def _run_hidden_ps(script: str, timeout: float = 30.0) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
        capture_output=True,
        text=True,
        timeout=timeout,
        creationflags=CREATE_NO_WINDOW,
    )


def get_autostart_status() -> Dict[str, Any]:
    """Reports whether Windows 24/7 logon task and desktop tray startup entry are registered."""
    if sys.platform != "win32":
        return {"task_registered": False, "tray_autostart": False, "enabled": False, "desktop_exe": None}

    task_registered = False
    try:
        res = subprocess.run(
            ["schtasks", "/Query", "/TN", TASK_NAME],
            capture_output=True,
            text=True,
            timeout=3.0,
            creationflags=CREATE_NO_WINDOW,
        )
        task_registered = res.returncode == 0
    except Exception:
        pass

    tray_autostart = False
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_RUN_PATH, 0, winreg.KEY_READ) as key:
            val, _ = winreg.QueryValueEx(key, REG_VALUE_NAME)
            tray_autostart = bool(val)
    except FileNotFoundError:
        tray_autostart = False
    except Exception:
        tray_autostart = False

    return {
        "task_registered": task_registered,
        "tray_autostart": tray_autostart,
        "enabled": task_registered or tray_autostart,
        "desktop_exe": get_desktop_exe_path(),
        "pythonw_exe": get_pythonw_executable(),
    }


def sync_windows_autostart(enabled: bool) -> Dict[str, Any]:
    """
    Registers or removes BYTE's 24/7 Windows startup configuration:
      1. Scheduled Task 'BYTE_Backend_24x7' at user logon (runs pythonw.exe backend/run_forever.py)
         with infinite execution time, battery support, and automatic restart on failure.
      2. HKCU Run entry 'BYTE Assistant' launching byte-desktop.exe --minimized into the system tray.
    """
    if sys.platform != "win32":
        return {"status": "skipped", "message": "Windows autostart is only supported on Windows."}

    errors = []
    pythonw = get_pythonw_executable()
    runner_script = os.path.join(PROJECT_ROOT, "backend", "run_forever.py")
    desktop_exe = get_desktop_exe_path()

    if enabled:
        # 1. Register interactive user-logon Scheduled Task for the 24/7 Python backend + voice daemon
        ps_register = f"""
$ErrorActionPreference = 'Stop'
$action = New-ScheduledTaskAction -Execute '{pythonw.replace("'", "''")}' -Argument '"{runner_script.replace("'", "''")}"' -WorkingDirectory '{PROJECT_ROOT.replace("'", "''")}'
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Seconds 0) -RestartCount 99 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName '{TASK_NAME}' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'BYTE Assistant 24/7 Persistent Backend & Continuous Wake-Word Engine' -Force | Out-Null
Write-Output 'REGISTERED'
"""
        try:
            res = _run_hidden_ps(ps_register)
            if res.returncode != 0:
                errors.append((res.stderr or res.stdout or "Failed to register scheduled task").strip())
        except Exception as e:
            errors.append(str(e))

        # 2. Register Desktop Tray App minimized at login
        if desktop_exe:
            try:
                import winreg
                with winreg.CreateKey(winreg.HKEY_CURRENT_USER, REG_RUN_PATH) as key:
                    winreg.SetValueEx(key, REG_VALUE_NAME, 0, winreg.REG_SZ, f'"{desktop_exe}" --minimized')
            except Exception as e:
                errors.append(f"Registry Run error: {e}")
    else:
        ps_unregister = f"""
if (Get-ScheduledTask -TaskName '{TASK_NAME}' -ErrorAction SilentlyContinue) {{
    Unregister-ScheduledTask -TaskName '{TASK_NAME}' -Confirm:$false -ErrorAction SilentlyContinue
}}
Write-Output 'UNREGISTERED'
"""
        try:
            _run_hidden_ps(ps_unregister)
        except Exception as e:
            errors.append(str(e))

        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_RUN_PATH, 0, winreg.KEY_SET_VALUE) as key:
                try:
                    winreg.DeleteValue(key, REG_VALUE_NAME)
                except FileNotFoundError:
                    pass
        except FileNotFoundError:
            pass
        except Exception as e:
            errors.append(f"Registry delete error: {e}")

    status = get_autostart_status()
    if errors:
        return {"status": "partial", "errors": errors, **status}
    return {
        "status": "success",
        "message": "BYTE 24/7 Windows startup enabled." if enabled else "BYTE 24/7 Windows startup disabled.",
        **status,
    }

