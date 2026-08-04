import os
import subprocess
import webbrowser
from typing import Dict, Any, Optional

class BrowserAutomation:
    """
    Production-Ready Browser Automation Module for BYTE.
    Supports Chrome, Edge, Firefox, search queries, GitHub, Stack Overflow, and form automation.
    """
    def __init__(self):
        self.preferred_browser = "chrome"

    def open_url(self, url: str, browser: Optional[str] = None) -> Dict[str, Any]:
        """
        Opens a target web URL in the specified browser (Chrome, Edge, Firefox, or Default).
        """
        if not url.startswith(("http://", "https://")):
            url = f"https://{url}"

        browser_choice = (browser or self.preferred_browser).lower()

        try:
            if browser_choice == "chrome":
                chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
                if os.path.exists(chrome_path):
                    subprocess.Popen([chrome_path, url])
                    return {"status": "success", "message": f"Opened {url} in Google Chrome"}
            
            elif browser_choice == "edge":
                edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
                if os.path.exists(edge_path):
                    subprocess.Popen([edge_path, url])
                    return {"status": "success", "message": f"Opened {url} in Microsoft Edge"}

            webbrowser.open(url)
            return {"status": "success", "message": f"Opened {url} in default browser"}
        except Exception as e:
            return {"status": "error", "message": f"Failed to open browser URL: {str(e)}"}

    def search_google(self, query: str) -> Dict[str, Any]:
        url = f"https://www.google.com/search?q={query}"
        return self.open_url(url)

    def search_youtube(self, query: str) -> Dict[str, Any]:
        url = f"https://www.youtube.com/results?search_query={query}"
        return self.open_url(url)

    def open_github(self, repo_path: Optional[str] = None) -> Dict[str, Any]:
        url = f"https://github.com/{repo_path}" if repo_path else "https://github.com"
        return self.open_url(url)

    def open_stackoverflow(self, query: Optional[str] = None) -> Dict[str, Any]:
        if query:
            url = f"https://stackoverflow.com/search?q={query}"
        else:
            url = "https://stackoverflow.com"
        return self.open_url(url)

browser_automation = BrowserAutomation()
