use std::collections::HashMap;
use std::hash::Hash;
use std::sync::Mutex;
use std::time::{Duration, Instant};

struct CacheItem<V> {
    value: V,
    expires_at: Instant,
}

pub struct MemoryCache<K, V> {
    items: Mutex<HashMap<K, CacheItem<V>>>,
    ttl: Duration,
}

impl<K: Eq + Hash, V: Clone> MemoryCache<K, V> {
    pub fn new(ttl_seconds: u64) -> Self {
        Self {
            items: Mutex::new(HashMap::new()),
            ttl: Duration::from_secs(ttl_seconds),
        }
    }

    pub fn get(&self, key: &K) -> Option<V> {
        let mut guard = self.items.lock().unwrap();
        if let Some(item) = guard.get(key) {
            if Instant::now() < item.expires_at {
                return Some(item.value.clone());
            }
        }
        // Invalidate key if expired
        let _ = guard.remove(key);
        None
    }

    pub fn set(&self, key: K, value: V) {
        let mut guard = self.items.lock().unwrap();
        guard.insert(
            key,
            CacheItem {
                value,
                expires_at: Instant::now() + self.ttl,
            },
        );
    }

    pub fn invalidate(&self, key: &K) {
        let mut guard = self.items.lock().unwrap();
        let _ = guard.remove(key);
    }

    pub fn clear(&self) {
        let mut guard = self.items.lock().unwrap();
        guard.clear();
    }
}

// Global caching orchestrator containing specific caches
pub struct CacheManager {
    pub chat_cache: MemoryCache<String, String>,      // ChatID -> JSON string messages
    pub model_cache: MemoryCache<String, String>,     // ModelName -> Model configs
    pub image_cache: MemoryCache<String, Vec<u8>>,     // ImagePath -> Base64 or bytes
    pub search_cache: MemoryCache<String, String>,    // SearchQuery -> Results
    pub workspace_cache: MemoryCache<String, String>, // WorkspaceID -> Metadata
    pub settings_cache: MemoryCache<String, String>,  // SettingKey -> SettingValue
}

impl CacheManager {
    pub fn new() -> Self {
        Self {
            chat_cache: MemoryCache::new(300),      // 5 min cache
            model_cache: MemoryCache::new(3600),    // 1 hr cache
            image_cache: MemoryCache::new(600),     // 10 min cache
            search_cache: MemoryCache::new(60),       // 1 min cache
            workspace_cache: MemoryCache::new(120),  // 2 min cache
            settings_cache: MemoryCache::new(1800),  // 30 min cache
        }
    }
}
