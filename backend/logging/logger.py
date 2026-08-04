import os
import sys
import logging
import traceback
from typing import Dict, Any, Optional

LOG_DIR = os.path.join(os.path.expanduser("~"), "AppData", "Local", "BYTE", "logs")
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, "byte_app.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger("BYTE")

class TelemetryManager:
    """
    Privacy-First Telemetry Manager.
    Opt-in telemetry disabled by default for user privacy.
    """
    def __init__(self):
        self.telemetry_enabled = False

    def log_crash(self, exc: Exception, context: Optional[str] = None):
        error_msg = f"Crash in {context or 'unknown context'}: {str(exc)}\n{traceback.format_exc()}"
        logger.error(error_msg)
        
        crash_file = os.path.join(LOG_DIR, "crash_report_latest.txt")
        try:
            with open(crash_file, "w", encoding="utf-8") as f:
                f.write(error_msg)
        except Exception:
            pass

telemetry_manager = TelemetryManager()
