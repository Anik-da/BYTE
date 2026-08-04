import os
from typing import Dict, Any
from backend.memory.db import get_settings, save_settings

class ConfigManager:
    """
    Central Configuration Manager for BYTE.
    Handles environment variables, SQLite persistent settings, and hardware defaults.
    """
    def __init__(self):
        self._defaults = {
            "ai_provider": "ollama",  # Local AI First
            "ollama_model": "llama3",
            "groq_model": "groq/compound",
            "wake_word_enabled": True,
            "auto_launch": False,
            "auto_update": True,
            "theme": "hud-red",
            "gpu_acceleration": True,
            "primary_gpu": "NVIDIA GeForce RTX 4060",
        }

    def get_config(self) -> Dict[str, Any]:
        """
        Loads saved settings from SQLite database merged with defaults and env vars.
        """
        saved = get_settings()
        config = self._defaults.copy()
        config.update(saved)
        
        # Environment overrides
        if os.environ.get("VITE_GROQ_API_KEY"):
            config["groq_api_key_set"] = True
        return config

    def update_config(self, new_settings: Dict[str, Any]) -> Dict[str, Any]:
        """
        Updates persistent settings in local SQLite store.
        """
        save_settings(new_settings)
        return self.get_config()

config_manager = ConfigManager()

def get_config_dependency() -> Dict[str, Any]:
    """FastAPI Dependency Injection for application configuration."""
    return config_manager.get_config()
