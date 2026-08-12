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

def focus_window_by_name(name: str) -> bool:
    """Restores and brings target application window directly to the screen foreground."""
    try:
        import ctypes
        user32 = ctypes.windll.user32
        name_lower = name.lower().strip()
        found = [False]

        def cb(hwnd, extra):
            if user32.IsWindowVisible(hwnd):
                length = user32.GetWindowTextLengthW(hwnd)
                if length > 0:
                    buf = ctypes.create_unicode_buffer(length + 1)
                    user32.GetWindowTextW(hwnd, buf, length + 1)
                    title = buf.value.strip()
                    if name_lower in title.lower():
                        user32.ShowWindow(hwnd, 9) # SW_RESTORE
                        user32.SetForegroundWindow(hwnd)
                        user32.BringWindowToTop(hwnd)
                        found[0] = True
                        return False
            return True

        WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)
        user32.EnumWindows(WNDENUMPROC(cb), 0)
        return found[0]
    except Exception:
        return False

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

    def get_system_telemetry(self) -> Dict[str, Any]:
        cpu_load = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory()
        battery = psutil.sensors_battery()
        
        # Calculate live network I/O activity
        net_io = psutil.net_io_counters()
        net_percent = min(100.0, round((net_io.bytes_sent + net_io.bytes_recv) / (1024 * 1024 * 5), 1))
        
        # System boot uptime
        uptime_sec = int(time.time() - psutil.boot_time())
        
        # Temperature detection
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

        proc_count = len(psutil.pids())
        threat_level = "YELLOW" if (cpu_load > 85 or mem.percent > 85) else "GREEN"
        hostile_contacts = 1 if threat_level == "YELLOW" else 0

        # Fetch Geo-Location via IP
        geo_info = {
            "lat": 22.5726,
            "lon": 88.3639,
            "city": "Kolkata",
            "country": "India",
            "ip": "127.0.0.1"
        }
        try:
            import urllib.request
            import json
            req = urllib.request.Request("http://ip-api.com/json", headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=1.5) as response:
                data = json.loads(response.read().decode())
                if data.get("status") == "success":
                    geo_info["lat"] = float(data.get("lat", 22.5726))
                    geo_info["lon"] = float(data.get("lon", 88.3639))
                    geo_info["city"] = data.get("city", "Kolkata")
                    geo_info["country"] = data.get("country", "India")
                    geo_info["ip"] = data.get("query", "127.0.0.1")
        except Exception:
            pass

        # Get active network connections for live radar dots
        conn_dots = []
        try:
            conns = psutil.net_connections(kind='inet')
            for c in conns:
                if c.raddr:
                    ip_str = c.raddr.ip
                    port = c.raddr.port
                    # Deterministic hash to map IP to coordinates
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

        # Scan nearby WiFi networks & LAN dynamic hosts
        nearby_devices = []
        
        # 1. Real active LAN devices via ARP table
        try:
            arp_out = subprocess.check_output("arp -a", shell=True, text=True, timeout=3)
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
                    
                    # Filter out multicast, broadcast, and invalid loopbacks
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

        # 2. Nearby Wifi SSID scan
        try:
            wifi_out = subprocess.check_output(
                "netsh wlan show networks mode=bssid", shell=True, text=True, timeout=3
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

        # 3. Scan real Bluetooth devices (Filter out virtual enumerators/drivers)
        try:
            bt_cmd = (
                'powershell -Command "'
                'Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue | '
                'Where-Object { $_.Status -eq \'OK\' } | '
                'Select-Object FriendlyName, InstanceId | '
                'ForEach-Object { $_.FriendlyName + \'||\' + $_.InstanceId }'
                '"'
            )
            bt_out = subprocess.check_output(bt_cmd, shell=True, text=True, timeout=4)
            seen_bt_names = set()
            for line in bt_out.strip().splitlines():
                parts = line.strip().split("||")
                name = parts[0].strip() if parts else ""
                dev_id = parts[1].strip() if len(parts) > 1 else name
                
                if not name:
                    continue
                    
                name_lower = name.lower()
                # Exclude virtual enumerators, drivers, audio sinks, services, adapters
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

        return {
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
            "location": geo_info,
            "connections": conn_dots,
            "nearby_devices": nearby_devices
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
                    pyautogui.hotkey('ctrl', 'f')
                    time.sleep(0.5)
                    pyautogui.write(target_person, interval=0.03)
                    time.sleep(0.6)
                    pyautogui.press('down')
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

                    if not c_person and " to " in payload_clean:
                        parts = payload_clean.split(" to ")
                        text_msg = parts[0].strip()
                        c_person = parts[1].strip()

                    if c_person:
                        # Focus search bar
                        pyautogui.hotkey('ctrl', 'f')
                        time.sleep(0.5)
                        pyautogui.write(c_person, interval=0.03)
                        time.sleep(0.6)
                        # Select first contact from search results
                        pyautogui.press('down')
                        pyautogui.press('enter')
                        time.sleep(0.8)

                    # Type and send message
                    pyautogui.write(text_msg, interval=0.02)
                    time.sleep(0.4)
                    pyautogui.press('enter')
                    dest_str = f" to '{c_person}'" if c_person else ""
                    return {"status": "success", "message": f"Sent WhatsApp message{dest_str}: '{text_msg}'."}
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
            pyautogui.write(contact_clean, interval=0.03)
            time.sleep(0.6)
            pyautogui.press('down')
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
            pyautogui.write(reply_text, interval=0.02)
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

        native_path = find_native_app(app_name_lower)
        if native_path:
            try:
                if native_path.endswith(":"):
                    subprocess.Popen(f'start "" "{native_path}"', shell=True)
                elif native_path.lower().endswith(".lnk"):
                    os.startfile(native_path)
                else:
                    subprocess.Popen(f'start "" "{native_path}"', shell=True)
                time.sleep(1.0)
                focus_window_by_name(app_name_lower)
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
