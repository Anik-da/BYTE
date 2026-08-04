import os
import subprocess
from typing import Dict, Any, List, Optional

class DeveloperEngine:
    """
    Developer Mode Automation Engine for BYTE.
    Integrates VS Code, Git, GitHub, Docker, npm/pnpm, Python, Arduino, and workspace analytics.
    """
    def __init__(self):
        pass

    def get_git_status(self, repo_path: str) -> Dict[str, Any]:
        """
        Queries git branch and status for a target workspace folder.
        """
        if not os.path.exists(repo_path):
            return {"status": "error", "message": "Workspace path does not exist."}

        try:
            branch = subprocess.check_output(
                "git rev-parse --abbrev-ref HEAD", cwd=repo_path, shell=True, text=True
            ).strip()
            status_output = subprocess.check_output(
                "git status -s", cwd=repo_path, shell=True, text=True
            ).strip()
            return {
                "status": "success",
                "branch": branch,
                "changes_count": len(status_output.splitlines()) if status_output else 0,
                "raw_status": status_output
            }
        except Exception as e:
            return {"status": "error", "message": f"Git command failed: {str(e)}"}

    def open_vscode_workspace(self, path: str) -> Dict[str, Any]:
        """
        Opens a project workspace in VS Code.
        """
        try:
            subprocess.Popen(f'code "{path}"', shell=True)
            return {"status": "success", "message": f"Opened VS Code workspace: {path}"}
        except Exception as e:
            return {"status": "error", "message": f"Failed to launch VS Code: {str(e)}"}

    def analyze_workspace(self, path: str) -> Dict[str, Any]:
        """
        Analyzes project dependencies and stack type (React, Node, Python, Tauri, Rust).
        """
        if not os.path.exists(path):
            return {"status": "error", "message": "Path does not exist."}

        stack = []
        if os.path.exists(os.path.join(path, "package.json")):
            stack.append("Node.js / React Frontend")
        if os.path.exists(os.path.join(path, "requirements.txt")) or os.path.exists(os.path.join(path, "main.py")):
            stack.append("Python FastAPI Backend")
        if os.path.exists(os.path.join(path, "Cargo.toml")) or os.path.exists(os.path.join(path, "src-tauri")):
            stack.append("Tauri Rust Desktop Shell")
        if os.path.exists(os.path.join(path, "platformio.ini")):
            stack.append("PlatformIO Embedded C++")
        if os.path.exists(os.path.join(path, "Dockerfile")):
            stack.append("Docker Containerized")

        return {
            "status": "success",
            "workspace": path,
            "detected_stack": stack if stack else ["Generic Workspace"]
        }

developer_engine = DeveloperEngine()
