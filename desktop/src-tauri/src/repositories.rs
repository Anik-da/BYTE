use crate::db::DbPool;
use rusqlite::{params, Result, Row};
use std::sync::Arc;

// --- Struct definitions matching DB tables ---
pub struct DbUser {
    pub id: i64,
    pub username: String,
    pub name: String,
    pub password_hash: String,
    pub recovery_key: String,
    pub security_question_1: String,
    pub security_answer_hash_1: String,
    pub security_question_2: String,
    pub security_answer_hash_2: String,
    pub preferences: String,
    pub settings: String,
    pub permissions: String,
    pub avatar: Option<String>,
}

pub struct DbMemory {
    pub id: String,
    pub user_id: i64,
    pub content: String,
    pub category: String,
    pub importance: i32,
    pub tags: Vec<String>,
    pub source: String,
    pub created_at: i64,
    pub archived: bool,
}

pub struct DbChat {
    pub id: String,
    pub user_id: i64,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub model_id: String,
}

pub struct DbMessage {
    pub id: String,
    pub chat_id: String,
    pub role: String,
    pub content: String,
    pub timestamp: i64,
    pub metadata: Option<String>,
}

pub struct DbLog {
    pub id: i64,
    pub level: String,
    pub category: String,
    pub message: String,
    pub timestamp: i64,
}

pub struct DbWorkspace {
    pub id: String,
    pub path: String,
    pub name: String,
    pub created_at: i64,
    pub is_active: bool,
}

// --- UserRepository ---
pub trait UserRepository: Send + Sync {
    fn create_user(&self, user: &DbUser) -> Result<i64>;
    fn get_user_by_username(&self, username: &str) -> Result<Option<DbUser>>;
    fn get_user_by_id(&self, id: i64) -> Result<Option<DbUser>>;
    fn list_users(&self) -> Result<Vec<DbUser>>;
    fn update_user_profile(&self, id: i64, name: &str, avatar: Option<&str>) -> Result<()>;
}

pub struct SqliteUserRepository {
    pool: Arc<DbPool>,
}

impl SqliteUserRepository {
    pub fn new(pool: Arc<DbPool>) -> Self {
        Self { pool }
    }
}

impl UserRepository for SqliteUserRepository {
    fn create_user(&self, user: &DbUser) -> Result<i64> {
        let conn = self.pool.get_connection()?;
        conn.execute(
            "INSERT INTO users (
                username, name, password_hash, recovery_key,
                security_question_1, security_answer_hash_1,
                security_question_2, security_answer_hash_2,
                preferences, settings, permissions, avatar
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                user.username,
                user.name,
                user.password_hash,
                user.recovery_key,
                user.security_question_1,
                user.security_answer_hash_1,
                user.security_question_2,
                user.security_answer_hash_2,
                user.preferences,
                user.settings,
                user.permissions,
                user.avatar
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    fn get_user_by_username(&self, username: &str) -> Result<Option<DbUser>> {
        let conn = self.pool.get_connection()?;
        let mut stmt = conn.prepare("SELECT id, username, name, password_hash, recovery_key, security_question_1, security_answer_hash_1, security_question_2, security_answer_hash_2, preferences, settings, permissions, avatar FROM users WHERE username = ?1")?;
        let mut rows = stmt.query(params![username])?;
        if let Some(row) = rows.next()? {
            Ok(Some(map_user(row)?))
        } else {
            Ok(None)
        }
    }

    fn get_user_by_id(&self, id: i64) -> Result<Option<DbUser>> {
        let conn = self.pool.get_connection()?;
        let mut stmt = conn.prepare("SELECT id, username, name, password_hash, recovery_key, security_question_1, security_answer_hash_1, security_question_2, security_answer_hash_2, preferences, settings, permissions, avatar FROM users WHERE id = ?1")?;
        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(map_user(row)?))
        } else {
            Ok(None)
        }
    }

    fn list_users(&self) -> Result<Vec<DbUser>> {
        let conn = self.pool.get_connection()?;
        let mut stmt = conn.prepare("SELECT id, username, name, password_hash, recovery_key, security_question_1, security_answer_hash_1, security_question_2, security_answer_hash_2, preferences, settings, permissions, avatar FROM users")?;
        let user_iter = stmt.query_map([], |row| map_user(row))?;
        let mut users = Vec::new();
        for u in user_iter {
            users.push(u?);
        }
        Ok(users)
    }

    fn update_user_profile(&self, id: i64, name: &str, avatar: Option<&str>) -> Result<()> {
        let conn = self.pool.get_connection()?;
        conn.execute(
            "UPDATE users SET name = ?1, avatar = ?2 WHERE id = ?3",
            params![name, avatar, id],
        )?;
        Ok(())
    }
}

fn map_user(row: &Row) -> Result<DbUser> {
    Ok(DbUser {
        id: row.get(0)?,
        username: row.get(1)?,
        name: row.get(2)?,
        password_hash: row.get(3)?,
        recovery_key: row.get(4)?,
        security_question_1: row.get(5)?,
        security_answer_hash_1: row.get(6)?,
        security_question_2: row.get(7)?,
        security_answer_hash_2: row.get(8)?,
        preferences: row.get(9)?,
        settings: row.get(10)?,
        permissions: row.get(11)?,
        avatar: row.get(12)?,
    })
}

// --- SettingsRepository ---
pub trait SettingsRepository: Send + Sync {
    fn save_setting(&self, key: &str, value: &str) -> Result<()>;
    fn load_setting(&self, key: &str) -> Result<Option<String>>;
}

pub struct SqliteSettingsRepository {
    pool: Arc<DbPool>,
}

impl SqliteSettingsRepository {
    pub fn new(pool: Arc<DbPool>) -> Self {
        Self { pool }
    }
}

impl SettingsRepository for SqliteSettingsRepository {
    fn save_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.pool.get_connection()?;
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    fn load_setting(&self, key: &str) -> Result<Option<String>> {
        let conn = self.pool.get_connection()?;
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        let res = stmt.query_row(params![key], |row| row.get::<_, String>(0));
        match res {
            Ok(val) => Ok(Some(val)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }
}

// --- MemoryRepository ---
pub trait MemoryRepository: Send + Sync {
    fn save_memory(&self, memory: &DbMemory) -> Result<()>;
    fn load_memories(&self, user_id: i64) -> Result<Vec<DbMemory>>;
    fn delete_memory(&self, id: &str) -> Result<()>;
    fn clear_all_memories(&self, user_id: i64) -> Result< grandfather_clear_err_type::Result<()> >;
}

mod grandfather_clear_err_type {
    pub type Result<T> = std::result::Result<T, rusqlite::Error>;
}

pub struct SqliteMemoryRepository {
    pool: Arc<DbPool>,
}

impl SqliteMemoryRepository {
    pub fn new(pool: Arc<DbPool>) -> Self {
        Self { pool }
    }
}

impl MemoryRepository for SqliteMemoryRepository {
    fn save_memory(&self, memory: &DbMemory) -> Result<()> {
        let conn = self.pool.get_connection()?;
        let tags_json = serde_json::to_string(&memory.tags).unwrap_or_else(|_| "[]".to_string());
        conn.execute(
            "INSERT INTO memory_entries (id, user_id, content, category, importance, tags, source, created_at, archived)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT(id) DO UPDATE SET content=excluded.content, category=excluded.category, importance=excluded.importance, tags=excluded.tags, archived=excluded.archived",
            params![
                memory.id,
                memory.user_id,
                memory.content,
                memory.category,
                memory.importance,
                tags_json,
                memory.source,
                memory.created_at,
                if memory.archived { 1 } else { 0 }
            ],
        )?;
        Ok(())
    }

    fn load_memories(&self, user_id: i64) -> Result<Vec<DbMemory>> {
        let conn = self.pool.get_connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, content, category, importance, tags, source, created_at, archived FROM memory_entries WHERE user_id = ?1 ORDER BY created_at DESC"
        )?;
        let mem_iter = stmt.query_map(params![user_id], |row| {
            let tags_str: String = row.get(5)?;
            let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
            Ok(DbMemory {
                id: row.get(0)?,
                user_id: row.get(1)?,
                content: row.get(2)?,
                category: row.get(3)?,
                importance: row.get(4)?,
                tags,
                source: row.get(6)?,
                created_at: row.get(7)?,
                archived: row.get::<_, i32>(8)? != 0,
            })
        })?;
        let mut list = Vec::new();
        for m in mem_iter {
            list.push(m?);
        }
        Ok(list)
    }

    fn delete_memory(&self, id: &str) -> Result<()> {
        let conn = self.pool.get_connection()?;
        conn.execute("DELETE FROM memory_entries WHERE id = ?1", params![id])?;
        Ok(())
    }

    fn clear_all_memories(&self, user_id: i64) -> Result<grandfather_clear_err_type::Result<()>> {
        let conn = self.pool.get_connection()?;
        conn.execute("DELETE FROM memory_entries WHERE user_id = ?1", params![user_id])?;
        Ok(Ok(()))
    }
}

// --- ChatRepository ---
pub trait ChatRepository: Send + Sync {
    fn save_chat(&self, chat: &DbChat) -> Result<()>;
    fn load_chats(&self, user_id: i64) -> Result<Vec<DbChat>>;
    fn save_message(&self, msg: &DbMessage) -> Result<()>;
    fn load_messages(&self, chat_id: &str) -> Result<Vec<DbMessage>>;
    fn delete_chat(&self, chat_id: &str) -> Result<()>;
}

pub struct SqliteChatRepository {
    pool: Arc<DbPool>,
}

impl SqliteChatRepository {
    pub fn new(pool: Arc<DbPool>) -> Self {
        Self { pool }
    }
}

impl ChatRepository for SqliteChatRepository {
    fn save_chat(&self, chat: &DbChat) -> Result<()> {
        let conn = self.pool.get_connection()?;
        conn.execute(
            "INSERT INTO chat_history (id, user_id, title, created_at, updated_at, model_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET title=excluded.title, updated_at=excluded.updated_at",
            params![chat.id, chat.user_id, chat.title, chat.created_at, chat.updated_at, chat.model_id],
        )?;
        Ok(())
    }

    fn load_chats(&self, user_id: i64) -> Result<Vec<DbChat>> {
        let conn = self.pool.get_connection()?;
        let mut stmt = conn.prepare("SELECT id, user_id, title, created_at, updated_at, model_id FROM chat_history WHERE user_id = ?1 ORDER BY updated_at DESC")?;
        let iter = stmt.query_map(params![user_id], |row| {
            Ok(DbChat {
                id: row.get(0)?,
                user_id: row.get(1)?,
                title: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                model_id: row.get(5)?,
            })
        })?;
        let mut list = Vec::new();
        for c in iter {
            list.push(c?);
        }
        Ok(list)
    }

    fn save_message(&self, msg: &DbMessage) -> Result<()> {
        let conn = self.pool.get_connection()?;
        conn.execute(
            "INSERT INTO conversation_messages (id, chat_id, role, content, timestamp, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET content=excluded.content, metadata=excluded.metadata",
            params![msg.id, msg.chat_id, msg.role, msg.content, msg.timestamp, msg.metadata],
        )?;
        Ok(())
    }

    fn load_messages(&self, chat_id: &str) -> Result<Vec<DbMessage>> {
        let conn = self.pool.get_connection()?;
        let mut stmt = conn.prepare("SELECT id, chat_id, role, content, timestamp, metadata FROM conversation_messages WHERE chat_id = ?1 ORDER BY timestamp ASC")?;
        let iter = stmt.query_map(params![chat_id], |row| {
            Ok(DbMessage {
                id: row.get(0)?,
                chat_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                timestamp: row.get(4)?,
                metadata: row.get(5)?,
            })
        })?;
        let mut list = Vec::new();
        for m in iter {
            list.push(m?);
        }
        Ok(list)
    }

    fn delete_chat(&self, chat_id: &str) -> Result<()> {
        let conn = self.pool.get_connection()?;
        conn.execute("DELETE FROM chat_history WHERE id = ?1", params![chat_id])?;
        Ok(())
    }
}

// --- LogRepository ---
pub trait LogRepository: Send + Sync {
    fn save_log(&self, level: &str, category: &str, message: &str) -> Result<()>;
    fn load_logs(&self, limit: usize) -> Result<Vec<DbLog>>;
    fn clear_logs(&self) -> Result<()>;
}

pub struct SqliteLogRepository {
    pool: Arc<DbPool>,
}

impl SqliteLogRepository {
    pub fn new(pool: Arc<DbPool>) -> Self {
        Self { pool }
    }
}

impl LogRepository for SqliteLogRepository {
    fn save_log(&self, level: &str, category: &str, message: &str) -> Result<()> {
        let conn = self.pool.get_connection()?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        conn.execute(
            "INSERT INTO logs (level, category, message, timestamp) VALUES (?1, ?2, ?3, ?4)",
            params![level, category, message, now],
        )?;
        Ok(())
    }

    fn load_logs(&self, limit: usize) -> Result<Vec<DbLog>> {
        let conn = self.pool.get_connection()?;
        let mut stmt = conn.prepare("SELECT id, level, category, message, timestamp FROM logs ORDER BY timestamp DESC LIMIT ?1")?;
        let iter = stmt.query_map(params![limit as i64], |row| {
            Ok(DbLog {
                id: row.get(0)?,
                level: row.get(1)?,
                category: row.get(2)?,
                message: row.get(3)?,
                timestamp: row.get(4)?,
            })
        })?;
        let mut list = Vec::new();
        for l in iter {
            list.push(l?);
        }
        Ok(list)
    }

    fn clear_logs(&self) -> Result<()> {
        let conn = self.pool.get_connection()?;
        conn.execute("DELETE FROM logs", [])?;
        Ok(())
    }
}

// --- WorkspaceRepository ---
pub trait WorkspaceRepository: Send + Sync {
    fn save_workspace(&self, ws: &DbWorkspace) -> Result<()>;
    fn load_workspaces(&self) -> Result<Vec<DbWorkspace>>;
    fn set_active_workspace(&self, id: &str) -> Result<()>;
    fn get_active_workspace(&self) -> Result<Option<DbWorkspace>>;
}

pub struct SqliteWorkspaceRepository {
    pool: Arc<DbPool>,
}

impl SqliteWorkspaceRepository {
    pub fn new(pool: Arc<DbPool>) -> Self {
        Self { pool }
    }
}

impl WorkspaceRepository for SqliteWorkspaceRepository {
    fn save_workspace(&self, ws: &DbWorkspace) -> Result<()> {
        let conn = self.pool.get_connection()?;
        conn.execute(
            "INSERT INTO workspaces (id, path, name, created_at, is_active)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET name=excluded.name, path=excluded.path",
            params![ws.id, ws.path, ws.name, ws.created_at, if ws.is_active { 1 } else { 0 }],
        )?;
        Ok(())
    }

    fn load_workspaces(&self) -> Result<Vec<DbWorkspace>> {
        let conn = self.pool.get_connection()?;
        let mut stmt = conn.prepare("SELECT id, path, name, created_at, is_active FROM workspaces ORDER BY created_at DESC")?;
        let iter = stmt.query_map([], |row| {
            Ok(DbWorkspace {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
                created_at: row.get(3)?,
                is_active: row.get::<_, i32>(4)? != 0,
            })
        })?;
        let mut list = Vec::new();
        for w in iter {
            list.push(w?);
        }
        Ok(list)
    }

    fn set_active_workspace(&self, id: &str) -> Result<()> {
        let conn = self.pool.get_connection()?;
        conn.execute("UPDATE workspaces SET is_active = 0", [])?;
        conn.execute("UPDATE workspaces SET is_active = 1 WHERE id = ?1", params![id])?;
        Ok(())
    }

    fn get_active_workspace(&self) -> Result<Option<DbWorkspace>> {
        let conn = self.pool.get_connection()?;
        let mut stmt = conn.prepare("SELECT id, path, name, created_at, is_active FROM workspaces WHERE is_active = 1")?;
        let mut rows = stmt.query([])?;
        if let Some(row) = rows.next()? {
            Ok(Some(DbWorkspace {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
                created_at: row.get(3)?,
                is_active: row.get::<_, i32>(4)? != 0,
            }))
        } else {
            Ok(None)
        }
    }
}
