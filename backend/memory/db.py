import os
import sqlite3
import json
from typing import Dict, Any, List, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "database", "byte_memory.db")

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Conversations table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS conversation_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        intent TEXT,
        action_executed TEXT
    )
    """)
    
    # Settings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """)
    
    # Default settings initial state
    default_settings = {
        "ai_provider": "ollama",  # Local AI First
        "groq_model": "groq/compound",
        "ollama_model": "llama3",
        "wake_word_enabled": True,
        "auto_launch": False,
        "auto_update": True,
        "security_level": "medium",
        "coding_style": "clean_modular_typescript"
    }

    # Projects table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS memorized_projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT UNIQUE NOT NULL,
        stack TEXT,
        last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Preferences table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_preferences (
        category TEXT PRIMARY KEY,
        data_json TEXT NOT NULL
    )
    """)

    # Installed software table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS installed_software (
        app_name TEXT PRIMARY KEY,
        exec_path TEXT NOT NULL,
        category TEXT
    )
    """)

    # Frequently used commands table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS frequent_commands (
        command TEXT PRIMARY KEY,
        usage_count INTEGER DEFAULT 1,
        last_used DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    for key, val in default_settings.items():
        cursor.execute("""
        INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)
        """, (key, json.dumps(val)))
        
    conn.commit()
    conn.close()

def save_message(role: str, content: str, intent: Optional[str] = None, action_executed: Optional[str] = None):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO conversation_history (role, content, intent, action_executed)
    VALUES (?, ?, ?, ?)
    """, (role, content, intent, action_executed))
    conn.commit()
    conn.close()

def get_history(limit: int = 50) -> List[Dict[str, Any]]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, timestamp, role, content, intent, action_executed
    FROM conversation_history
    ORDER BY id DESC LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in reversed(rows)]

def get_settings() -> Dict[str, Any]:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM system_settings")
    rows = cursor.fetchall()
    conn.close()
    res = {}
    for k, v in rows:
        try:
            res[k] = json.loads(v)
        except Exception:
            res[k] = v
    return res

def set_setting(key: str, value: Any):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
    INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)
    """, (key, json.dumps(value)))
    conn.commit()
    conn.close()

def save_settings(settings_dict: Dict[str, Any]):
    for k, v in settings_dict.items():
        set_setting(k, v)
