use serde::{Deserialize, Serialize};
use tauri::State;
use crate::services::Services;
use crate::repositories::{DbChat, DbMemory, DbWorkspace};

// Global services state wrapper
pub struct AppState {
    pub services: Services,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UserResponse {
    pub id: i64,
    pub username: String,
    pub name: String,
    pub avatar: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MemoryResponse {
    pub id: String,
    pub content: String,
    pub category: String,
    pub importance: i32,
    pub tags: Vec<String>,
    pub source: String,
    pub created_at: i64,
    pub archived: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChatResponse {
    pub id: String,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub model_id: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LogResponse {
    pub id: i64,
    pub level: String,
    pub category: String,
    pub message: String,
    pub timestamp: i64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct WorkspaceResponse {
    pub id: String,
    pub path: String,
    pub name: String,
    pub created_at: i64,
    pub is_active: bool,
}

// 1. User commands
#[tauri::command]
pub async fn save_user(
    state: State<'_, AppState>,
    user_id: i64,
    name: String,
    avatar: Option<String>,
) -> Result<bool, String> {
    state.services.user_repo
        .update_user_profile(user_id, &name, avatar.as_deref())
        .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn load_user(
    state: State<'_, AppState>,
    user_id: i64,
) -> Result<Option<UserResponse>, String> {
    let user = state.services.user_repo
        .get_user_by_id(user_id)
        .map_err(|e| e.to_string())?;
    Ok(user.map(|u| UserResponse {
        id: u.id,
        username: u.username,
        name: u.name,
        avatar: u.avatar,
    }))
}

// 2. Settings commands
#[tauri::command]
pub async fn save_settings(
    state: State<'_, AppState>,
    key: String,
    value: String,
    encrypt_key: Option<String>,
) -> Result<bool, String> {
    let service = crate::services::SettingsService::new(
        state.services.settings_repo.clone(),
        state.services.cache.clone()
    );
    service.save_setting(&key, &value, encrypt_key.as_deref())?;
    Ok(true)
}

#[tauri::command]
pub async fn load_settings(
    state: State<'_, AppState>,
    key: String,
    decrypt_key: Option<String>,
) -> Result<Option<String>, String> {
    let service = crate::services::SettingsService::new(
        state.services.settings_repo.clone(),
        state.services.cache.clone()
    );
    service.load_setting(&key, decrypt_key.as_deref())
}

// 3. Memory commands
#[tauri::command]
pub async fn save_memory(
    state: State<'_, AppState>,
    user_id: i64,
    key_seed: String,
    content: String,
    category: String,
    importance: i32,
    tags: Vec<String>,
    source: String,
) -> Result<String, String> {
    let service = crate::services::MemoryService::new(state.services.memory_engine.clone());
    service.save_memory(user_id, &key_seed, &content, &category, importance, tags, &source)
}

#[tauri::command]
pub async fn load_memory(
    state: State<'_, AppState>,
    user_id: i64,
    key_seed: String,
) -> Result<Vec<MemoryResponse>, String> {
    let service = crate::services::MemoryService::new(state.services.memory_engine.clone());
    let list = service.retrieve_memories(user_id, &key_seed)?;
    Ok(list.into_iter().map(|m| MemoryResponse {
        id: m.id,
        content: m.content,
        category: m.category,
        importance: m.importance,
        tags: m.tags,
        source: m.source,
        created_at: m.created_at,
        archived: m.archived,
    }).collect())
}

// 4. Chat History commands
#[tauri::command]
pub async fn save_chat(
    state: State<'_, AppState>,
    chat_id: String,
    user_id: i64,
    title: String,
    model_id: String,
    messages_json: String, // Encrypted or serialized message list
) -> Result<bool, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let chat = DbChat {
        id: chat_id.clone(),
        user_id,
        title,
        created_at: now,
        updated_at: now,
        model_id,
    };

    state.services.chat_repo.save_chat(&chat).map_err(|e| e.to_string())?;
    
    // Save messages block
    let msg_id = format!("msg-{}", rand_id());
    let msg = DbMessage {
        id: msg_id,
        chat_id,
        role: "system".to_string(),
        content: messages_json,
        timestamp: now,
        metadata: None,
    };
    state.services.chat_repo.save_message(&msg).map_err(|e| e.to_string())?;

    Ok(true)
}

#[tauri::command]
pub async fn load_chat(
    state: State<'_, AppState>,
    user_id: i64,
) -> Result<Vec<ChatResponse>, String> {
    let list = state.services.chat_repo.load_chats(user_id).map_err(|e| e.to_string())?;
    Ok(list.into_iter().map(|c| ChatResponse {
        id: c.id,
        title: c.title,
        created_at: c.created_at,
        updated_at: c.updated_at,
        model_id: c.model_id,
    }).collect())
}

// 5. Workspace commands
#[tauri::command]
pub async fn create_workspace(
    state: State<'_, AppState>,
    path: String,
    name: String,
) -> Result<WorkspaceResponse, String> {
    let service = crate::services::WorkspaceService::new(state.services.workspace_repo.clone());
    let ws = service.create_workspace(&path, &name)?;
    Ok(WorkspaceResponse {
        id: ws.id,
        path: ws.path,
        name: ws.name,
        created_at: ws.created_at,
        is_active: ws.is_active,
    })
}

#[tauri::command]
pub async fn open_workspace(
    state: State<'_, AppState>,
    workspace_id: String,
) -> Result<bool, String> {
    let service = crate::services::WorkspaceService::new(state.services.workspace_repo.clone());
    service.open_workspace(&workspace_id)?;
    Ok(true)
}

// 6. Logging commands
#[tauri::command]
pub async fn save_logs(
    state: State<'_, AppState>,
    level: String,
    category: String,
    message: String,
) -> Result<bool, String> {
    let service = crate::services::LoggingService::new(state.services.log_repo.clone());
    service.log(&level, &category, &message);
    Ok(true)
}

#[tauri::command]
pub async fn load_logs(
    state: State<'_, AppState>,
    limit: usize,
) -> Result<Vec<LogResponse>, String> {
    let service = crate::services::LoggingService::new(state.services.log_repo.clone());
    let list = service.retrieve_logs(limit)?;
    Ok(list.into_iter().map(|l| LogResponse {
        id: l.id,
        level: l.level,
        category: l.category,
        message: l.message,
        timestamp: l.timestamp,
    }).collect())
}

// 7. File Index Command
#[tauri::command]
pub async fn index_files_meta(
    state: State<'_, AppState>,
    folder_path: String,
) -> Result<usize, String> {
    let service = crate::services::FileIndexService::new(state.services.db_pool.clone());
    service.index_folder_metadata(&folder_path)
}

fn rand_id() -> String {
    let mut rng = rand::thread_rng();
    let val: u32 = rand::Rng::gen(&mut rng);
    format!("{:08x}", val)
}
