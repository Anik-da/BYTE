import os
import subprocess
import webbrowser
import psutil
from typing import Dict, Any, Optional

class AutomationEngine:
    def __init__(self):
        pass

    def get_system_telemetry(self) -> Dict[str, Any]:
        cpu_load = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory()
        battery = psutil.sensors_battery()
        
        gpu_info = {
            "gpu_name": "NVIDIA GeForce RTX 4060",
            "gpu_percent": 0,
            "vram_used_mb": 0,
            "vram_total_mb": 8188,
            "vram_percent": 0
        }
        
        try:
            cmd = "nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu --format=csv,noheader,nounits"
            out = subprocess.check_output(cmd, shell=True, text=True, timeout=2).strip()
            if out:
                parts = [p.strip() for p in out.split(',')]
                if len(parts) >= 4:
                    gpu_info["gpu_name"] = parts[0]
                    used = float(parts[1])
                    total = float(parts[2])
                    gpu_info["vram_used_mb"] = round(used, 1)
                    gpu_info["vram_total_mb"] = round(total, 1)
                    gpu_info["vram_percent"] = round((used / total) * 100, 1) if total > 0 else 0
                    gpu_info["gpu_percent"] = int(parts[3])
        except Exception:
            pass

        return {
            "cpu_load": cpu_load,
            "memory_used_mb": round(mem.used / (1024 * 1024), 1),
            "memory_percent": mem.percent,
            "battery_percent": battery.percent if battery else 100,
            "battery_plugged": battery.power_plugged if battery else True,
            "processes_count": len(psutil.pids()),
            "gpu": gpu_info
        }

    def execute_action(self, intent: str, target: Optional[str] = None, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Executes verified system automation actions based on classified intent.
        """
        if intent == "open_application":
            return self._open_app(target or "")
        elif intent == "open_website":
            return self._open_website(target or "")
        elif intent == "system_command":
            return self._run_system_command(target or "")
        elif intent == "file_search":
            return self._search_files(target or "")
        elif intent == "kill_process":
            return self._kill_process(target or "")
        else:
            return {"status": "skipped", "message": "No automation required for intent"}

    def _open_app(self, app_name: str) -> Dict[str, Any]:
        app_name_lower = app_name.lower().strip()
        
        # Extended lookup table for common Windows software executables & paths
        common_apps = {
            "vscode": ["code", r"C:\Users\%USERNAME%\AppData\Local\Programs\Microsoft VS Code\Code.exe"],
            "vs code": ["code", r"C:\Users\%USERNAME%\AppData\Local\Programs\Microsoft VS Code\Code.exe"],
            "visual studio code": ["code", r"C:\Users\%USERNAME%\AppData\Local\Programs\Microsoft VS Code\Code.exe"],
            "chrome": ["chrome", r"C:\Program Files\Google\Chrome\Application\chrome.exe", r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"],
            "google chrome": ["chrome", r"C:\Program Files\Google\Chrome\Application\chrome.exe"],
            "edge": ["msedge", r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"],
            "microsoft edge": ["msedge", r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"],
            "notepad": ["notepad"],
            "calculator": ["calc"],
            "calc": ["calc"],
            "terminal": ["wt", "cmd"],
            "cmd": ["cmd"],
            "command prompt": ["cmd"],
            "powershell": ["powershell"],
            "explorer": ["explorer"],
            "file explorer": ["explorer"],
            "spotify": ["spotify", r"C:\Users\%USERNAME%\AppData\Roaming\Spotify\Spotify.exe"],
            "discord": ["discord", r"C:\Users\%USERNAME%\AppData\Local\Discord\Update.exe --processStart Discord.exe"]
        }
        
        candidates = common_apps.get(app_name_lower, [app_name_lower])
        
        for candidate in candidates:
            expanded = os.path.expandvars(candidate)
            try:
                # Launch using Windows start shell
                subprocess.Popen(f'start "" "{expanded}"', shell=True)
                return {"status": "success", "message": f"Successfully launched '{app_name}'"}
            except Exception:
                continue
                
        # Last resort fallback: try os.system
        try:
            os.system(f'start {app_name_lower}')
            return {"status": "success", "message": f"Executed launch trigger for '{app_name}'"}
        except Exception as e:
            return {"status": "error", "message": f"Failed to launch '{app_name}': {str(e)}"}

    def _open_website(self, url_or_query: str) -> Dict[str, Any]:
        if not (url_or_query.startswith("http://") or url_or_query.startswith("https://")):
            if "." in url_or_query and " " not in url_or_query:
                url = f"https://{url_or_query}"
            else:
                url = f"https://www.google.com/search?q={url_or_query}"
        else:
            url = url_or_query
            
        webbrowser.open(url)
        return {"status": "success", "message": f"Opened {url} in browser"}

    def _run_system_command(self, cmd_type: str) -> Dict[str, Any]:
        cmd_type_lower = cmd_type.lower()
        if "lock" in cmd_type_lower:
            subprocess.run("rundll32.exe user32.dll,LockWorkStation", shell=True)
            return {"status": "success", "message": "PC locked"}
        elif "calculator" in cmd_type_lower:
            subprocess.Popen("calc", shell=True)
            return {"status": "success", "message": "Calculator opened"}
        return {"status": "ignored", "message": "Command type unrecognized"}

    def _search_files(self, keyword: str) -> Dict[str, Any]:
        user_docs = os.path.expanduser("~/Documents")
        matches = []
        if os.path.exists(user_docs):
            for root, dirs, files in os.walk(user_docs):
                for f in files:
                    if keyword.lower() in f.lower():
                        matches.append(os.path.join(root, f))
                        if len(matches) >= 10:
                            break
                if len(matches) >= 10:
                    break
        return {"status": "success", "matches": matches, "message": f"Found {len(matches)} files matching '{keyword}'"}

    def _kill_process(self, process_name: str) -> Dict[str, Any]:
        count = 0
        for proc in psutil.process_iter(['pid', 'name']):
            try:
                if process_name.lower() in proc.info['name'].lower():
                    proc.kill()
                    count += 1
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        return {"status": "success", "message": f"Terminated {count} instances of {process_name}"}

automation_engine = AutomationEngine()
