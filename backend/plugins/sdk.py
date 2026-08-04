from typing import Dict, Any, List, Callable, Optional

class PluginManifest:
    def __init__(self, plugin_id: str, name: str, version: str, description: str, permissions: List[str]):
        self.id = plugin_id
        self.name = name
        self.version = version
        self.description = description
        self.permissions = permissions

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "version": self.version,
            "description": self.description,
            "permissions": self.permissions
        }

class BytePluginBase:
    """
    Base Class for all BYTE Plugins (Spotify, Discord, GitHub, Steam, OBS, Telegram, Notion, etc.).
    """
    def __init__(self, manifest: PluginManifest):
        self.manifest = manifest
        self.is_enabled = True
        self.settings: Dict[str, Any] = {}
        self.actions: Dict[str, Callable[..., Any]] = {}

    def register_action(self, action_name: str, handler: Callable[..., Any]):
        self.actions[action_name] = handler

    def execute_action(self, action_name: str, **kwargs) -> Dict[str, Any]:
        if not self.is_enabled:
            return {"status": "error", "message": f"Plugin '{self.manifest.name}' is currently disabled."}
        if action_name not in self.actions:
            return {"status": "error", "message": f"Action '{action_name}' not supported by plugin '{self.manifest.name}'."}
        try:
            res = self.actions[action_name](**kwargs)
            return {"status": "success", "result": res}
        except Exception as e:
            return {"status": "error", "message": f"Action execution failed: {str(e)}"}

    def on_load(self):
        pass

    def on_unload(self):
        pass
