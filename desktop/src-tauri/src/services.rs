use crate::db::DbPool;
use crate::repositories::{
    UserRepository, SettingsRepository, MemoryRepository, ChatRepository,
    LogRepository, WorkspaceRepository, DbUser, DbMemory, DbChat, DbMessage, DbWorkspace
};
use crate::memory::MemoryEngine;
use crate::cache::CacheManager;
use crate::auth_db::{derive_key, encrypt_aes, decrypt_aes};

use std::sync::Arc;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

// Central Services container
pub struct Services {
    pub db_pool: Arc<DbPool>,
    pub cache: Arc<CacheManager>,
    pub user_repo: Arc<dyn UserRepository>,
    pub settings_repo: Arc<dyn SettingsRepository>,
    pub memory_repo: Arc<dyn MemoryRepository>,
    pub chat_repo: Arc<dyn ChatRepository>,
    pub log_repo: Arc<dyn LogRepository>,
    pub workspace_repo: Arc<dyn WorkspaceRepository>,
    pub memory_engine: Arc<MemoryEngine>,
}

impl Services {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let pool = Arc::new(DbPool::new(&app_data_dir));
        let cache = Arc::new(CacheManager::new());
        
        let user_repo = Arc::new(crate::repositories::SqliteUserRepository::new(pool.clone()));
        let settings_repo = Arc::new(crate::repositories::SqliteSettingsRepository::new(pool.clone()));
        let memory_repo = Arc::new(crate::repositories::SqliteMemoryRepository::new(pool.clone()));
        let chat_repo = Arc::new(crate::repositories::SqliteChatRepository::new(pool.clone()));
        let log_repo = Arc::new(crate::repositories::SqliteLogRepository::new(pool.clone()));
        let workspace_repo = Arc::new(crate::repositories::SqliteWorkspaceRepository::new(pool.clone()));
        
        let memory_engine = Arc::new(MemoryEngine::new(memory_repo.clone()));

        Self {
            db_pool: pool,
            cache,
            user_repo,
            settings_repo,
            memory_repo,
            chat_repo,
            log_repo,
            workspace_repo,
            memory_engine,
        }
    }
}

// 1. Database Service
pub struct DatabaseService {
    pool: Arc<DbPool>,
}

impl DatabaseService {
    pub fn new(pool: Arc<DbPool>) -> Self {
        Self { pool }
    }

    pub fn check_health(&self) -> bool {
        self.pool.get_connection().is_ok()
    }
}

// 2. Memory Service (with AES encryption)
pub struct MemoryService {
    engine: Arc<MemoryEngine>,
}

impl MemoryService {
    pub fn new(engine: Arc<MemoryEngine>) -> Self {
        Self { engine }
    }

    pub fn save_memory(
        &self,
        user_id: i64,
        key_seed: &str,
        content: &str,
        category: &str,
        importance: i32,
        tags: Vec<String>,
        source: &str,
    ) -> Result<String, String> {
        let aes_key = derive_key(key_seed);
        let encrypted_content = encrypt_aes(content, &aes_key)?;
        
        self.engine
            .save_entry(user_id, &encrypted_content, category, importance, tags, source)
            .map_err(|e| e.to_string())
    }

    pub fn retrieve_memories(&self, user_id: i64, key_seed: &str) -> Result<Vec<DbMemory>, String> {
        let aes_key = derive_key(key_seed);
        let memories = self.engine.retrieve_entries(user_id).map_err(|e| e.to_string())?;
        
        let decrypted: Vec<DbMemory> = memories
            .into_iter()
            .map(|mut m| {
                if let Ok(dec) = decrypt_aes(&m.content, &aes_key) {
                    m.content = dec;
                }
                m
            })
            .collect();
            
        Ok(decrypted)
    }

    pub fn search_memories(
        &self,
        user_id: i64,
        key_seed: &str,
        query: &str,
    ) -> Result<Vec<DbMemory>, String> {
        let aes_key = derive_key(key_seed);
        let memories = self.engine.retrieve_entries(user_id).map_err(|e| e.to_string())?;
        
        let decrypted: Vec<DbMemory> = memories
            .into_iter()
            .map(|mut m| {
                if let Ok(dec) = decrypt_aes(&m.content, &aes_key) {
                    m.content = dec;
                }
                m
            })
            .filter(|m| {
                let query_lower = query.to_lowercase();
                m.content.to_lowercase().contains(&query_lower)
                    || m.tags.iter().any(|t| t.to_lowercase().contains(&query_lower))
            })
            .collect();
            
        Ok(decrypted)
    }

    pub fn delete_memory(&self, id: &str) -> Result<(), String> {
        self.engine.delete_entry(id).map_err(|e| e.to_string())
    }

    pub fn archive_memory(&self, id: &str, user_id: i64) -> Result<(), String> {
        self.engine.archive_entry(id, user_id).map_err(|e| e.to_string())
    }

    pub fn run_cleanup(&self, user_id: i64) -> Result<usize, String> {
        self.engine.run_cleanup(user_id).map_err(|e| e.to_string())
    }
}

// 3. Settings Service (with Cache Integration & Encryption)
pub struct SettingsService {
    repo: Arc<dyn SettingsRepository>,
    cache: Arc<CacheManager>,
}

impl SettingsService {
    pub fn new(repo: Arc<dyn SettingsRepository>, cache: Arc<CacheManager>) -> Self {
        Self { repo, cache }
    }

    pub fn save_setting(&self, key: &str, value: &str, encrypt_key: Option<&str>) -> Result<(), String> {
        let payload = if let Some(seed) = encrypt_key {
            let aes_key = derive_key(seed);
            encrypt_aes(value, &aes_key)?
        } else {
            value.to_string()
        };

        self.repo.save_setting(key, &payload).map_err(|e| e.to_string())?;
        self.cache.settings_cache.set(key.to_string(), payload);
        Ok(())
    }

    pub fn load_setting(&self, key: &str, decrypt_key: Option<&str>) -> Result<Option<String>, String> {
        let cached = self.cache.settings_cache.get(&key.to_string());
        let payload = if let Some(val) = cached {
            Some(val)
        } else {
            let db_val = self.repo.load_setting(key).map_err(|e| e.to_string())?;
            if let Some(ref val) = db_val {
                self.cache.settings_cache.set(key.to_string(), val.clone());
            }
            db_val
        };

        match (payload, decrypt_key) {
            (Some(val), Some(seed)) => {
                let aes_key = derive_key(seed);
                let decrypted = decrypt_aes(&val, &aes_key)?;
                Ok(Some(decrypted))
            }
            (Some(val), None) => Ok(Some(val)),
            (None, _) => Ok(None),
        }
    }
}

// 4. Profile Service
pub struct ProfileService {
    repo: Arc<dyn UserRepository>,
}

impl ProfileService {
    pub fn new(repo: Arc<dyn UserRepository>) -> Self {
        Self { repo }
    }

    pub fn load_profile(&self, id: i64) -> Result<Option<DbUser>, String> {
        self.repo.get_user_by_id(id).map_err(|e| e.to_string())
    }

    pub fn update_profile(&self, id: i64, name: &str, avatar: Option<&str>) -> Result<(), String> {
        self.repo.update_user_profile(id, name, avatar).map_err(|e| e.to_string())
    }
}

// 5. Workspace Service
pub struct WorkspaceService {
    repo: Arc<dyn WorkspaceRepository>,
}

impl WorkspaceService {
    pub fn new(repo: Arc<dyn WorkspaceRepository>) -> Self {
        Self { repo }
    }

    pub fn create_workspace(&self, path: &str, name: &str) -> Result<DbWorkspace, String> {
        let id = format!("ws-{}", rand_id());
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
            
        let ws = DbWorkspace {
            id: id.clone(),
            path: path.to_string(),
            name: name.to_string(),
            created_at: now,
            is_active: false,
        };
        
        self.repo.save_workspace(&ws).map_err(|e| e.to_string())?;
        Ok(ws)
    }

    pub fn open_workspace(&self, id: &str) -> Result<(), String> {
        self.repo.set_active_workspace(id).map_err(|e| e.to_string())
    }

    pub fn get_active_workspace(&self) -> Result<Option<DbWorkspace>, String> {
        self.repo.get_active_workspace().map_err(|e| e.to_string())
    }

    pub fn list_workspaces(&self) -> Result<Vec<DbWorkspace>, String> {
        self.repo.load_workspaces().map_err(|e| e.to_string())
    }
}

// 6. Logging Service
pub struct LoggingService {
    repo: Arc<dyn LogRepository>,
}

impl LoggingService {
    pub fn new(repo: Arc<dyn LogRepository>) -> Self {
        Self { repo }
    }

    pub fn log(&self, level: &str, category: &str, message: &str) {
        let _ = self.repo.save_log(level, category, message);
    }

    pub fn retrieve_logs(&self, limit: usize) -> Result<Vec<crate::repositories::DbLog>, String> {
        self.repo.load_logs(limit).map_err(|e| e.to_string())
    }

    pub fn clear(&self) -> Result<(), String> {
        self.repo.clear_logs().map_err(|e| e.to_string())
    }
}

// 7. Caching Service
pub struct CacheService {
    cache: Arc<CacheManager>,
}

impl CacheService {
    pub fn new(cache: Arc<CacheManager>) -> Self {
        Self { cache }
    }

    pub fn clear_all(&self) {
        self.cache.chat_cache.clear();
        self.cache.model_cache.clear();
        self.cache.image_cache.clear();
        self.cache.search_cache.clear();
        self.cache.workspace_cache.clear();
        self.cache.settings_cache.clear();
    }
}

// 8. Notification Service
pub struct NotificationService {
    pool: Arc<DbPool>,
}

impl NotificationService {
    pub fn new(pool: Arc<DbPool>) -> Self {
        Self { pool }
    }

    pub fn create_notification(&self, title: &str, message: &str) -> Result<(), String> {
        let conn = self.pool.get_connection().map_err(|e| e.to_string())?;
        let id = format!("notif-{}", rand_id());
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
            
        conn.execute(
            "INSERT INTO notifications (id, title, message, read, created_at) VALUES (?1, ?2, ?3, 0, ?4)",
            params![id, title, message, now],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }
}

// 9. File Index Service
pub struct FileIndexService {
    pool: Arc<DbPool>,
}

impl FileIndexService {
    pub fn new(pool: Arc<DbPool>) -> Self {
        Self { pool }
    }

    pub fn index_folder_metadata(&self, folder_path: &str) -> Result<usize, String> {
        let conn = self.pool.get_connection().map_err(|e| e.to_string())?;
        let dir = PathBuf::from(folder_path);
        
        if !dir.is_dir() {
            return Err("Provided path is not a directory".to_string());
        }

        let mut indexed_count = 0;
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                if let Ok(meta) = entry.metadata() {
                    if meta.is_file() {
                        let path = entry.path().to_string_lossy().to_string();
                        let name = entry.file_name().to_string_lossy().to_string();
                        let size = meta.len() as i64;
                        
                        let _ = conn.execute(
                            "INSERT INTO recent_files (path, name, mime_type, size_bytes, accessed_at)
                             VALUES (?1, ?2, 'file', ?3, ?4)
                             ON CONFLICT(path) DO UPDATE SET accessed_at = excluded.accessed_at",
                            params![path, name, size, now],
                        );
                        indexed_count += 1;
                    }
                }
            }
        }
        
        Ok(indexed_count)
    }
}

// 10. Plugin Service
pub struct PluginService {
    pool: Arc<DbPool>,
}

impl PluginService {
    pub fn new(pool: Arc<DbPool>) -> Self {
        Self { pool }
    }

    pub fn install_plugin(&self, id: &str, name: &str, version: &str) -> Result<(), String> {
        let conn = self.pool.get_connection().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO installed_plugins (id, name, version, enabled, manifest)
             VALUES (?1, ?2, ?3, 1, '{}')
             ON CONFLICT(id) DO UPDATE SET version = excluded.version",
            params![id, name, version],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }
}

// Quick random ID helper
fn rand_id() -> String {
    let mut rng = rand::thread_rng();
    let val: u32 = rand::Rng::gen(&mut rng);
    format!("{:08x}", val)
}
