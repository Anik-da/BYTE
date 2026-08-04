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
        
        # Open Application Intent (dynamic for any application name)
        if re.search(r'\b(open|launch|run|start)\s+(app|application|program|software)?\s*(.+)', text_lower):
            match = re.search(r'\b(open|launch|run|start)\s+(app|application|program|software)?\s*(.+)', text_lower)
            target = match.group(3).strip() if match else ""
            
            # Check if target is a website URL or web search keyword
            if target.startswith("http") or target.endswith((".com", ".org", ".net", ".io")) or " " not in target and "." in target:
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
            
        # Open Website / Search Intent
        if re.search(r'\b(go to|search|google|visit)\s+(.+)', text_lower):
            match = re.search(r'\b(go to|search|google|visit)\s+(.+)', text_lower)
            target = match.group(2).strip() if match else "google.com"
            return {
                "intent": "open_website",
                "target": target,
                "requires_confirmation": False
            }

        # System Control Intent
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

        # Local AI First
        provider = settings.get("ai_provider", "ollama")
        
        if provider == "ollama":
            response = await self._query_ollama(prompt, settings.get("ollama_model", "llama3"))
            if not response.startswith("[Ollama Unavailable]"):
                return response
            
            # Local Ollama is offline; automatically fall back to Groq Cloud
            groq_resp = await self._query_groq(prompt, settings.get("groq_model", "groq/compound"))
            if not groq_resp.startswith("[Groq"):
                return f"[Local AI -> Cloud Fallback] {groq_resp}"
            return response
            
        elif provider == "groq":
            return await self._query_groq(prompt, settings.get("groq_model", "groq/compound"))
        else:
            return f"[BYTE System] AI provider '{provider}' selected. Standing by for inference."

    async def _query_ollama(self, prompt: str, model: str) -> str:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post("http://localhost:11434/api/generate", json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False
                })
                if res.status_code == 200:
                    return res.json().get("response", "No response from Ollama.")
                return f"[Ollama Error] Received status code {res.status_code}"
        except Exception as e:
            return f"[Ollama Unavailable] Could not connect to local Ollama instance on port 11434 ({str(e)})"

    async def _query_groq(self, prompt: str, model: str) -> str:
        api_key = os.environ.get("VITE_GROQ_API_KEY") or os.environ.get("GROQ_API_KEY", "")
        if not api_key:
            return "[BYTE System] Groq API key is not set. Please update AI Settings."
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": "You are BYTE, an advanced AI desktop assistant. Keep responses helpful and concise."},
                            {"role": "user", "content": prompt}
                        ],
                        "max_tokens": 512
                    }
                )
                if res.status_code == 200:
                    data = res.json()
                    return data["choices"][0]["message"]["content"]
                return f"[Groq Error] API error HTTP {res.status_code}"
        except Exception as e:
            return f"[Groq Connection Error] {str(e)}"

ai_engine = AIEngine()
