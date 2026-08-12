import os
import re
import httpx
from typing import Dict, Any, Optional
from backend.memory.db import get_settings

class AIEngine:
    def __init__(self):
        pass

    def classify_intent(self, text: str) -> Dict[str, Any]:
        """
        Classifies user prompt into structured intent JSON.
        Prevents raw LLM code from executing without validation.
        """
        text_lower = text.lower().strip()
        
        # 0. Vision / Screen Context Intent
        if any(kw in text_lower for kw in [
            "screen", "looking at", "read screen", "check screen", "open on screen",
            "opened in my screen", "running in my screen", "running on my screen",
            "opened on my screen", "on my screen", "my device", "what is opened",
            "what is happening", "screen info", "screen status", "see screen"
        ]):
            return {
                "intent": "vision_analyze_screen",
                "target": "screen",
                "requires_confirmation": False
            }

        # 1. Play Song / Media Intent ("play starboy", "play music on spotify", "play shape of you on youtube")
        if text_lower.startswith("play ") or " play " in text_lower or text_lower.startswith("listen to "):
            query = re.sub(r'^(play|listen to)\s+', '', text_lower).strip()
            return {
                "intent": "play_media",
                "target": query,
                "requires_confirmation": False
            }

        # 2. YouTube Intent
        if "youtube" in text_lower or "yt" in text_lower:
            query = re.sub(r'^(open|launch)?\s*(youtube|yt)\s*(and\s+)?(play|search|find|watch)?\s*', '', text_lower)
            query = re.sub(r'\s+on\s+(youtube|yt)$', '', query).strip()
            if query:
                return {
                    "intent": "play_media",
                    "target": query,
                    "requires_confirmation": False
                }
            return {
                "intent": "open_application",
                "target": "youtube",
                "requires_confirmation": False
            }

        # 3. Spotify Intent
        if "spotify" in text_lower:
            query = re.sub(r'^(open|launch)?\s*spotify\s*(and\s+)?(play|listen to|search)?\s*', '', text_lower)
            query = re.sub(r'\s+on\s+spotify$', '', query).strip()
            if query:
                return {
                    "intent": "play_media",
                    "target": f"{query} on spotify",
                    "requires_confirmation": False
                }
            return {
                "intent": "open_application",
                "target": "spotify",
                "requires_confirmation": False
            }

        # 3. Known Web Destinations (LinkedIn, GitHub, Google, Twitter, Reddit, Instagram)
        web_sites = {
            "linkedin": "https://www.linkedin.com",
            "github": "https://www.github.com",
            "google": "https://www.google.com",
            "twitter": "https://x.com",
            "x.com": "https://x.com",
            "instagram": "https://www.instagram.com",
            "reddit": "https://www.reddit.com",
            "gmail": "https://mail.google.com"
        }
        
        for name, url in web_sites.items():
            if re.search(rf'\b{name}\b', text_lower):
                return {
                    "intent": "open_website",
                    "target": url,
                    "requires_confirmation": False
                }

        # 4. Auto Reply to Friends Intent ("auto reply to Alex", "reply to Mom if she messages", "check and reply to Rahul")
        auto_reply_m = re.search(r'\b(?:auto\s+reply|reply|check\s+and\s+reply)\s+(?:to\s+)?([a-z0-9\s]+?)(?:\s+(?:saying|that|with)\s+(.+))?$', text_lower)
        if auto_reply_m and not text_lower.startswith("send "):
            contact = auto_reply_m.group(1).replace("on whatsapp", "").replace("my friend", "").strip()
            custom_msg = auto_reply_m.group(2).strip() if auto_reply_m.group(2) else "auto_ai"
            return {
                "intent": "auto_reply_friend",
                "target": "whatsapp",
                "contact": contact,
                "payload": custom_msg,
                "requires_confirmation": False
            }

        # 5. In-App Automation Intent (messaging, calling, typing inside apps)
        msg_m = re.search(r'\b(?:send\s+(?:a\s+)?message)\s+(?:to\s+([a-z0-9\s]+?)\s+(?:that|saying)\s+(.+)|(.+?)\s+to\s+([a-z0-9\s]+))', text_lower)
        if msg_m:
            target_app = "whatsapp" if "whatsapp" in text_lower else "whatsapp"
            if msg_m.group(1) and msg_m.group(2):
                contact = msg_m.group(1).replace("on whatsapp", "").replace("in whatsapp", "").strip()
                msg = msg_m.group(2).replace("on whatsapp", "").replace("in whatsapp", "").strip()
            else:
                msg = msg_m.group(3).replace("on whatsapp", "").replace("in whatsapp", "").strip()
                contact = msg_m.group(4).replace("on whatsapp", "").replace("in whatsapp", "").strip()
            return {
                "intent": "in_app_action",
                "target": target_app,
                "action": "send_message",
                "contact": contact,
                "payload": msg,
                "requires_confirmation": False
            }

        tell_m = re.search(r'\b(?:tell|whatsapp|message|text)\s+([a-z0-9\s]+?)\s+(?:that|saying)\s+(.+)', text_lower)
        if tell_m:
            target_app = "whatsapp" if "whatsapp" in text_lower else "whatsapp"
            contact = tell_m.group(1).replace("on whatsapp", "").replace("in whatsapp", "").strip()
            msg = tell_m.group(2).replace("on whatsapp", "").replace("in whatsapp", "").strip()
            return {
                "intent": "in_app_action",
                "target": target_app,
                "action": "send_message",
                "contact": contact,
                "payload": msg,
                "requires_confirmation": False
            }

        in_app_match = re.search(r'\b(open|launch|run|start)?\s*([a-z0-9\s]+?)\s+(and|to)\s+(write|type|send|message|call|text)\s+(.+)', text_lower)
        if in_app_match:
            app_name = in_app_match.group(2).strip()
            action_type = in_app_match.group(4).strip()
            payload = in_app_match.group(5).strip()
            return {
                "intent": "in_app_action",
                "target": app_name,
                "action": action_type,
                "payload": payload,
                "requires_confirmation": False
            }

        # 5. Open Application Intent (Notepad, VS Code, Calc, Chrome, etc.)
        if re.search(r'\b(open|launch|run|start)\s+(app|application|program|software)?\s*(.+)', text_lower):
            match = re.search(r'\b(open|launch|run|start)\s+(app|application|program|software)?\s*(.+)', text_lower)
            raw_target = match.group(3).strip() if match else ""
            
            # Clean compound commands like "open notepad and write..." -> target "notepad"
            target = re.split(r'\s+and\s+', raw_target)[0].strip()
            target = re.sub(r'^(website|url|site|app|application|program|software)\s+', '', target, flags=re.IGNORECASE).strip()
            
            if target.startswith("http") or target.endswith((".com", ".org", ".net", ".io")) or (" " not in target and "." in target):
                return {
                    "intent": "open_website",
                    "target": target,
                    "requires_confirmation": False
                }
            
            return {
                "intent": "open_application",
                "target": target,
                "requires_confirmation": False
            }
            
        # 5. Open Website / Search Intent
        if re.search(r'\b(go to|search|google|visit)\s+(.+)', text_lower):
            match = re.search(r'\b(go to|search|google|visit)\s+(.+)', text_lower)
            target = match.group(2).strip() if match else "google.com"
            return {
                "intent": "open_website",
                "target": target,
                "requires_confirmation": False
            }

        # 6. System Control Intent
        if re.search(r'\b(lock pc|lock computer|shutdown|restart|reboot|turn off|log off)\b', text_lower):
            return {
                "intent": "system_command",
                "target": text_lower,
                "requires_confirmation": True
            }

        # General Chat / Query Intent
        return {
            "intent": "general_chat",
            "target": text,
            "requires_confirmation": False
        }

    async def generate_llm_response(self, prompt: str, settings: Optional[Dict[str, Any]] = None) -> str:
        if not settings:
            settings = get_settings()

        from backend.memory.db import get_history, get_lifetime_facts, save_lifetime_fact
        from backend.memory.mongo import mongo_storage

        # Auto-detect lifetime fact storage commands (e.g., "remember that...", "my name is...", "keep in memory...")
        prompt_lower = prompt.lower().strip()
        if any(kw in prompt_lower for kw in ["remember that", "remember:", "my name is", "my preferred", "keep in memory"]):
            fact_key = f"fact_{int(os.urandom(4).hex(), 16)}"
            save_lifetime_fact(fact_key, prompt)
            mongo_storage.save_lifetime_fact(fact_key, prompt)

        # Build context messages from past SQLite history and lifetime facts
        history = get_history(limit=10)
        lifetime_facts = get_lifetime_facts()
        
        system_content = (
            "You are BYTE (Beyond Your Tactical Envelope), an advanced natural-language tactical AI desktop assistant. "
            "Always remember past context from previous turns in the conversation to provide coherent, helpful, and contextual responses."
        )

        if lifetime_facts:
            facts_str = "\n".join([f"- {f['fact']}" for f in lifetime_facts])
            system_content += f"\n\n[BYTE PERMANENT LIFETIME MEMORY (LIFETIME FACTS)]:\n{facts_str}"

        messages = [
            {
                "role": "system",
                "content": system_content
            }
        ]
        
        for msg in history:
            role = "assistant" if msg.get("role") in ["byte", "assistant"] else "user"
            messages.append({"role": role, "content": msg.get("content", "")})
            
        messages.append({"role": "user", "content": prompt})

        # AI Provider selection
        provider = settings.get("ai_provider", "ollama")
        groq_model = settings.get("groq_model", "llama-3.1-8b-instant")
        if groq_model in ["groq/compound", "groq/compound-mini", "minimaxai/minimax-m2.7"]:
            groq_model = "llama-3.1-8b-instant"
        groq_api_key = settings.get("groq_api_key", "")
        openrouter_model = settings.get("openrouter_model", "liquid/lfm-2.5-2.6b:free")
        openrouter_api_key = settings.get("openrouter_api_key", "")

        if provider == "ollama":
            response = await self._query_ollama(messages, settings.get("ollama_model", "llama3"))
            if not (response.startswith("[Ollama Offline]") or response.startswith("[Ollama Warning]") or response.startswith("[Ollama Error]")):
                return response
            
            # Local Ollama is offline; automatically fall back to Groq Cloud or OpenRouter
            groq_resp = await self._query_groq(messages, groq_model, groq_api_key)
            if not groq_resp.startswith("[Groq") and not groq_resp.startswith("[BYTE System]"):
                return f"[Local AI -> Cloud Fallback] {groq_resp}"
            return response
            
        elif provider == "groq":
            return await self._query_groq(messages, groq_model, groq_api_key)
        elif provider == "openrouter":
            return await self._query_openrouter(messages, openrouter_model, openrouter_api_key)
        else:
            return f"[BYTE System] AI provider '{provider}' selected. Standing by for inference."

    async def _query_openrouter(self, messages: list, model: str, api_key: Optional[str] = None) -> str:
        if not api_key:
            api_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("VITE_OPENROUTER_API_KEY") or ""
            
        headers = {
            "Content-Type": "application/json",
            "HTTP-Referer": "https://byte-ai.local",
            "X-Title": "BYTE AI Assistant"
        }
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        payload = {
            "model": model,
            "messages": messages,
            "temperature": 0.7
        }

        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                res = await client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    choices = data.get("choices", [])
                    if choices:
                        return choices[0].get("message", {}).get("content", "").strip()
                    return "[OpenRouter Error] Empty choices returned from API."
                else:
                    # Fallback attempt with default free model if custom model fails
                    if model != "liquid/lfm-2.5-2.6b:free":
                        payload["model"] = "liquid/lfm-2.5-2.6b:free"
                        res_fallback = await client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
                        if res_fallback.status_code == 200:
                            data = res_fallback.json()
                            choices = data.get("choices", [])
                            if choices:
                                return f"[OpenRouter Fallback] {choices[0].get('message', {}).get('content', '').strip()}"

                    return f"[OpenRouter HTTP {res.status_code}] {res.text}"
        except Exception as e:
            return f"[OpenRouter Error] Could not connect to OpenRouter endpoint: {str(e)}"

    async def _query_ollama(self, messages: list, model: str) -> str:
        tag_map = {
            "llama3": "llama3",
            "qwen2": "qwen2",
            "gemma2": "gemma2",
            "deepseek-coder": "deepseek-coder"
        }
        target_model = tag_map.get(model, model)
        
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                # Try chat endpoint first
                try:
                    res = await client.post("http://127.0.0.1:11434/api/chat", json={
                        "model": target_model,
                        "messages": messages,
                        "stream": False
                    })
                    if res.status_code == 200:
                        data = res.json()
                        content = data.get("message", {}).get("content")
                        if content:
                            return content
                except Exception:
                    pass

                # Fallback to generate endpoint
                prompt_str = "\n".join([f"{m['role'].upper()}: {m['content']}" for m in messages])
                res2 = await client.post("http://127.0.0.1:11434/api/generate", json={
                    "model": target_model,
                    "prompt": prompt_str,
                    "stream": False
                })
                if res2.status_code == 200:
                    return res2.json().get("response", "No response from Ollama.")
                    
                if res2.status_code == 404:
                    return f"[Ollama Warning] Model '{target_model}' is not pulled locally. Open CMD and run: ollama pull {target_model}"
                    
                return f"[Ollama Error] HTTP Status {res2.status_code}"
        except Exception as e:
            return f"[Ollama Offline] Local Ollama service is not active on http://127.0.0.1:11434. Please install/start Ollama (https://ollama.com)."

    async def _query_groq(self, messages: list, model: str, api_key: Optional[str] = None) -> str:
        if not api_key:
            api_key = os.environ.get("VITE_GROQ_API_KEY") or os.environ.get("GROQ_API_KEY", "")
        
        if not api_key:
            # Check if OpenRouter key is set
            openrouter_api_key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("VITE_OPENROUTER_API_KEY") or ""
            if openrouter_api_key:
                return await self._query_openrouter(messages, "liquid/lfm-2.5-2.6b:free", openrouter_api_key)
            
            # Intelligent response + clear guidance when no cloud API key is set yet
            user_last = messages[-1]["content"] if messages else ""
            if user_last.strip().lower() in ["hi", "hello", "hey", "test", "ping"]:
                return (
                    f"Hello! BYTE Assistant is online and operational.\n\n"
                    "⚙️ **Cloud AI Key Notice**:\n"
                    "You currently have **Groq Cloud** selected, but no Groq API Key has been entered yet.\n\n"
                    "**To enable full Cloud AI responses:**\n"
                    "1. Click **SETTINGS** (top right) -> **AI Engine** -> Paste your free Groq key (`gsk_...`).\n"
                    "2. Or click the dropdown above Communication Log and switch to **Ollama (100% Free Offline Local AI)**."
                )
            
            return (
                f"[BYTE System] Groq Cloud selected, but no API Key found.\n\n"
                "Please paste your free Groq API key (`gsk_...`) in **SETTINGS -> AI Engine**, or switch to **Ollama** or **OpenRouter** in the top model dropdown menu."
            )
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={
                        "model": model,
                        "messages": messages,
                        "max_tokens": 512
                    }
                )
                if res.status_code == 200:
                    data = res.json()
                    return data["choices"][0]["message"]["content"]
                
                # If key invalid or quota exceeded, attempt free OpenRouter fallback
                openrouter_resp = await self._query_openrouter(messages, "liquid/lfm-2.5-2.6b:free", None)
                if not openrouter_resp.startswith("[OpenRouter"):
                    return openrouter_resp

                return f"[Groq Error] API error HTTP {res.status_code}: {res.text}"
        except Exception as e:
            return f"[Groq Connection Error] {str(e)}"

ai_engine = AIEngine()
