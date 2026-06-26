use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use std::thread;
use tauri::{AppHandle, State, WebviewWindow, Manager};
use crate::commands::AppState;
use crate::auth_db::{decrypt_aes, derive_key};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChatOptions {
    pub temperature: Option<f32>,
    pub max_tokens: Option<i32>,
    pub top_p: Option<f32>,
    pub presence_penalty: Option<f32>,
    pub frequency_penalty: Option<f32>,
    pub stream: Option<bool>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ModelConfig {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub is_local: bool,
}

// Command wrappers for frontend
#[tauri::command]
pub async fn ai_chat_complete(
    state: State<'_, AppState>,
    provider: String,
    model: String,
    messages: Vec<ChatMessage>,
    options: ChatOptions,
    key_seed: String,
) -> Result<String, String> {
    let api_key = get_decrypted_key(&state, &provider, &key_seed)?;
    let api_url = get_provider_url(&state, &provider)?;

    perform_sync_request(&provider, &model, &messages, &options, api_key.as_deref(), api_url.as_deref())
}

#[tauri::command]
pub async fn ai_chat_stream(
    window: WebviewWindow,
    state: State<'_, AppState>,
    provider: String,
    model: String,
    messages: Vec<ChatMessage>,
    options: ChatOptions,
    key_seed: String,
) -> Result<(), String> {
    let api_key = get_decrypted_key(&state, &provider, &key_seed)?;
    let api_url = get_provider_url(&state, &provider)?;

    let provider_clone = provider.clone();
    let model_clone = model.clone();
    let messages_clone = messages.clone();
    let options_clone = options.clone();

    // Spawn a background thread to read stream without blocking the main event loop
    thread::spawn(move || {
        let _ = perform_stream_request(
            &window,
            &provider_clone,
            &model_clone,
            &messages_clone,
            &options_clone,
            api_key.as_deref(),
            api_url.as_deref(),
        );
    });

    Ok(())
}

#[tauri::command]
pub async fn test_provider_connection(
    state: State<'_, AppState>,
    provider: String,
    model: String,
    api_key: Option<String>,
    api_url: Option<String>,
) -> Result<bool, String> {
    let messages = vec![ChatMessage {
        role: "user".to_string(),
        content: "ping".to_string(),
    }];
    let options = ChatOptions {
        temperature: Some(0.1),
        max_tokens: Some(5),
        top_p: None,
        presence_penalty: None,
        frequency_penalty: None,
        stream: Some(false),
    };

    let res = perform_sync_request(
        &provider,
        &model,
        &messages,
        &options,
        api_key.as_deref(),
        api_url.as_deref(),
    );
    
    match res {
        Ok(text) => Ok(!text.is_empty()),
        Err(e) => Err(e),
    }
}

// --- Helper Functions to Decrypt Keys & Retrieve URLs from Settings ---
fn get_decrypted_key(state: &State<'_, AppState>, provider: &str, seed: &str) -> Result<Option<String>, String> {
    let key_name = format!("api_key_{}", provider.to_lowercase());
    let repo = &state.services.settings_repo;
    
    let enc_val = repo.load_setting(&key_name).map_err(|e| e.to_string())?;
    if let Some(enc) = enc_val {
        let aes_key = derive_key(seed);
        let dec = decrypt_aes(&enc, &aes_key)?;
        Ok(Some(dec))
    } else {
        Ok(None)
    }
}

fn get_provider_url(state: &State<'_, AppState>, provider: &str) -> Result<Option<String>, String> {
    let key_name = format!("api_url_{}", provider.to_lowercase());
    let repo = &state.services.settings_repo;
    
    let url = repo.load_setting(&key_name).map_err(|e| e.to_string())?;
    Ok(url)
}

// --- Dynamic Payload Builder ---
fn build_payload(
    provider: &str,
    model: &str,
    messages: &[ChatMessage],
    options: &ChatOptions,
    stream: bool,
) -> String {
    #[derive(Serialize)]
    struct OpenAIStyleMessage {
        role: String,
        content: String,
    }

    #[derive(Serialize)]
    struct OpenAIStylePayload {
        model: String,
        messages: Vec<OpenAIStyleMessage>,
        temperature: f32,
        max_tokens: Option<i32>,
        stream: bool,
    }

    let formatted_messages: Vec<OpenAIStyleMessage> = messages
        .iter()
        .map(|m| OpenAIStyleMessage {
            role: m.role.clone(),
            content: m.content.clone(),
        })
        .collect();

    let temp = options.temperature.unwrap_or(0.7);

    match provider.to_lowercase().as_str() {
        "gemini" => {
            // Google Gemini API payload
            #[derive(Serialize)]
            struct Part {
                text: String,
            }
            #[derive(Serialize)]
            struct Content {
                role: String,
                parts: Vec<Part>,
            }
            #[derive(Serialize)]
            struct GeminiPayload {
                contents: Vec<Content>,
            }
            let gemini_messages = messages
                .iter()
                .map(|m| Content {
                    role: if m.role == "assistant" { "model".to_string() } else { "user".to_string() },
                    parts: vec![Part { text: m.content.clone() }],
                })
                .collect();
            serde_json::to_string(&GeminiPayload { contents: gemini_messages }).unwrap_or_default()
        }
        "ollama" => {
            // Ollama API payload
            #[derive(Serialize)]
            struct OllamaPayload {
                model: String,
                messages: Vec<OpenAIStyleMessage>,
                stream: bool,
                options: serde_json::Value,
            }
            serde_json::to_string(&OllamaPayload {
                model: model.to_string(),
                messages: formatted_messages,
                stream,
                options: serde_json::json!({
                    "temperature": temp,
                    "num_predict": options.max_tokens,
                }),
            }).unwrap_or_default()
        }
        _ => {
            // OpenAI, LM Studio, OpenRouter, Anthropic-compatible, Azure, etc.
            let payload = OpenAIStylePayload {
                model: model.to_string(),
                messages: formatted_messages,
                temperature: temp,
                max_tokens: options.max_tokens,
                stream,
            };
            serde_json::to_string(&payload).unwrap_or_default()
        }
    }
}

// --- Perform Synchronous HTTP Call via Native Curl ---
fn perform_sync_request(
    provider: &str,
    model: &str,
    messages: &[ChatMessage],
    options: &ChatOptions,
    api_key: Option<&str>,
    api_url: Option<&str>,
) -> Result<String, String> {
    let payload = build_payload(provider, model, messages, options, false);
    
    let url = match api_url {
        Some(custom) if !custom.trim().is_empty() => custom.to_string(),
        _ => match provider.to_lowercase().as_str() {
            "openai" => "https://api.openai.com/v1/chat/completions".to_string(),
            "anthropic" => "https://api.anthropic.com/v1/messages".to_string(),
            "gemini" => format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                model,
                api_key.unwrap_or("")
            ),
            "ollama" => "http://localhost:11434/api/chat".to_string(),
            "lmstudio" => "http://localhost:1234/v1/chat/completions".to_string(),
            "openrouter" => "https://openrouter.ai/api/v1/chat/completions".to_string(),
            _ => "http://localhost:11434/api/chat".to_string(),
        },
    };

    let mut cmd = Command::new("curl.exe");
    cmd.arg("-s")
       .arg("-X")
       .arg("POST")
       .arg(&url)
       .arg("-H")
       .arg("Content-Type: application/json");

    if provider.to_lowercase() == "anthropic" {
        cmd.arg("-H").arg("x-api-key: ".to_owned() + api_key.unwrap_or(""))
           .arg("-H").arg("anthropic-version: 2023-06-01");
    } else if provider.to_lowercase() != "gemini" {
        if let Some(key) = api_key {
            cmd.arg("-H").arg(format!("Authorization: Bearer {}", key));
        }
    }

    cmd.arg("-d").arg(&payload);

    let output = cmd.output().map_err(|e| format!("Failed to execute curl: {}", e))?;
    if !output.status.success() {
        let err_str = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("Request failed: {}", err_str));
    }

    let resp_str = String::from_utf8_lossy(&output.stdout).to_string();
    parse_response(provider, &resp_str)
}

// --- Perform Streaming HTTP Call via Native Curl ---
fn perform_stream_request(
    window: &WebviewWindow,
    provider: &str,
    model: &str,
    messages: &[ChatMessage],
    options: &ChatOptions,
    api_key: Option<&str>,
    api_url: Option<&str>,
) -> Result<(), String> {
    let payload = build_payload(provider, model, messages, options, true);
    
    let url = match api_url {
        Some(custom) if !custom.trim().is_empty() => custom.to_string(),
        _ => match provider.to_lowercase().as_str() {
            "openai" => "https://api.openai.com/v1/chat/completions".to_string(),
            "anthropic" => "https://api.anthropic.com/v1/messages".to_string(),
            "gemini" => format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?key={}",
                model,
                api_key.unwrap_or("")
            ),
            "ollama" => "http://localhost:11434/api/chat".to_string(),
            "lmstudio" => "http://localhost:1234/v1/chat/completions".to_string(),
            "openrouter" => "https://openrouter.ai/api/v1/chat/completions".to_string(),
            _ => "http://localhost:11434/api/chat".to_string(),
        },
    };

    let mut cmd = Command::new("curl.exe");
    cmd.arg("-s")
       .arg("-N") // Disable buffering
       .arg("-X")
       .arg("POST")
       .arg(&url)
       .arg("-H")
       .arg("Content-Type: application/json");

    if provider.to_lowercase() == "anthropic" {
        cmd.arg("-H").arg("x-api-key: ".to_owned() + api_key.unwrap_or(""))
           .arg("-H").arg("anthropic-version: 2023-06-01");
    } else if provider.to_lowercase() != "gemini" {
        if let Some(key) = api_key {
            cmd.arg("-H").arg(format!("Authorization: Bearer {}", key));
        }
    }

    cmd.arg("-d").arg(&payload);
    cmd.stdout(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn curl: {}", e))?;
    let stdout = child.stdout.take().ok_or("Failed to open child process stdout")?;
    let reader = BufReader::new(stdout);

    for line in reader.lines() {
        if let Ok(line_str) = line {
            if line_str.trim().is_empty() {
                continue;
            }
            if let Some(chunk) = parse_stream_chunk(provider, &line_str) {
                let _ = window.emit("ai-chunk", chunk);
            }
        }
    }

    let _ = child.wait();
    let _ = window.emit("ai-done", true);
    Ok(())
}

// --- Response Parsers ---
fn parse_response(provider: &str, resp: &str) -> Result<String, String> {
    let json: serde_json::Value = serde_json::from_str(resp)
        .map_err(|_| format!("Invalid JSON response: {}", resp))?;

    match provider.to_lowercase().as_str() {
        "gemini" => {
            let text = json["candidates"][0]["content"]["parts"][0]["text"]
                .as_str()
                .ok_or_else(|| format!("Empty response: {}", resp))?;
            Ok(text.to_string())
        }
        "ollama" => {
            let text = json["message"]["content"]
                .as_str()
                .ok_or_else(|| format!("Empty response: {}", resp))?;
            Ok(text.to_string())
        }
        _ => {
            // OpenAI and compatibles
            let text = json["choices"][0]["message"]["content"]
                .as_str()
                .ok_or_else(|| format!("Empty response: {}", resp))?;
            Ok(text.to_string())
        }
    }
}

fn parse_stream_chunk(provider: &str, line: &str) -> Option<String> {
    if provider.to_lowercase() == "ollama" {
        let json: serde_json::Value = serde_json::from_str(line).ok()?;
        return json["message"]["content"].as_str().map(|s| s.to_string());
    }

    // OpenAI and compatible format
    if !line.starts_with("data: ") {
        return None;
    }
    let data = line.strip_prefix("data: ")?.trim();
    if data == "[DONE]" {
        return None;
    }

    let json: serde_json::Value = serde_json::from_str(data).ok()?;
    
    if provider.to_lowercase() == "gemini" {
        return json["candidates"][0]["content"]["parts"][0]["text"].as_str().map(|s| s.to_string());
    }

    json["choices"][0]["delta"]["content"].as_str().map(|s| s.to_string())
}
