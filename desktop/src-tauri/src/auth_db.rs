use rusqlite::{params, Connection, Result};
use std::fs;
use std::path::PathBuf;
use argon2::{
    password_hash::{
        rand_core::OsRng,
        PasswordHash, PasswordHasher, PasswordVerifier, SaltString
    },
    Argon2
};
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce
};
use rand::{RngCore, thread_rng};

pub struct AuthDatabase {
    db_path: PathBuf,
}

impl AuthDatabase {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let db_path = app_data_dir.join("byte_secure.db");
        if let Some(parent) = db_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        
        let db = Self { db_path };
        db.init_tables().expect("Failed to initialize secure database tables");
        db
    }

    fn get_connection(&self) -> Result<Connection> {
        Connection::open(&self.db_path)
    }

    fn init_tables(&self) -> Result<()> {
        let conn = self.get_connection()?;
        
        // Users Table
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

        // Sessions Table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                device_name TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                last_active INTEGER NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )",
            [],
        )?;

        // Voice Profiles Table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS voice_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                profile_name TEXT NOT NULL,
                sample_path TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )",
            [],
        )?;

        // Face Profiles Table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS face_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                profile_name TEXT NOT NULL,
                image_path TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )",
            [],
        )?;

        Ok(())
    }
}

// --- Hashing Helpers (Argon2) ---
pub fn hash_password(password: &str) -> std::result::Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    match argon2.hash_password(password.as_bytes(), &salt) {
        Ok(hash) => Ok(hash.to_string()),
        Err(e) => Err(format!("Argon2 hashing error: {}", e)),
    }
}

pub fn verify_password(password: &str, hash_str: &str) -> bool {
    let argon2 = Argon2::default();
    match PasswordHash::new(hash_str) {
        Ok(parsed_hash) => argon2.verify_password(password.as_bytes(), &parsed_hash).is_ok(),
        Err(_) => false,
    }
}

// --- Encryption Helpers (AES-256-GCM) ---
// Key derivation helper from master password / seed
pub fn derive_key(seed: &str) -> [u8; 32] {
    let mut key = [0u8; 32];
    let bytes = seed.as_bytes();
    for (i, &byte) in bytes.iter().enumerate() {
        key[i % 32] ^= byte;
    }
    key
}

fn encode_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn decode_hex(hex: &str) -> std::result::Result<Vec<u8>, String> {
    if hex.len() % 2 != 0 {
        return Err("Hex string must have an even length".into());
    }
    (0..hex.len())
        .step_by(2)
        .map(|i| {
            u8::from_str_radix(&hex[i..i + 2], 16)
                .map_err(|e| format!("Invalid hex: {}", e))
        })
        .collect()
}

pub fn encrypt_aes(plain_text: &str, key: &[u8; 32]) -> std::result::Result<String, String> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| format!("AES key initialization error: {}", e))?;
    
    let mut nonce_bytes = [0u8; 12];
    thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    let ciphertext = cipher
        .encrypt(nonce, plain_text.as_bytes())
        .map_err(|e| format!("AES encryption error: {}", e))?;
    
    // Combine Nonce + Ciphertext and encode as hex string
    let mut combined = nonce_bytes.to_vec();
    combined.extend(ciphertext);
    Ok(encode_hex(&combined))
}

pub fn decrypt_aes(cipher_text_hex: &str, key: &[u8; 32]) -> std::result::Result<String, String> {
    let combined = decode_hex(cipher_text_hex)?;
    
    if combined.len() < 12 {
        return Err("Ciphertext too short (missing nonce)".into());
    }
    
    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);
    
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| format!("AES key initialization error: {}", e))?;
    
    let decrypted_bytes = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("AES decryption error: {}", e))?;
    
    String::from_utf8(decrypted_bytes)
        .map_err(|e| format!("UTF8 decoding error: {}", e))
}
