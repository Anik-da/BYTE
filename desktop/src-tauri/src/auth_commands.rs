use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::path::PathBuf;
use tauri::{AppHandle, State, Manager};
use rand::{Rng, thread_rng};
use crate::auth_db::{
    AuthDatabase, hash_password, verify_password, derive_key, encrypt_aes, decrypt_aes
};

// Global DB wrapper state
pub struct AuthState {
    pub db: Mutex<Option<AuthDatabase>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UserProfile {
    pub id: i64,
    pub username: String,
    pub name: String,
    pub avatar: Option<String>,
    pub preferences: String, // Plain JSON
    pub settings: String,      // Plain JSON
    pub permissions: String,   // Plain JSON
}

#[derive(Serialize, Deserialize, Debug)]
pub struct RegistrationResult {
    pub recovery_key: String,
    pub user: UserProfile,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SessionInfo {
    pub session_id: String,
    pub user_id: i64,
    pub device_name: String,
    pub created_at: i64,
}

// Initialize secure db state helper
pub fn init_auth_db(app: &AppHandle) {
    let app_dir = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    let db = AuthDatabase::new(app_dir);
    let state: State<AuthState> = app.state();
    if let Ok(mut guard) = state.db.lock() {
        *guard = Some(db);
    }
}

// Generate secure random recovery key
fn generate_recovery_key() -> String {
    let mut rng = thread_rng();
    let chars: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let key: String = (0..16)
        .map(|i| {
            if i > 0 && i % 4 == 0 {
                format!("-{}", chars[rng.gen_range(0..chars.len())] as char)
            } else {
                format!("{}", chars[rng.gen_range(0..chars.len())] as char)
            }
        })
        .collect();
    key
}

#[tauri::command]
pub async fn register_user(
    state: State<'_, AuthState>,
    username: String,
    name: String,
    password: std::string::String,
    security_q1: String,
    security_a1: String,
    security_q2: String,
    security_a2: String,
    preferences: String,
    settings: String,
    permissions: String,
    avatar: Option<String>,
) -> Result<RegistrationResult, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("Database not initialized")?;
    
    let password_hash = hash_password(&password)?;
    let security_answer_hash_1 = hash_password(&security_a1)?;
    let security_answer_hash_2 = hash_password(&security_a2)?;
    let recovery_key = generate_recovery_key();
    
    // Derived key for AES encryption of fields
    let user_crypto_key = derive_key(&password);
    
    let encrypted_prefs = encrypt_aes(&preferences, &user_crypto_key)?;
    let encrypted_settings = encrypt_aes(&settings, &user_crypto_key)?;
    let encrypted_permissions = encrypt_aes(&permissions, &user_crypto_key)?;

    let conn = db.get_connection().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO users (
            username, name, password_hash, recovery_key,
            security_question_1, security_answer_hash_1,
            security_question_2, security_answer_hash_2,
            preferences, settings, permissions, avatar
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        rusqlite::params![
            username, name, password_hash, recovery_key,
            security_q1, security_answer_hash_1,
            security_q2, security_answer_hash_2,
            encrypted_prefs, encrypted_settings, encrypted_permissions, avatar
        ],
    ).map_err(|e| format!("Registration failed: {}", e))?;

    let last_id = conn.last_insert_rowid();

    Ok(RegistrationResult {
        recovery_key,
        user: UserProfile {
            id: last_id,
            username,
            name,
            avatar,
            preferences,
            settings,
            permissions,
        },
    })
}

#[tauri::command]
pub async fn login_user(
    state: State<'_, AuthState>,
    username: String,
    password: std::string::String,
    device_name: String,
) -> Result<UserProfile, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("Database not initialized")?;
    let conn = db.get_connection().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT id, name, password_hash, preferences, settings, permissions, avatar FROM users WHERE username = ?1"
    ).map_err(|e| e.to_string())?;

    let row = stmt.query_row(rusqlite::params![username], |r| {
        Ok((
            r.get::<_, i64>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, String>(2)?,
            r.get::<_, String>(3)?,
            r.get::<_, String>(4)?,
            r.get::<_, String>(5)?,
            r.get::<_, Option<String>>(6)?,
        ))
    }).map_err(|_| "User not found".to_string())?;

    let (id, name, stored_hash, enc_prefs, enc_settings, enc_permissions, avatar) = row;
    
    if !verify_password(&password, &stored_hash) {
        return Err("Invalid password".to_string());
    }

    // Derive encryption key to decrypt fields
    let user_crypto_key = derive_key(&password);
    
    let preferences = decrypt_aes(&enc_prefs, &user_crypto_key)?;
    let settings = decrypt_aes(&enc_settings, &user_crypto_key)?;
    let permissions = decrypt_aes(&enc_permissions, &user_crypto_key)?;

    // Create session
    let session_id = format!("sess-{}", uuid_mock());
    let now = tauri::utils::assets::phf::phf_map! {}.len() as i64 + std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0) as i64;

    conn.execute(
        "INSERT INTO sessions (id, user_id, device_name, created_at, last_active, is_active)
         VALUES (?1, ?2, ?3, ?4, ?5, 1)",
        rusqlite::params![session_id, id, device_name, now, now],
    ).map_err(|e| e.to_string())?;

    Ok(UserProfile {
        id,
        username,
        name,
        avatar,
        preferences,
        settings,
        permissions,
    })
}

#[tauri::command]
pub async fn verify_windows_hello(message: String) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        // Dynamic binding check to handle Windows Hello cleanly
        use windows::Security::Credentials::UI::{UserConsentVerifier, UserConsentVerificationResult};
        match UserConsentVerifier::RequestVerificationAsync(&windows::core::HSTRING::from(&message)) {
            Ok(op) => match op.await {
                Ok(res) => Ok(res == UserConsentVerificationResult::Verified),
                Err(e) => Err(format!("Windows Hello execution failed: {}", e)),
            },
            Err(e) => Err(format!("Windows Hello check failed: {}", e)),
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = message;
        Err("Windows Hello is only available on Windows operating systems.".to_string())
    }
}

// Biometric Enrollment & Verification Mock Architectures
#[tauri::command]
pub async fn voice_auth_enroll(state: State<'_, AuthState>, user_id: i64, profile_name: String, sample_path: String) -> Result<bool, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("Database not initialized")?;
    let conn = db.get_connection().map_err(|e| e.to_string())?;
    
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap().as_secs() as i64;
        
    conn.execute(
        "INSERT INTO voice_profiles (user_id, profile_name, sample_path, created_at) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![user_id, profile_name, sample_path, now]
    ).map_err(|e| e.to_string())?;
    
    Ok(true)
}

#[tauri::command]
pub async fn voice_auth_verify(state: State<'_, AuthState>, user_id: i64, current_sample_path: String) -> Result<bool, String> {
    let _ = current_sample_path;
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("Database not initialized")?;
    let conn = db.get_connection().map_err(|e| e.to_string())?;
    
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM voice_profiles WHERE user_id = ?1",
        rusqlite::params![user_id],
        |r| r.get(0)
    ).unwrap_or(0);
    
    if count > 0 {
        // Biometric matches (mock matching logic for future pipeline)
        Ok(true)
    } else {
        Err("No voice profile enrolled for this user.".to_string())
    }
}

#[tauri::command]
pub async fn face_auth_enroll(state: State<'_, AuthState>, user_id: i64, profile_name: String, image_path: String) -> Result<bool, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("Database not initialized")?;
    let conn = db.get_connection().map_err(|e| e.to_string())?;
    
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap().as_secs() as i64;
        
    conn.execute(
        "INSERT INTO face_profiles (user_id, profile_name, image_path, created_at) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![user_id, profile_name, image_path, now]
    ).map_err(|e| e.to_string())?;
    
    Ok(true)
}

#[tauri::command]
pub async fn face_auth_verify(state: State<'_, AuthState>, user_id: i64, current_image_path: String) -> Result<bool, String> {
    let _ = current_image_path;
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("Database not initialized")?;
    let conn = db.get_connection().map_err(|e| e.to_string())?;
    
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM face_profiles WHERE user_id = ?1",
        rusqlite::params![user_id],
        |r| r.get(0)
    ).unwrap_or(0);
    
    if count > 0 {
        // Face matches (mock matching logic for future OpenCV vision module)
        Ok(true)
    } else {
        Err("No face profile enrolled for this user.".to_string())
    }
}

#[tauri::command]
pub async fn list_local_users(state: State<'_, AuthState>) -> Result<Vec<UserProfile>, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("Database not initialized")?;
    let conn = db.get_connection().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare("SELECT id, username, name, avatar FROM users")
        .map_err(|e| e.to_string())?;
        
    let list = stmt.query_map([], |r| {
        Ok(UserProfile {
            id: r.get(0)?,
            username: r.get(1)?,
            name: r.get(2)?,
            avatar: r.get(3)?,
            preferences: "{}".to_string(),
            settings: "{}".to_string(),
            permissions: "{}".to_string(),
        })
    }).map_err(|e| e.to_string())?
    .filter_map(Result::ok)
    .collect();
    
    Ok(list)
}

// Generate simple mock UUID
fn uuid_mock() -> String {
    let mut rng = thread_rng();
    (0..8).map(|_| rng.gen_range(0..16)).map(|b| format!("{:x}", b)).collect()
}
