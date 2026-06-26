use crate::repositories::{DbMemory, MemoryRepository};
use rand::{thread_rng, Rng};
use std::sync::Arc;

pub struct MemoryEngine {
    repo: Arc<dyn MemoryRepository>,
}

impl MemoryEngine {
    pub fn new(repo: Arc<dyn MemoryRepository>) -> Self {
        Self { repo }
    }

    pub fn save_entry(
        &self,
        user_id: i64,
        content: &str,
        category: &str,
        importance: i32,
        tags: Vec<String>,
        source: &str,
    ) -> rusqlite::Result<String> {
        let id = format!("mem-{}", uuid_mock());
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        let memory = DbMemory {
            id: id.clone(),
            user_id,
            content: content.to_string(),
            category: category.to_string(),
            importance,
            tags,
            source: source.to_string(),
            created_at: now,
            archived: false,
        };

        self.repo.save_memory(&memory)?;
        Ok(id)
    }

    pub fn retrieve_entries(&self, user_id: i64) -> rusqlite::Result<Vec<DbMemory>> {
        self.repo.load_memories(user_id)
    }

    pub fn delete_entry(&self, id: &str) -> rusqlite::Result<()> {
        self.repo.delete_memory(id)
    }

    pub fn archive_entry(&self, id: &str, user_id: i64) -> rusqlite::Result<()> {
        let memories = self.repo.load_memories(user_id)?;
        if let Some(mut mem) = memories.into_iter().find(|m| m.id == id) {
            mem.archived = true;
            self.repo.save_memory(&mem)?;
        }
        Ok(())
    }

    pub fn search_entries(&self, user_id: i64, query: &str) -> rusqlite::Result<Vec<DbMemory>> {
        let memories = self.repo.load_memories(user_id)?;
        let query_lower = query.to_lowercase();
        
        let filtered: Vec<DbMemory> = memories
            .into_iter()
            .filter(|m| {
                if m.archived {
                    return false;
                }
                
                let content_matches = m.content.to_lowercase().contains(&query_lower);
                let tag_matches = m.tags.iter().any(|t| t.to_lowercase().contains(&query_lower));
                let category_matches = m.category.to_lowercase().contains(&query_lower);
                
                content_matches || tag_matches || category_matches
            })
            .collect();
            
        Ok(filtered)
    }

    pub fn run_cleanup(&self, user_id: i64) -> rusqlite::Result<usize> {
        let memories = self.repo.load_memories(user_id)?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
            
        let mut cleaned_count = 0;
        
        for mut m in memories {
            // Auto-archive short term memories older than 24 hours (86400 seconds)
            // or low importance memories (< 3)
            let age = now - m.created_at;
            let should_clean = (m.category == "ShortTerm" && age > 86400) || (m.importance < 3 && age > 86400 * 7);
            
            if should_clean && !m.archived {
                m.archived = true;
                self.repo.save_memory(&m)?;
                cleaned_count += 1;
            }
        }
        
        Ok(cleaned_count)
    }
}

// Generate simple mock UUID
fn uuid_mock() -> String {
    let mut rng = thread_rng();
    (0..8).map(|_| rng.gen_range(0..16)).map(|b| format!("{:x}", b)).collect()
}
