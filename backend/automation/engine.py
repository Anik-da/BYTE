import os
import re
import time
import shutil
import threading
import subprocess
import webbrowser
import urllib.request
import urllib.parse
import psutil
from typing import Dict, Any, Optional

def find_native_app(app_name: str) -> Optional[str]:
    """
    Scans the device for native installed desktop applications across:
    1. System PATH & standard executables
    2. Common Windows Application Directories
    3. Windows Start Menu Shortcuts (.lnk)
    4. Windows Registry App Paths
    5. Native URI Protocol handlers (spotify:, discord:, etc.)
    """
    app_lower = app_name.lower().strip()

    bin_path = shutil.which(app_lower) or shutil.which(f"{app_lower}.exe")
    if bin_path:
        return bin_path

    app_mapping = {
        "spotify": [
            r"C:\Users\%USERNAME%\AppData\Roaming\Spotify\Spotify.exe",
            r"C:\Users\%USERNAME%\AppData\Local\Microsoft\WindowsApps\Spotify.exe",
            "spotify:"
        ],
        "discord": [
            r"C:\Users\%USERNAME%\AppData\Local\Discord\Update.exe --processStart Discord.exe",
            "discord:"
        ],
        "vscode": [r"C:\Users\%USERNAME%\AppData\Local\Programs\Microsoft VS Code\Code.exe", "code"],
        "vs code": [r"C:\Users\%USERNAME%\AppData\Local\Programs\Microsoft VS Code\Code.exe", "code"],
        "visual studio code": [r"C:\Users\%USERNAME%\AppData\Local\Programs\Microsoft VS Code\Code.exe", "code"],
        "chrome": [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
        ],
        "google chrome": [r"C:\Program Files\Google\Chrome\Application\chrome.exe"],
        "edge": [r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", "msedge"],
        "microsoft edge": [r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"],
        "notepad": ["notepad.exe"],
        "calculator": ["calc.exe"],
        "calc": ["calc.exe"],
        "terminal": ["wt.exe", "cmd.exe"],
        "cmd": ["cmd.exe"],
        "command prompt": ["cmd.exe"],
        "powershell": ["powershell.exe"],
        "explorer": ["explorer.exe"],
        "file explorer": ["explorer.exe"],
        "vlc": [r"C:\Program Files\VideoLAN\VLC\vlc.exe", r"C:\Program Files (x86)\VideoLAN\VLC\vlc.exe"],
        "whatsapp": [r"C:\Users\%USERNAME%\AppData\Local\WhatsApp\WhatsApp.exe", "whatsapp:"],
        "telegram": [r"C:\Users\%USERNAME%\AppData\Roaming\Telegram Desktop\Telegram.exe", "tg:"],
        "steam": [r"C:\Program Files (x86)\Steam\steam.exe", "steam:"]
    }

    if app_lower in app_mapping:
        for candidate in app_mapping[app_lower]:
            expanded = os.path.expandvars(candidate)
            if candidate.endswith(":") or shutil.which(expanded) or os.path.exists(expanded):
                return expanded

    start_dirs = [
        os.path.expandvars(r'%PROGRAMDATA%\Microsoft\Windows\Start Menu\Programs'),
        os.path.expandvars(r'%APPDATA%\Microsoft\Windows\Start Menu\Programs')
    ]
    for sdir in start_dirs:
        if os.path.exists(sdir):
            for root, dirs, files in os.walk(sdir):
                for f in files:
                    if f.lower().endswith('.lnk') and app_lower in f.lower():
                        return os.path.join(root, f)

    try:
        import winreg
        reg_keys = [
            (winreg.HKEY_LOCAL_MACHINE, r'SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths'),
            (winreg.HKEY_CURRENT_USER, r'SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths')
        ]
        for hkey, rpath in reg_keys:
            try:
                with winreg.OpenKey(hkey, rpath) as key:
                    num_subkeys, _, _ = winreg.QueryInfoKey(key)
                    for i in range(num_subkeys):
                        subkey_name = winreg.EnumKey(key, i)
                        if app_lower in subkey_name.lower():
                            with winreg.OpenKey(key, subkey_name) as subkey:
                                val, _ = winreg.QueryValueEx(subkey, '')
                                if val and os.path.exists(os.path.expandvars(val)):
                                    return os.path.expandvars(val)
            except Exception:
                pass
    except Exception:
        pass

    return None

def trigger_media_key_play():
    """Simulates media play/pause or enter key press after opening player."""
    try:
        time.sleep(2.5)
        import pyautogui
        pyautogui.press('enter')
        time.sleep(0.5)
        pyautogui.press('space')
    except Exception:
        pass

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

    def check_github_update(self) -> Dict[str, Any]:
        """Checks GitHub master branch for new commits."""
        try:
            cmd = "git rev-parse HEAD"
            local_commit = subprocess.check_output(cmd, shell=True, text=True).strip()
            
            req = urllib.request.Request(
                "https://api.github.com/repos/Anik-da/BYTE/commits/master",
                headers={"User-Agent": "BYTE-Assistant-Updater"}
            )
            html = urllib.request.urlopen(req, timeout=5).read().decode('utf-8')
            import json
            data = json.loads(html)
            remote_commit = data.get("sha", "")
            commit_msg = data.get("commit", {}).get("message", "").split("\n")[0]
            
            has_update = local_commit != remote_commit if (local_commit and remote_commit) else False
            return {
                "status": "success",
                "update_available": has_update,
                "local_commit": local_commit[:7],
                "remote_commit": remote_commit[:7],
                "commit_message": commit_msg
            }
        except Exception as e:
            return {"status": "error", "update_available": False, "message": str(e)}

    def apply_github_update(self) -> Dict[str, Any]:
        """Pulls latest updates from GitHub and rebuilds."""
        try:
            out = subprocess.check_output("git pull origin master", shell=True, text=True).strip()
            return {"status": "success", "message": f"Successfully updated from GitHub: {out}"}
        except Exception as e:
            return {"status": "error", "message": f"Git pull failed: {str(e)}"}

    def execute_action(self, intent: str, target: Optional[str] = None, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if intent == "open_application":
            return self._open_app(target or "")
        elif intent == "in_app_action":
            action_type = data.get("action", "type") if data else "type"
            payload = data.get("payload", "") if data else ""
            return self._execute_in_app_action(target or "", action_type, payload)
        elif intent == "play_media":
            return self._play_media(target or "")
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

    def _execute_in_app_action(self, target_app: str, action: str, payload: str) -> Dict[str, Any]:
        """
        Executes inside-application automation (typing messages, sending texts, making calls, writing notes).
        """
        app_lower = target_app.lower().strip()
        action_lower = action.lower().strip()
        payload_clean = payload.strip()

        # 1. Open/Focus target application
        self._open_app(app_lower)
        time.sleep(1.5)

        # 2. WhatsApp In-App Messaging & Calling
        if "whatsapp" in app_lower:
            if "call" in action_lower:
                try:
                    import pyautogui
                    pyautogui.hotkey('ctrl', 'f')
                    time.sleep(0.4)
                    pyautogui.write(payload_clean, interval=0.03)
                    time.sleep(0.5)
                    pyautogui.press('enter')
                    time.sleep(0.5)
                    pyautogui.hotkey('ctrl', 'shift', 'c')
                    return {"status": "success", "message": f"Initiated WhatsApp call to '{payload_clean}'."}
                except Exception as e:
                    return {"status": "error", "message": f"WhatsApp call error: {str(e)}"}
            else:
                try:
                    import pyautogui
                    text_msg = payload_clean
                    contact = ""
                    if " to " in payload_clean:
                        parts = payload_clean.split(" to ")
                        text_msg = parts[0].strip()
                        contact = parts[1].strip()

                    if contact:
                        pyautogui.hotkey('ctrl', 'f')
                        time.sleep(0.4)
                        pyautogui.write(contact, interval=0.03)
                        time.sleep(0.5)
                        pyautogui.press('enter')
                        time.sleep(0.5)

                    pyautogui.write(text_msg, interval=0.02)
                    time.sleep(0.3)
                    pyautogui.press('enter')
                    return {"status": "success", "message": f"Sent WhatsApp message: '{text_msg}'."}
                except Exception as e:
                    return {"status": "error", "message": f"WhatsApp message error: {str(e)}"}

        # 3. Generic In-App Typing (Notepad, VS Code, Word, Terminal, etc.)
        try:
            import pyautogui
            pyautogui.write(payload_clean, interval=0.02)
            time.sleep(0.2)
            pyautogui.press('enter')
            return {"status": "success", "message": f"Performed in-app action in '{target_app}': typed '{payload_clean}'."}
        except Exception as e:
            return {"status": "error", "message": f"In-app typing error: {str(e)}"}

    def _open_app(self, app_name: str) -> Dict[str, Any]:
        app_name_lower = app_name.lower().strip()

        native_path = find_native_app(app_name_lower)
        if native_path:
            try:
                if native_path.endswith(":"):
                    subprocess.Popen(f'start "" "{native_path}"', shell=True)
                elif native_path.lower().endswith(".lnk"):
                    os.startfile(native_path)
                else:
                    subprocess.Popen(f'start "" "{native_path}"', shell=True)
                return {"status": "success", "message": f"Successfully launched native desktop application '{app_name}'."}
            except Exception:
                pass

        web_urls = {
            "spotify": "https://open.spotify.com",
            "discord": "https://discord.com/app",
            "whatsapp": "https://web.whatsapp.com",
            "telegram": "https://web.telegram.org",
            "youtube": "https://www.youtube.com",
            "github": "https://github.com",
            "twitter": "https://x.com",
            "instagram": "https://www.instagram.com",
            "reddit": "https://www.reddit.com"
        }

        if app_name_lower in web_urls:
            webbrowser.open(web_urls[app_name_lower])
            return {"status": "success", "message": f"Native app '{app_name}' not installed. Opened web application in browser."}

        search_url = f"https://www.google.com/search?q={urllib.parse.quote(app_name_lower)}"
        webbrowser.open(search_url)
        return {"status": "success", "message": f"Local application '{app_name}' not found on device. Opened web search in browser."}

    def _play_media(self, query_or_target: str) -> Dict[str, Any]:
        """
        Plays requested song/video automatically:
        - Excludes YouTube Shorts (forces full-length official videos).
        - Auto-plays Spotify songs via desktop app / web player trigger.
        """
        query_lower = query_or_target.lower().strip()

        is_spotify = "spotify" in query_lower
        query_clean = re.sub(r'\b(on youtube|on spotify|play|song|video|music)\b', '', query_or_target, flags=re.IGNORECASE).strip()
        if not query_clean:
            query_clean = query_or_target

        if is_spotify:
            native_spotify = find_native_app("spotify")
            if native_spotify:
                try:
                    subprocess.Popen(f'start "" "spotify:search:{urllib.parse.quote(query_clean)}"', shell=True)
                    threading.Thread(target=trigger_media_key_play, daemon=True).start()
                    return {"status": "success", "message": f"Playing '{query_clean}' in Spotify native application."}
                except Exception:
                    pass
            
            spotify_url = f"https://open.spotify.com/search/{urllib.parse.quote(query_clean)}"
            webbrowser.open(spotify_url)
            threading.Thread(target=trigger_media_key_play, daemon=True).start()
            return {"status": "success", "message": f"Opening and playing '{query_clean}' in Spotify Web."}

        # YouTube Autoplay Resolution with SHORTS EXCLUSION FILTER
        search_url = f"https://www.youtube.com/results?search_query={urllib.parse.quote(query_clean + ' official video song')}"
        try:
            req = urllib.request.Request(search_url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            })
            html = urllib.request.urlopen(req, timeout=5).read().decode('utf-8')

            # Strictly match full-length videoRenderer items to filter out Shorts
            video_ids = re.findall(r'"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})"', html)
            if video_ids:
                autoplay_url = f"https://www.youtube.com/watch?v={video_ids[0]}&autoplay=1"
                webbrowser.open(autoplay_url)
                return {"status": "success", "message": f"Playing official full-length video '{query_clean}' automatically on YouTube."}
        except Exception:
            pass

        webbrowser.open(search_url)
        return {"status": "success", "message": f"Opened YouTube search for '{query_clean}'."}

    def _open_website(self, url_or_query: str) -> Dict[str, Any]:
        if "youtube.com/results?search_query=" in url_or_query:
            query = url_or_query.split("search_query=")[-1]
            return self._play_media(urllib.parse.unquote(query))

        if not (url_or_query.startswith("http://") or url_or_query.startswith("https://")):
            if "." in url_or_query and " " not in url_or_query:
                url = f"https://{url_or_query}"
            else:
                url = f"https://www.google.com/search?q={urllib.parse.quote(url_or_query)}"
        else:
            url = url_or_query

        webbrowser.open(url)
        return {"status": "success", "message": f"Opened web target in browser."}

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
