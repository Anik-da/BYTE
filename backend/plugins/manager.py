import os
from typing import Dict, Any, List

class PluginManager:
    """
    Dynamic Plugin Manager for BYTE Desktop.
    Loads and manages system automation plugins (VS Code, Chrome Bridge, Discord, Spotify).
    """
    def __init__(self):
        self.registered_plugins = {
            "vscode_automation": {"name": "VS Code Automation", "active": True, "version": "1.0.0"},
            "chrome_bridge": {"name": "Chrome Browser Bridge", "active": True, "version": "1.0.0"},
            "discord_telemetry": {"name": "Discord Telemetry", "active": True, "version": "1.0.0"},
            "spotify_player": {"name": "Spotify Player Control", "active": True, "version": "1.0.0"}
        }

    def list_plugins(self) -> List[Dict[str, Any]]:
        return list(self.registered_plugins.values())

    def toggle_plugin(self, plugin_id: str, active: bool) -> Dict[str, Any]:
        if plugin_id in self.registered_plugins:
            self.registered_plugins[plugin_id]["active"] = active
            return {"status": "success", "plugin": self.registered_plugins[plugin_id]}
        return {"status": "error", "message": f"Plugin '{plugin_id}' not found."}

plugin_manager = PluginManager()
