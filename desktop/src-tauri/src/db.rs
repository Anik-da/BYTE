use rusqlite::{Connection, Result};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

pub struct DbPool {
    db_path: PathBuf,
    // A single mutex-wrapped connection is perfect for local-first desktop usage,
    // preventing file locks and ensuring thread safety.
    conn: Arc<Mutex<Connection>>,
}

impl DbPool {
    pub fn new(app_data_dir: &Path) -> Self {
        let db_path = app_data_dir.join("byte_secure.db");
        if let Some(parent) = db_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        
        let conn = Connection::open(&db_path).expect("Failed to open SQLite database");
        
        // Optimize connection pragmas
        conn.execute("PRAGMA journal_mode = WAL", []).unwrap();
        conn.execute("PRAGMA synchronous = NORMAL", []).unwrap();
        conn.execute("PRAGMA foreign_keys = ON", []).unwrap();

        let pool = Self {
            db_path,
            conn: Arc::new(Mutex::new(conn)),
        };

        pool.run_migrations().expect("Failed to run database migrations");
        pool
    }

    pub fn get_connection(&self) -> Result<Connection> {
        // Return a fresh connection to the database file for concurrent query execution
        let conn = Connection::open(&self.db_path)?;
        conn.execute("PRAGMA journal_mode = WAL", [])?;
        conn.execute("PRAGMA synchronous = NORMAL", [])?;
        conn.execute("PRAGMA foreign_keys = ON", [])?;
        Ok(conn)
    }

    pub fn execute_write<F>(&self, f: F) -> Result<()>
    where
        F: FnOnce(&Connection) -> Result<()>,
    {
        let guard = self.conn.lock().unwrap();
        f(&guard)
    }

    fn run_migrations(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        // Check database schema user_version pragma
        let version: i32 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;

        if version < 1 {
            // Version 0 -> 1: Initialize all tables
            
            // 1. Users
            conn.execute(
                "CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    recovery_key TEXT NOT NULL,
                    security_question_1 TEXT NOT NULL,
                    security_answer_hash_1 TEXT NOT NULL,
                    security_question_2 TEXT NOT NULL,
                    security_answer_hash_2 TEXT NOT NULL,
                    preferences TEXT NOT NULL,
                    settings TEXT NOT NULL,
                    permissions TEXT NOT NULL,
                    avatar TEXT
                )",
                [],
            )?;

            // 2. Profiles
            conn.execute(
                "CREATE TABLE IF NOT EXISTS profiles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    bio TEXT,
                    organization TEXT,
                    role TEXT,
                    custom_fields TEXT, -- JSON
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                )",
                [],
            )?;

            // 3. Sessions
            conn.execute(
                "CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    device_name TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    last_active INTEGER NOT NULL,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    token TEXT, -- Encrypted token payload
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                )",
                [],
            )?;

            // 4. Permissions
            conn.execute(
                "CREATE TABLE IF NOT EXISTS permissions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    resource TEXT NOT NULL,
                    allowed INTEGER NOT NULL DEFAULT 0,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE(user_id, resource)
                )",
                [],
            )?;

            // 5. Settings
            conn.execute(
                "CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )",
                [],
            )?;

            // 6. Themes
            conn.execute(
                "CREATE TABLE IF NOT EXISTS themes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    mode TEXT NOT NULL, -- 'dark' | 'light'
                    accent_color TEXT NOT NULL,
                    custom_styles TEXT -- JSON
                )",
                [],
            )?;

            // 7. Chat History
            conn.execute(
                "CREATE TABLE IF NOT EXISTS chat_history (
                    id TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    model_id TEXT NOT NULL,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                )",
                [],
            )?;

            // 8. Conversation Messages
            conn.execute(
                "CREATE TABLE IF NOT EXISTS conversation_messages (
                    id TEXT PRIMARY KEY,
                    chat_id TEXT NOT NULL,
                    role TEXT NOT NULL, -- 'user' | 'assistant' | 'system'
                    content TEXT NOT NULL, -- Encrypted
                    timestamp INTEGER NOT NULL,
                    metadata TEXT, -- JSON
                    FOREIGN KEY(chat_id) REFERENCES chat_history(id) ON DELETE CASCADE
                )",
                [],
            )?;

            // 9. Memory Entries
            conn.execute(
                "CREATE TABLE IF NOT EXISTS memory_entries (
                    id TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    content TEXT NOT NULL, -- Encrypted
                    category TEXT NOT NULL, -- LongTerm, ShortTerm, Conversation, Workspace, Coding, Preferences, Project
                    importance INTEGER NOT NULL DEFAULT 1,
                    tags TEXT NOT NULL, -- JSON Array
                    source TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    archived INTEGER NOT NULL DEFAULT 0,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                )",
                [],
            )?;

            // 10. Recent Files
            conn.execute(
                "CREATE TABLE IF NOT EXISTS recent_files (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    path TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    mime_type TEXT,
                    size_bytes INTEGER,
                    accessed_at INTEGER NOT NULL
                )",
                [],
            )?;

            // 11. Pinned Files
            conn.execute(
                "CREATE TABLE IF NOT EXISTS pinned_files (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    path TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    pinned_at INTEGER NOT NULL
                )",
                [],
            )?;

            // 12. Pinned Folders
            conn.execute(
                "CREATE TABLE IF NOT EXISTS pinned_folders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    path TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    pinned_at INTEGER NOT NULL
                )",
                [],
            )?;

            // 13. Workspaces
            conn.execute(
                "CREATE TABLE IF NOT EXISTS workspaces (
                    id TEXT PRIMARY KEY,
                    path TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    is_active INTEGER NOT NULL DEFAULT 0
                )",
                [],
            )?;

            // 14. Installed Plugins
            conn.execute(
                "CREATE TABLE IF NOT EXISTS installed_plugins (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    version TEXT NOT NULL,
                    enabled INTEGER NOT NULL DEFAULT 1,
                    manifest TEXT -- JSON
                )",
                [],
            )?;

            // 15. Plugin Settings
            conn.execute(
                "CREATE TABLE IF NOT EXISTS plugin_settings (
                    plugin_id TEXT NOT NULL,
                    key TEXT NOT NULL,
                    value TEXT NOT NULL,
                    PRIMARY KEY(plugin_id, key)
                )",
                [],
            )?;

            // 16. Voice Profiles
            conn.execute(
                "CREATE TABLE IF NOT EXISTS voice_profiles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    profile_name TEXT NOT NULL,
                    sample_path TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                )",
                [],
            )?;

            // 17. Face Profiles
            conn.execute(
                "CREATE TABLE IF NOT EXISTS face_profiles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    profile_name TEXT NOT NULL,
                    image_path TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                )",
                [],
            )?;

            // 18. AI Models
            conn.execute(
                "CREATE TABLE IF NOT EXISTS ai_models (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    provider TEXT NOT NULL, -- e.g. openai, anthropic, ollama
                    model_type TEXT NOT NULL, -- e.g. chat, embedding
                    settings TEXT -- JSON
                )",
                [],
            )?;

            // 19. Automation History
            conn.execute(
                "CREATE TABLE IF NOT EXISTS automation_history (
                    id TEXT PRIMARY KEY,
                    trigger_type TEXT NOT NULL,
                    action_name TEXT NOT NULL,
                    status TEXT NOT NULL, -- 'success' | 'failed'
                    executed_at INTEGER NOT NULL,
                    details TEXT
                )",
                [],
            )?;

            // 20. Tasks
            conn.execute(
                "CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    status TEXT NOT NULL, -- 'todo', 'in_progress', 'done'
                    due_date INTEGER,
                    created_at INTEGER NOT NULL
                )",
                [],
            )?;

            // 21. Notifications
            conn.execute(
                "CREATE TABLE IF NOT EXISTS notifications (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    message TEXT NOT NULL,
                    read INTEGER NOT NULL DEFAULT 0,
                    created_at INTEGER NOT NULL
                )",
                [],
            )?;

            // 22. Logs
            conn.execute(
                "CREATE TABLE IF NOT EXISTS logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    level TEXT NOT NULL, -- 'info' | 'warning' | 'error' | 'crash' | 'performance' | 'ai' | 'automation' | 'security'
                    category TEXT NOT NULL,
                    message TEXT NOT NULL,
                    timestamp INTEGER NOT NULL
                )",
                [],
            )?;

            // 23. Crash Reports
            conn.execute(
                "CREATE TABLE IF NOT EXISTS crash_reports (
                    id TEXT PRIMARY KEY,
                    error_message TEXT NOT NULL,
                    stack_trace TEXT,
                    timestamp INTEGER NOT NULL
                )",
                [],
            )?;

            // 24. System Information
            conn.execute(
                "CREATE TABLE IF NOT EXISTS system_information (
                    timestamp INTEGER PRIMARY KEY,
                    cpu_usage REAL NOT NULL,
                    ram_usage REAL NOT NULL,
                    disk_usage REAL NOT NULL
                )",
                [],
            )?;

            // 25. Devices
            conn.execute(
                "CREATE TABLE IF NOT EXISTS devices (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    device_type TEXT NOT NULL,
                    ip_address TEXT,
                    last_seen INTEGER NOT NULL
                )",
                [],
            )?;

            // 26. Developer Settings
            conn.execute(
                "CREATE TABLE IF NOT EXISTS developer_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )",
                [],
            )?;

            // Indexes for speed and optimizations
            conn.execute("CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp)", [])?;
            conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON conversation_messages(chat_id)", [])?;
            conn.execute("CREATE INDEX IF NOT EXISTS idx_memory_user_id ON memory_entries(user_id)", [])?;
            conn.execute("CREATE INDEX IF NOT EXISTS idx_memory_category ON memory_entries(category)", [])?;
            conn.execute("CREATE INDEX IF NOT EXISTS idx_recent_files_accessed ON recent_files(accessed_at)", [])?;

            conn.execute("PRAGMA user_version = 1", [])?;
        }

        Ok(())
    }
}
