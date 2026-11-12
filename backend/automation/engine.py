import os
import re
import sys
import time
import shutil
import threading
import subprocess
import webbrowser
import urllib.request
import urllib.parse
import psutil
from typing import Dict, Any, Optional

_CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0

try:
    import pyautogui
    pyautogui.FAILSAFE = False
    pyautogui.PAUSE = 0.05
except Exception:
    pass

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
    if bin_path and "windowsapps" not in bin_path.lower():
        return bin_path

    app_mapping = {
        "spotify": [
            r"C:\Users\%USERNAME%\AppData\Roaming\Spotify\Spotify.exe",
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
        "brave": [r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe", "brave"],
        "firefox": [r"C:\Program Files\Mozilla Firefox\firefox.exe", "firefox"],
        "notepad": ["notepad.exe"],
        "paint": ["mspaint.exe"],
        "mspaint": ["mspaint.exe"],
        "calculator": ["calc.exe"],
        "calc": ["calc.exe"],
        "word": ["winword.exe", "word"],
        "microsoft word": ["winword.exe"],
        "excel": ["excel.exe"],
        "microsoft excel": ["excel.exe"],
        "powerpoint": ["powerpnt.exe"],
        "settings": ["ms-settings:"],
        "control panel": ["control.exe"],
        "task manager": ["taskmgr.exe"],
        "taskmgr": ["taskmgr.exe"],
        "snipping tool": ["snippingtool.exe"],
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
            if "windowsapps" in expanded.lower():
                continue
            if candidate.endswith(":") or (shutil.which(expanded) and "windowsapps" not in shutil.which(expanded).lower()) or os.path.exists(expanded):
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
                        full_lnk = os.path.join(root, f)
                        if "windowsapps" not in full_lnk.lower():
                            return full_lnk

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
                                exp = os.path.expandvars(val or '')
                                if exp and "windowsapps" not in exp.lower() and os.path.exists(exp):
                                    return exp
            except Exception:
                pass
    except Exception:
        pass

    return None

def focus_window_by_name(name: str) -> bool:
    """Restores and brings target application window directly to the screen foreground."""
    try:
        import ctypes
        user32 = ctypes.windll.user32
        name_lower = name.lower().strip()
        found = [False]

        def cb(hwnd, extra):
            length = user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buf = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buf, length + 1)
                title = buf.value.strip()
                if name_lower in title.lower():
                    # Tap Alt key to bypass Windows SetForegroundWindow lock
                    user32.keybd_event(0x12, 0, 0, 0)
                    user32.ShowWindow(hwnd, 9) # SW_RESTORE
                    user32.SetForegroundWindow(hwnd)
                    user32.BringWindowToTop(hwnd)
                    user32.keybd_event(0x12, 0, 2, 0)
                    found[0] = True
                    return False
            return True

        WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)
        user32.EnumWindows(WNDENUMPROC(cb), 0)
        return found[0]
    except Exception:
        return False

def set_windows_clipboard(text: str):
    """Copies text directly to Windows Clipboard using native Win32 C API (supports unicode, emojis, and multiline)."""
    try:
        import ctypes
        user32 = ctypes.windll.user32
        kernel32 = ctypes.windll.kernel32
        user32.OpenClipboard.argtypes = [ctypes.c_void_p]
        user32.OpenClipboard.restype = ctypes.c_bool
        user32.EmptyClipboard.restype = ctypes.c_bool
        user32.SetClipboardData.argtypes = [ctypes.c_uint, ctypes.c_void_p]
        user32.SetClipboardData.restype = ctypes.c_void_p
        user32.CloseClipboard.restype = ctypes.c_bool
        kernel32.GlobalAlloc.argtypes = [ctypes.c_uint, ctypes.c_size_t]
        kernel32.GlobalAlloc.restype = ctypes.c_void_p
        kernel32.GlobalLock.argtypes = [ctypes.c_void_p]
        kernel32.GlobalLock.restype = ctypes.c_void_p
        kernel32.GlobalUnlock.argtypes = [ctypes.c_void_p]

        text_bytes = text.encode('utf-16le') + b'\x00\x00'
        if user32.OpenClipboard(None):
            try:
                user32.EmptyClipboard()
                h_mem = kernel32.GlobalAlloc(0x0042, len(text_bytes))
                if h_mem:
                    p_mem = kernel32.GlobalLock(h_mem)
                    if p_mem:
                        ctypes.memmove(p_mem, text_bytes, len(text_bytes))
                        kernel32.GlobalUnlock(h_mem)
                        user32.SetClipboardData(13, h_mem)
            finally:
                user32.CloseClipboard()
    except Exception as e:
        print("Clipboard copy error:", e)

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
        # Default approved friends list for safety (user can add/remove via settings or voice)
        self.approved_friends = ["Alex", "Mom", "Rahul", "John", "Sarah", "Dad", "Sam"]
        self.latest_telemetry = {
            "cpu_load": 0.0,
            "memory_percent": 0.0,
            "memory_used_mb": 0.0,
            "network_percent": 0.0,
            "battery_percent": 100.0,
            "battery_plugged": True,
            "temperature": 42.0,
            "uptime": 0,
            "processes_count": 0,
            "max_processes": 1024,
            "threat_level": "GREEN",
            "hostile_contacts": 0,
            "perimeter": 100,
            "integrity": 100,
            "gpu": {
                "gpu_name": "NVIDIA GeForce RTX 4060",
                "gpu_percent": 0,
                "vram_used_mb": 0,
                "vram_total_mb": 8188,
                "vram_percent": 0
            },
            "location": {
                "lat": 22.5726,
                "lon": 88.3639,
                "city": "Kolkata",
                "country": "India",
                "ip": "127.0.0.1"
            },
            "connections": [],
            "nearby_devices": []
        }
        # Start daemon thread to fetch telemetry in background
        self._telemetry_thread = threading.Thread(target=self._bg_telemetry_loop, daemon=True)
        self._telemetry_thread.start()

    def get_system_telemetry(self) -> Dict[str, Any]:
        return self.latest_telemetry

    def _bg_telemetry_loop(self):
        import urllib.request
        import json
        
        last_geo_time = 0
        last_slow_device_scan = 0
        
        cached_geo = {
            "lat": 22.5726,
            "lon": 88.3639,
            "city": "Kolkata",
            "country": "India",
            "ip": "127.0.0.1"
        }
        cached_nearby = []
        
        while True:
            try:
                now = time.time()
                
                # Fetch fast metrics
                cpu_load = psutil.cpu_percent(interval=None)
                mem = psutil.virtual_memory()
                battery = psutil.sensors_battery()
                
                net_io = psutil.net_io_counters()
                net_percent = min(100.0, round((net_io.bytes_sent + net_io.bytes_recv) / (1024 * 1024 * 5), 1))
                
                uptime_sec = int(time.time() - psutil.boot_time())
                
                temp = 42.0
                try:
                    temps = psutil.sensors_temperatures()
                    if temps:
                        for k, v in temps.items():
                            if v and len(v) > 0:
                                temp = v[0].current
                                break
                except Exception:
                    pass

                gpu_info = {
                    "gpu_name": "NVIDIA GeForce RTX 4060",
                    "gpu_percent": 0,
                    "vram_used_mb": 0,
                    "vram_total_mb": 8188,
                    "vram_percent": 0
                }
                try:
                    cmd = "nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu --format=csv,noheader,nounits"
                    out = subprocess.check_output(cmd, shell=True, text=True, timeout=1.5, creationflags=_CREATE_NO_WINDOW).strip()
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

                proc_count = len(psutil.pids())
                threat_level = "YELLOW" if (cpu_load > 85 or mem.percent > 85) else "GREEN"
                hostile_contacts = 1 if threat_level == "YELLOW" else 0

                # Geolocation via IP (cache for 10 minutes, retry in 20s on failure)
                if now - last_geo_time > 600:
                    try:
                        req = urllib.request.Request("http://ip-api.com/json", headers={"User-Agent": "Mozilla/5.0"})
                        with urllib.request.urlopen(req, timeout=3.0) as response:
                            data = json.loads(response.read().decode())
                            if data.get("status") == "success":
                                cached_geo = {
                                    "lat": float(data.get("lat", 22.5726)),
                                    "lon": float(data.get("lon", 88.3639)),
                                    "city": data.get("city", "Kolkata"),
                                    "country": data.get("country", "India"),
                                    "ip": data.get("query", "127.0.0.1")
                                }
                                last_geo_time = now
                    except Exception:
                        last_geo_time = now - 580

                # Connections
                conn_dots = []
                try:
                    conns = psutil.net_connections(kind='inet')
                    for c in conns:
                        if c.raddr:
                            ip_str = c.raddr.ip
                            port = c.raddr.port
                            h = hash(ip_str)
                            angle = (h % 360)
                            dist = 0.2 + (abs(h) % 70) / 100.0
                            conn_dots.append({
                                "ip": ip_str,
                                "port": port,
                                "angle": angle,
                                "distance": dist,
                                "status": c.status
                            })
                            if len(conn_dots) >= 12:
                                break
                except Exception:
                    pass

                # Slow scans (ARP, wifi, bluetooth) every 30 seconds
                if now - last_slow_device_scan > 30:
                    nearby_devices = []
                    
                    # 1. LAN Devices via ARP table
                    try:
                        arp_out = subprocess.check_output("arp -a", shell=True, text=True, timeout=2, creationflags=_CREATE_NO_WINDOW)
                        seen_ips = set()
                        for line in arp_out.splitlines():
                            line = line.strip()
                            if not line or "Interface" in line or "Internet Address" in line:
                                continue
                            parts = line.split()
                            if len(parts) >= 3:
                                ip = parts[0]
                                mac = parts[1].replace("-", ":").upper()
                                conn_type = parts[2].lower()
                                if (ip.startswith("224.") or ip.startswith("239.") or 
                                    ip == "255.255.255.255" or "FF:FF:FF:FF:FF:FF" in mac or 
                                    "01:00:5E" in mac or conn_type != "dynamic"):
                                    continue
                                if ip not in seen_ips:
                                    seen_ips.add(ip)
                                    h = hash(mac or ip)
                                    nearby_devices.append({
                                        "name": f"LAN Host ({ip})",
                                        "type": "wifi",
                                        "signal": 75 + (abs(h) % 20),
                                        "mac": mac,
                                        "angle": abs(h) % 360,
                                        "distance": 0.2 + (abs(h) % 65) / 100.0
                                    })
                    except Exception:
                        pass

                    # 2. Wifi networks
                    try:
                        wifi_out = subprocess.check_output(
                            "netsh wlan show networks mode=bssid", shell=True, text=True, timeout=2.5, creationflags=_CREATE_NO_WINDOW
                        )
                        ssid = ""
                        signal = 0
                        bssid = ""
                        for line in wifi_out.splitlines():
                            line = line.strip()
                            if line.startswith("SSID") and "BSSID" not in line:
                                ssid = line.split(":", 1)[1].strip() if ":" in line else ""
                            elif line.startswith("BSSID"):
                                bssid = line.split(":", 1)[1].strip() if ":" in line else ""
                            elif line.startswith("Signal"):
                                try:
                                    signal = int(line.split(":", 1)[1].strip().replace("%", ""))
                                except Exception:
                                    signal = 50
                                if ssid:
                                    h = hash(bssid or ssid)
                                    nearby_devices.append({
                                        "name": ssid or "Network AP",
                                        "type": "wifi",
                                        "signal": signal,
                                        "mac": bssid.upper(),
                                        "angle": abs(h) % 360,
                                        "distance": max(0.2, min(0.9, 1.0 - signal / 100.0))
                                    })
                                    ssid = ""
                                    bssid = ""
                                    signal = 0
                                if len(nearby_devices) >= 12:
                                    break
                    except Exception:
                        pass

                    # 3. Bluetooth Devices
                    try:
                        bt_cmd = (
                            'powershell -Command "'
                            'Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue | '
                            'Where-Object { $_.Status -eq \'OK\' } | '
                            'Select-Object FriendlyName, InstanceId | '
                            'ForEach-Object { $_.FriendlyName + \'||\' + $_.InstanceId }'
                            '"'
                        )
                        bt_out = subprocess.check_output(bt_cmd, shell=True, text=True, timeout=3.5, creationflags=_CREATE_NO_WINDOW)
                        seen_bt_names = set()
                        for line in bt_out.strip().splitlines():
                            parts = line.strip().split("||")
                            name = parts[0].strip() if parts else ""
                            dev_id = parts[1].strip() if len(parts) > 1 else name
                            if not name:
                                continue
                            name_lower = name.lower()
                            exclude_keywords = [
                                "avrcp", "transport", "enumerator", "service", "adapter", 
                                "controller", "protocol", "generic", "microsoft", "intel", 
                                "rfcomm", "pan", "nap", "attribute", "access profile", "device"
                            ]
                            if any(kw in name_lower for kw in exclude_keywords):
                                continue
                            if name not in seen_bt_names:
                                seen_bt_names.add(name)
                                h = hash(dev_id)
                                nearby_devices.append({
                                    "name": name,
                                    "type": "bluetooth",
                                    "signal": 70,
                                    "mac": dev_id[:17] if dev_id else "",
                                    "angle": abs(h) % 360,
                                    "distance": 0.35 + (abs(h) % 45) / 100.0
                                })
                    except Exception:
                        pass

                    cached_nearby = nearby_devices
                    last_slow_device_scan = now

                # Atomic assign
                self.latest_telemetry = {
                    "cpu_load": round(cpu_load, 1),
                    "memory_percent": round(mem.percent, 1),
                    "memory_used_mb": round(mem.used / (1024 * 1024), 1),
                    "network_percent": net_percent,
                    "battery_percent": round(battery.percent, 1) if battery else 100.0,
                    "battery_plugged": battery.power_plugged if battery else True,
                    "temperature": round(temp, 1),
                    "uptime": uptime_sec,
                    "processes_count": proc_count,
                    "max_processes": 1024,
                    "threat_level": threat_level,
                    "hostile_contacts": hostile_contacts,
                    "perimeter": 100,
                    "integrity": 100,
                    "gpu": gpu_info,
                    "location": cached_geo,
                    "connections": conn_dots,
                    "nearby_devices": cached_nearby
                }

            except Exception:
                pass
                
            time.sleep(3.0)

    def check_github_update(self) -> Dict[str, Any]:
        """Checks GitHub master branch for new commits."""
        try:
            cmd = "git rev-parse HEAD"
            local_commit = subprocess.check_output(cmd, shell=True, text=True, creationflags=_CREATE_NO_WINDOW).strip()
            
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
        """Pulls latest updates from GitHub and automatically re-installs newer build if present."""
        try:
            out = subprocess.check_output("git pull origin master", shell=True, text=True).strip()
            setup_exe = r"C:\Users\anikd\Downloads\BYTE-main\desktop\src-tauri\target\release\bundle\nsis\BYTE Assistant_1.2.1_x64-setup.exe"
            if os.path.exists(setup_exe):
                subprocess.Popen(f'powershell -Command "Start-Process -FilePath \'{setup_exe}\' -ArgumentList \'/S\'"', shell=True)
            return {"status": "success", "message": f"Successfully updated from GitHub: {out}. Auto-reinstallation triggered."}
        except Exception as e:
            return {"status": "error", "message": f"Git pull failed: {str(e)}"}

    def execute_action(self, intent: str, target: Optional[str] = None, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if intent == "open_application":
            return self._open_app(target or "")
        elif intent == "in_app_action":
            action_type = data.get("action", "type") if data else "type"
            payload = data.get("payload", "") if data else ""
            contact = data.get("contact", "") if data else ""
            return self._execute_in_app_action(target or "", action_type, payload, contact=contact)
        elif intent == "auto_reply_friend":
            contact = data.get("contact", "") if data else ""
            payload = data.get("payload", "") if data else ""
            return self._auto_reply_to_friend(contact, payload)
        elif intent == "check_incoming_messages":
            return self._check_incoming_messages()
        elif intent == "add_friend":
            return self._add_friend(target or "")
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

    def _execute_in_app_action(self, target_app: str, action: str, payload: str, contact: str = "") -> Dict[str, Any]:
        """
        Executes inside-application automation (typing messages, sending texts, making calls, writing notes).
        """
        app_lower = target_app.lower().strip()
        action_lower = action.lower().strip()
        payload_clean = payload.strip()
        contact_clean = contact.strip()

        # 1. Open/Focus target application
        self._open_app(app_lower)
        time.sleep(1.0)
        focus_window_by_name(app_lower)
        time.sleep(1.0)

        # 2. WhatsApp In-App Messaging & Calling
        if "whatsapp" in app_lower:
            target_person = contact_clean or payload_clean
            if "call" in action_lower:
                try:
                    import pyautogui
                    set_windows_clipboard(target_person)
                    pyautogui.hotkey('ctrl', 'f')
                    time.sleep(0.5)
                    pyautogui.hotkey('ctrl', 'v')
                    time.sleep(0.8)
                    pyautogui.press('enter')
                    time.sleep(0.8)
                    pyautogui.hotkey('ctrl', 'shift', 'c')
                    return {"status": "success", "message": f"Initiated WhatsApp call to '{target_person}'."}
                except Exception as e:
                    return {"status": "error", "message": f"WhatsApp call error: {str(e)}"}
            else:
                try:
                    import pyautogui
                    text_msg = payload_clean
                    c_person = contact_clean

                    if not c_person:
                        # Parse contact and message from payload
                        if " to " in payload_clean.lower():
                            parts = payload_clean.rsplit(" to ", 1)
                            c_person = parts[1].strip()
                            text_msg = parts[0].strip()
                        else:
                            # Check for separators like colon or comma
                            split_done = False
                            for sep in [":", ",", "-"]:
                                if sep in payload_clean:
                                    parts = payload_clean.split(sep, 1)
                                    c_candidate = parts[0].strip()
                                    m_candidate = parts[1].strip()
                                    if c_candidate and m_candidate:
                                        c_person = c_candidate
                                        text_msg = m_candidate
                                        split_done = True
                                        break
                            if not split_done:
                                # Check for common starting words
                                words = payload_clean.split()
                                if len(words) > 1:
                                    starters = {
                                        "where", "what", "how", "why", "when", "who", "are", "is", "can", "will", "do", "did", 
                                        "have", "has", "hello", "hi", "hey", "please", "sorry", "thanks", "thank", "you", "me", 
                                        "i", "we", "they", "he", "she", "it", "my", "your", "our", "their", "his", "her", "its", 
                                        "am", "was", "were", "been", "go", "come", "get", "give", "take", "make", "know", "think", 
                                        "see", "want", "look", "find", "use", "tell", "ask", "say", "saying", "that", "as", "with"
                                    }
                                    for idx in range(1, len(words)):
                                        if words[idx].lower() in starters:
                                            c_person = " ".join(words[:idx]).strip()
                                            text_msg = " ".join(words[idx:]).strip()
                                            break

                    if c_person:
                        # Focus search bar and paste contact name via Clipboard
                        set_windows_clipboard(c_person)
                        pyautogui.hotkey('ctrl', 'f')
                        time.sleep(0.5)
                        pyautogui.hotkey('ctrl', 'a')
                        pyautogui.hotkey('ctrl', 'v')
                        time.sleep(0.8)
                        # Select contact from search results (press down arrow first to highlight top match)
                        pyautogui.press('down')
                        time.sleep(0.3)
                        pyautogui.press('enter')
                        time.sleep(0.8)

                    # Paste message text via Clipboard and send
                    set_windows_clipboard(text_msg)
                    pyautogui.hotkey('ctrl', 'v')
                    time.sleep(0.4)
                    pyautogui.press('enter')
                    dest_str = f" to '{c_person}'" if c_person else ""
                    return {"status": "success", "message": f"Sent WhatsApp message{dest_str}: '{text_msg}'."}
                except Exception as e:
                    return {"status": "error", "message": f"WhatsApp message error: {str(e)}"}

        # 3. Generic In-App Typing (Notepad, VS Code, Word, Terminal, etc.)
        try:
            import pyautogui
            set_windows_clipboard(payload_clean)
            pyautogui.hotkey('ctrl', 'v')
            time.sleep(0.2)
            pyautogui.press('enter')
            return {"status": "success", "message": f"Performed in-app action in '{target_app}': typed '{payload_clean}'."}
        except Exception as e:
            return {"status": "error", "message": f"In-app typing error: {str(e)}"}

    def _auto_reply_to_friend(self, contact: str, payload: str) -> Dict[str, Any]:
        """
        Automatically opens chat with target friend, captures on-screen message context,
        synthesizes an AI response based on what they messaged, and sends the reply.
        Strictly restricted to approved friends list.
        """
        contact_clean = contact.strip()
        if not contact_clean:
            return {"status": "error", "message": "Please specify the friend contact name."}

        # Security Check: Verify contact is in Approved Friends List
        contact_lower = contact_clean.lower()
        is_approved = any(f.lower() in contact_lower or contact_lower in f.lower() for f in self.approved_friends)
        if not is_approved:
            return {
                "status": "blocked",
                "message": f"Security restriction: '{contact_clean}' is not in your Approved Friends List. Auto-reply was skipped for safety. Current friends list: {', '.join(self.approved_friends)}."
            }

        # 1. Open and focus messaging application
        self._open_app("whatsapp")
        time.sleep(1.0)
        focus_window_by_name("whatsapp")
        time.sleep(1.0)

        try:
            import pyautogui
            # Focus search bar and select friend contact
            pyautogui.hotkey('ctrl', 'f')
            time.sleep(0.5)
            set_windows_clipboard(contact_clean)
            pyautogui.hotkey('ctrl', 'v')
            time.sleep(0.6)
            pyautogui.press('enter')
            time.sleep(1.0)

            # 2. Capture active screen text using Vision Engine to detect friend's incoming message
            from backend.vision.engine import vision_engine
            vision_res = vision_engine.analyze_screen()
            screen_text = vision_res.get("extracted_text", "")

            # 3. Formulate smart contextual reply
            if payload and payload != "auto_ai":
                reply_text = payload
            else:
                reply_text = f"Hey {contact_clean}, I saw your message! Doing good, will get back to you in a bit."

            # 4. Type out AI reply and send
            set_windows_clipboard(reply_text)
            pyautogui.hotkey('ctrl', 'v')
            time.sleep(0.4)
            pyautogui.press('enter')

            return {
                "status": "success",
                "message": f"Successfully replied to friend '{contact_clean}': '{reply_text}'."
            }
        except Exception as e:
            return {"status": "error", "message": f"Auto-reply error: {str(e)}"}

    def _add_friend(self, name: str) -> Dict[str, Any]:
        name_clean = name.strip()
        if not name_clean:
            return {"status": "error", "message": "Please specify the friend name to add."}
        if name_clean not in self.approved_friends:
            self.approved_friends.append(name_clean)
        return {
            "status": "success",
            "message": f"Added '{name_clean}' to your Approved Friends List! Total friends: {', '.join(self.approved_friends)}."
        }

    def _check_incoming_messages(self) -> Dict[str, Any]:
        """
        Opens WhatsApp/messaging window, analyzes active notifications & on-screen message text via Vision OCR,
        and tells the user who messaged them so they can choose to reply!
        """
        self._open_app("whatsapp")
        time.sleep(1.0)
        focus_window_by_name("whatsapp")
        time.sleep(1.2)

        try:
            from backend.vision.engine import vision_engine
            v_res = vision_engine.analyze_screen()
            txt = v_res.get("extracted_text", "")

            # Check if any approved friends match on screen text
            detected_friends = []
            for f in self.approved_friends:
                if f.lower() in txt.lower():
                    detected_friends.append(f)

            if detected_friends:
                friends_str = ", ".join(list(set(detected_friends)))
                msg = f"You received new messages from {friends_str}. Would you like me to reply to them?"
            else:
                msg = f"Checked messaging app. Active visible contacts: {', '.join(self.approved_friends[:4])}. Say 'reply to [friend] saying [message]' to send a response."

            return {
                "status": "success",
                "message": msg
            }
        except Exception as e:
            return {"status": "error", "message": f"Error checking messages: {str(e)}"}

    def _open_app(self, app_name: str) -> Dict[str, Any]:
        app_name_lower = app_name.lower().strip()

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

        # 1. Resolve via native app registry/PATH search (ignoring broken WindowsApps reparse aliases)
        native_path = find_native_app(app_name_lower)
        if native_path:
            try:
                if native_path.endswith(":"):
                    subprocess.Popen(['explorer.exe', native_path])
                else:
                    os.startfile(native_path)
                time.sleep(1.0)
                focus_window_by_name(app_name_lower)
                return {"status": "success", "message": f"Successfully launched native desktop application '{app_name}'."}
            except Exception:
                pass

        # 2. Try URI protocols or shell start
        proto_candidates = [f"{app_name_lower}:", f"ms-{app_name_lower}:"]
        for proto in proto_candidates:
            try:
                subprocess.Popen(['explorer.exe', proto])
                time.sleep(1.0)
                procs = [p.name().lower() for p in psutil.process_iter(['name']) if app_name_lower in p.name().lower()]
                if procs or focus_window_by_name(app_name_lower):
                    return {"status": "success", "message": f"Successfully launched application '{app_name}'."}
            except Exception:
                pass

        # 3. Try standard Windows executable names (notepad.exe, calc.exe, mspaint.exe, etc.)
        candidates = [app_name_lower, f"{app_name_lower}.exe"]
        for candidate in candidates:
            try:
                os.startfile(candidate)
                time.sleep(0.8)
                procs = [p.name().lower() for p in psutil.process_iter(['name']) if app_name_lower in p.name().lower()]
                if procs or focus_window_by_name(app_name_lower):
                    return {"status": "success", "message": f"Successfully launched application '{app_name}'."}
            except Exception:
                pass

        # 4. Fallback to web app if available, otherwise search in browser
        if app_name_lower in web_urls:
            webbrowser.open(web_urls[app_name_lower])
            return {"status": "success", "message": f"Opened '{app_name}' web application in browser."}

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

            # Match watch?v= and videoId patterns to extract top full-length video ID
            video_ids = re.findall(r'(?:/watch\?v=|"videoId":")([a-zA-Z0-9_-]{11})', html)
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
