import asyncio
import os
import re
import httpx
from typing import Dict, Any, Optional
from backend.memory.db import get_settings

ACTIVE_GROQ_MODELS = [
    {"id": "openai/gpt-oss-120b", "label": "OpenAI GPT-OSS 120B (131k Context)"},
    {"id": "openai/gpt-oss-20b", "label": "OpenAI GPT-OSS 20B (Fast - 131k Context)"},
    {"id": "qwen/qwen3.8-27b", "label": "Qwen 3.8 27B (131k Context)"},
    {"id": "allam-2-7b", "label": "ALLaM 2 7B (Lightweight - 4k Context)"},
]

LEGACY_GROQ_MAP = {
    "groq/compound": "openai/gpt-oss-120b",
    "groq/compound-mini": "openai/gpt-oss-20b",
    "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
    "llama-3.1-8b-instant": "openai/gpt-oss-20b",
    "llama3-70b-8192": "openai/gpt-oss-120b",
    "llama3-8b-8192": "openai/gpt-oss-20b",
    "mixtral-8x7b-32768": "qwen/qwen3.8-27b",
    "gemma2-9b-it": "openai/gpt-oss-20b",
}


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
        if re.search(r'\b(youtube|yt)\b', text_lower):
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

        # 4. Check Incoming Messages Intent ("who messaged me", "check my messages", "did anyone message me", "read new messages")
        if re.search(r'\b(?:who\s+(?:has\s+)?messaged?\s+me|who\s+sent\s+(?:a\s+)?message|check\s+(?:my\s+)?messages?|read\s+(?:my\s+)?messages?|did\s+anyone\s+message\s+me|unread\s+messages?)\b', text_lower):
            return {
                "intent": "check_incoming_messages",
                "target": "whatsapp",
                "requires_confirmation": False
            }

        # 5. Add Friend to Friends List Intent ("add Alex to my friends list", "add Mom to my friends")
        add_friend_m = re.search(r'\b(?:add|include)\s+([a-z0-9\s]+?)\s+(?:to\s+my\s+friends?\s*(?:list)?|as\s+(?:a\s+)?friend)\b', text_lower)
        if add_friend_m:
            friend_name = add_friend_m.group(1).strip()
            return {
                "intent": "add_friend",
                "target": friend_name,
                "requires_confirmation": False
            }

        # 6. Auto Reply to Friends Intent ("auto reply to Alex", "reply to Mom if she messages", "check and reply to Rahul")
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
        # Specific match for "type/write <msg> in/on/at <app>"
        type_in_app_m = re.search(r'\b(?:type|write)\s+(.+?)\s+(?:in|on|at|inside)\s+([a-z0-9\s]+?)$', text_lower)
        if type_in_app_m:
            msg = type_in_app_m.group(1).strip()
            target_app = type_in_app_m.group(2).strip()
            return {
                "intent": "in_app_action",
                "target": target_app,
                "action": "type",
                "payload": msg,
                "requires_confirmation": False
            }

        # Specific match for "type/send message to <contact> in/on <app> as <msg>"
        type_msg_m = re.search(r'\b(?:type|send|write)\s+(?:a\s+)?(?:message|msg|text)?\s*(?:to\s+([a-z0-9\s]+?)\s+)?(?:in|on|at|inside)\s+([a-z0-9\s]+?)\s+(?:as|that|saying)\s+(.+)', text_lower)
        if type_msg_m:
            contact = type_msg_m.group(1).strip() if type_msg_m.group(1) else ""
            target_app = type_msg_m.group(2).strip()
            msg = type_msg_m.group(3).strip()
            return {
                "intent": "in_app_action",
                "target": target_app,
                "action": "send_message",
                "contact": contact,
                "payload": msg,
                "requires_confirmation": False
            }

        # Specific match for "type/send <msg> to <contact> in/on <app>"
        type_msg_to_m = re.search(r'\b(?:type|send|write)\s+(.+?)\s+to\s+([a-z0-9\s]+?)\s+(?:in|on|at|inside)\s+([a-z0-9\s]+?)$', text_lower)
        if type_msg_to_m:
            msg = type_msg_to_m.group(1).strip()
            contact = type_msg_to_m.group(2).strip()
            target_app = type_msg_to_m.group(3).strip()
            return {
                "intent": "in_app_action",
                "target": target_app,
                "action": "send_message",
                "contact": contact,
                "payload": msg,
                "requires_confirmation": False
            }

        msg_m = re.search(r'\b(?:send\s+(?:a\s+)?message)\s+(?:to\s+([a-z0-9\s]+?)\s*(?:that|saying|:)\s*(.+)|to\s+([a-z0-9\s]+?)\s+(.+)|(.+?)\s+to\s+([a-z0-9\s]+))', text_lower)
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

        tell_m = re.search(r'\b(?:tell|whatsapp|message|text)\s+([a-z0-9\s]+?)\s+(?:that|saying|:)?\s*(.+)', text_lower)
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
            
            if (target.startswith("http") or target.endswith((".com", ".org", ".net", ".io", ".edu", ".gov"))) and not target.endswith((".exe", ".bat", ".cmd", ".lnk", ".py")):
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
            "You are BYTE (Beyond Your Tactical Envelope), an advanced natural-language tactical AI desktop assistant running on the user's Windows machine. "
            "You are capable of:\n"
            "- Writing code in any language (Python, JavaScript, C++, Rust, etc.) with clear explanations\n"
            "- System analysis, debugging, and troubleshooting\n"
            "- Explaining technical concepts, algorithms, and architectures\n"
            "- Helping with DevOps, networking, databases, and cloud infrastructure\n"
            "- General knowledge, math, science, creative writing, and research\n"
            "- Providing concise tactical intelligence on any topic\n\n"
            "When writing code, use markdown code blocks with language tags. Keep responses helpful, precise, and technically accurate. "
            "Always remember past context from previous turns in the conversation to provide coherent, contextual responses."
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
        
        for msg in history[-6:]:
            role = "assistant" if msg.get("role") in ["byte", "assistant"] else "user"
            content = msg.get("content", "")
            if len(content) > 1200:
                content = content[:1200] + "... [truncated]"
            messages.append({"role": role, "content": content})
            
        messages.append({"role": "user", "content": prompt[:3000]})

        # AI Provider selection
        provider = settings.get("ai_provider", "groq")
        groq_model = LEGACY_GROQ_MAP.get(settings.get("groq_model", ""), settings.get("groq_model", "openai/gpt-oss-120b")) or "openai/gpt-oss-120b"
        groq_api_key = settings.get("groq_api_key", "")
        openrouter_model = settings.get("openrouter_model", "liquid/lfm-2.5-2.6b:free")
        openrouter_api_key = settings.get("openrouter_api_key", "")

        if provider == "ollama":
            response = await self._query_ollama(messages, settings.get("ollama_model", "qwen2.5:0.5b"))
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

    async def _ensure_ollama_running(self) -> None:
        """Starts local Ollama service detached if not already listening on 11434."""
        import shutil, subprocess, sys
        ollama_bin = shutil.which("ollama")
        if not ollama_bin and sys.platform == "win32":
            candidate = os.path.expandvars(r"%LOCALAPPDATA%\Programs\Ollama\ollama.exe")
            if os.path.exists(candidate):
                ollama_bin = candidate
        if not ollama_bin:
            return
        flags = (0x00000008 | 0x08000000) if sys.platform == "win32" else 0
        try:
            subprocess.Popen(
                [ollama_bin, "serve"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=flags,
            )
            await asyncio.sleep(2.5)
        except Exception:
            pass

    async def _query_ollama(self, messages: list, model: str) -> str:
        target_model = (model or "qwen2.5:0.5b").strip()

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                # Auto-start local Ollama server if not currently listening
                try:
                    await client.get("http://127.0.0.1:11434/api/tags", timeout=2.5)
                except Exception:
                    await self._ensure_ollama_running()

                # If requested model isn't installed, automatically pick an installed local model
                try:
                    tags_res = await client.get("http://127.0.0.1:11434/api/tags", timeout=4.0)
                    if tags_res.status_code == 200:
                        installed = [m.get("name", "") for m in tags_res.json().get("models", []) if m.get("name")]
                        if installed and target_model not in installed and f"{target_model}:latest" not in installed:
                            base_matches = [m for m in installed if m.split(":")[0] == target_model.split(":")[0]]
                            target_model = base_matches[0] if base_matches else installed[0]
                except Exception:
                    pass

                # Try chat endpoint first
                res = await client.post("http://127.0.0.1:11434/api/chat", json={
                    "model": target_model,
                    "messages": messages,
                    "stream": False,
                    "keep_alive": "30m",
                })
                if res.status_code == 200:
                    data = res.json()
                    content = (data.get("message", {}).get("content") or "").strip()
                    content = re.sub(r"<think>[\s\S]*?</think>", "", content).strip()
                    if content:
                        return content

                if res.status_code == 404:
                    return f"[Ollama Warning] Model '{target_model}' is not pulled locally. Run: ollama pull {target_model}"

                # Fallback to generate endpoint
                prompt_str = "\n".join([f"{m['role'].upper()}: {m['content']}" for m in messages])
                res2 = await client.post("http://127.0.0.1:11434/api/generate", json={
                    "model": target_model,
                    "prompt": prompt_str,
                    "stream": False,
                    "keep_alive": "30m",
                })
                if res2.status_code == 200:
                    resp_text = (res2.json().get("response") or "").strip()
                    resp_text = re.sub(r"<think>[\s\S]*?</think>", "", resp_text).strip()
                    return resp_text or "No response from Ollama."

                if res2.status_code == 404:
                    return f"[Ollama Warning] Model '{target_model}' is not pulled locally. Run: ollama pull {target_model}"

                return f"[Ollama Error] HTTP Status {res2.status_code}"
        except httpx.TimeoutException:
            return "[Ollama Error] Local Ollama model load timed out. Please retry once warm."
        except Exception:
            return "[Ollama Offline] Local Ollama service is not active on http://127.0.0.1:11434. Please install/start Ollama (https://ollama.com)."

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
        
        # Resolve current active Groq model ID (mapping any discontinued legacy model IDs)
        requested_model = (model or "openai/gpt-oss-120b").strip()
        groq_model_id = LEGACY_GROQ_MAP.get(requested_model, requested_model)

        # Cap message size to prevent HTTP 413 Entity Too Large
        safe_messages = []
        for msg in messages:
            content = msg.get("content", "")
            if len(content) > 1200:
                content = content[:1200] + "... [truncated]"
            safe_messages.append({"role": msg.get("role", "user"), "content": content})

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={
                        "model": groq_model_id,
                        "messages": safe_messages,
                        "max_tokens": 2048
                    }
                )
                if res.status_code == 200:
                    data = res.json()
                    msg_obj = data["choices"][0]["message"]
                    reply = (msg_obj.get("content") or "").strip()
                    reply = re.sub(r"<think>[\s\S]*?</think>", "", reply).strip()
                    if reply:
                        return reply
                    reasoning = (msg_obj.get("reasoning") or "").strip()
                    if reasoning:
                        return reasoning

                # Handle model deprecation (404), bad request (400), or payload too large (413) with active fallback
                if res.status_code in [400, 404, 413]:
                    ultra_lean = [
                        {"role": "system", "content": "You are BYTE AI assistant. Answer concisely."},
                        {"role": "user", "content": messages[-1]["content"][:800] if messages else "Hello"}
                    ]
                    retry_model = "openai/gpt-oss-20b" if groq_model_id != "openai/gpt-oss-20b" else "qwen/qwen3.8-27b"
                    res_lean = await client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                        json={
                            "model": retry_model,
                            "messages": safe_messages if res.status_code in [400, 404] else ultra_lean,
                            "max_tokens": 2048
                        }
                    )
                    if res_lean.status_code == 200:
                        reply2 = (res_lean.json()["choices"][0]["message"].get("content") or "").strip()
                        return re.sub(r"<think>[\s\S]*?</think>", "", reply2).strip() or "Response received."

                # If key invalid or quota exceeded, attempt free OpenRouter fallback
                openrouter_resp = await self._query_openrouter(safe_messages, "liquid/lfm-2.5-2.6b:free", None)
                if not openrouter_resp.startswith("[OpenRouter"):
                    return openrouter_resp

                return f"[Groq Error] API error HTTP {res.status_code}: {res.text}"
        except Exception as e:
            return f"[Groq Connection Error] {str(e)}"

ai_engine = AIEngine()
