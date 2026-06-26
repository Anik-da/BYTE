use serde::{Deserialize, Serialize};
use std::process::Command;
use std::thread;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{State, WebviewWindow};
use crate::commands::AppState;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub is_input: bool,
    pub is_default: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VoiceConfig {
    pub microphone_id: String,
    pub speaker_id: String,
    pub wake_word_enabled: bool,
    pub wake_word_sensitivity: f32, // 0.0 to 1.0
    pub always_listening: bool,
    pub push_to_talk: bool,
    pub language: String,
    pub voice_speed: f32, // 0.5 to 2.0
    pub voice_pitch: f32, // 0.5 to 2.0
    pub voice_type: String, // "male", "female", "natural"
    pub noise_reduction: bool,
    pub voice_auth_enabled: bool,
}

impl Default for VoiceConfig {
    fn default() -> Self {
        Self {
            microphone_id: "default".to_string(),
            speaker_id: "default".to_string(),
            wake_word_enabled: true,
            wake_word_sensitivity: 0.5,
            always_listening: false,
            push_to_talk: true,
            language: "en-US".to_string(),
            voice_speed: 1.0,
            voice_pitch: 1.0,
            voice_type: "female".to_string(),
            noise_reduction: true,
            voice_auth_enabled: false,
        }
    }
}

// Global thread control for always-listening/wake word loop
lazy_static::lazy_static! {
    static ref LISTENING_ACTIVE: Arc<AtomicBool> = Arc::new(AtomicBool::new(false));
}

// 1. Text-To-Speech (TTS) via Native Windows Speech Synthesis
#[tauri::command]
pub async fn speak_text(
    text: String,
    config: Option<VoiceConfig>,
) -> Result<bool, String> {
    let cfg = config.unwrap_or_default();
    
    // Convert rate (-10 to 10 scale for System.Speech.Synthesis)
    let rate = ((cfg.voice_speed - 1.0) * 10.0).clamp(-10.0, 10.0) as i32;
    
    // Choose gender voice selection
    let gender_script = match cfg.voice_type.to_lowercase().as_str() {
        "male" => "SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Male)",
        _ => "SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female)",
    };

    let ps_command = format!(
        "Add-Type -AssemblyName System.Speech; \
         $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; \
         $synth.Rate = {}; \
         $synth.{}; \
         $synth.Speak('{}')",
        rate, gender_script, text.replace('\'', "''")
    );

    // Spawn PowerShell in background to run TTS
    thread::spawn(move || {
        let _ = Command::new("powershell.exe")
            .arg("-NoProfile")
            .arg("-Command")
            .arg(&ps_command)
            .output();
    });

    Ok(true)
}

// 2. Audio Device Query
#[tauri::command]
pub async fn get_audio_devices() -> Result<Vec<AudioDevice>, String> {
    // Query local audio endpoints using PowerShell WMI queries
    let ps_command = "Get-CimInstance Win32_PnPEntity | Where-Object { $_.Service -eq 'UAudio' -or $_.Service -eq 'usbaudio' } | Select-Object Name, DeviceID";
    let output = Command::new("powershell.exe")
        .arg("-NoProfile")
        .arg("-Command")
        .arg(ps_command)
        .output()
        .map_err(|e| e.to_string())?;

    let out_str = String::from_utf8_lossy(&output.stdout).to_string();
    
    let mut devices = vec![
        AudioDevice {
            id: "default_input".to_string(),
            name: "Default System Microphone".to_string(),
            is_input: true,
            is_default: true,
        },
        AudioDevice {
            id: "default_output".to_string(),
            name: "Default System Speaker".to_string(),
            is_input: false,
            is_default: true,
        }
    ];

    for line in out_str.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("Name") || trimmed.starts_with("----") {
            continue;
        }
        // Basic parser
        devices.push(AudioDevice {
            id: format!("device-{}", rand_id()),
            name: trimmed.to_string(),
            is_input: trimmed.toLowerCase().contains("mic") || trimmed.toLowerCase().contains("audio in"),
            is_default: false,
        });
    }

    Ok(devices)
}

// 3. Microphone Level Meter
#[tauri::command]
pub async fn test_microphone_level(window: WebviewWindow) -> Result<(), String> {
    // Spawns a background task that feeds simulated microphone waves to the frontend
    thread::spawn(move || {
        let mut rng = rand::thread_rng();
        for _ in 0..30 {
            let amp: f32 = rand::Rng::gen_range(&mut rng, 0.05..0.95);
            let _ = window.emit("audio-level", amp);
            thread::sleep(std::time::Duration::from_millis(150));
        }
        let _ = window.emit("audio-level", 0.0);
    });
    Ok(())
}

// 4. Wake Word / Listening loops
#[tauri::command]
pub async fn start_voice_listening(window: WebviewWindow, state: State<'_, AppState>) -> Result<bool, String> {
    if LISTENING_ACTIVE.load(Ordering::Relaxed) {
        return Ok(true);
    }
    
    LISTENING_ACTIVE.store(true, Ordering::Relaxed);
    let active_flag = LISTENING_ACTIVE.clone();

    thread::spawn(move || {
        let mut mock_phrases = vec![
            "Hey BYTE, what is the server resource status?",
            "What is the system cpu metrics today?",
            "Can you write a rust script to clean system files?",
            "BYTE, tell me a joke about compilers."
        ];
        let mut rng = rand::thread_rng();

        while active_flag.load(Ordering::Relaxed) {
            // Emulate Wake Word checking
            let _ = window.emit("voice-status", "listening");
            
            // Randomly trigger wake word and transcribe
            thread::sleep(std::time::Duration::from_secs(6));
            if !active_flag.load(Ordering::Relaxed) {
                break;
            }

            // Emit wake trigger
            let _ = window.emit("voice-status", "wake-triggered");
            thread::sleep(std::time::Duration::from_secs(1));

            // Transcribe
            let _ = window.emit("voice-status", "transcribing");
            thread::sleep(std::time::Duration::from_secs(2));

            let phrase = mock_phrases[rand::Rng::gen_range(&mut rng, 0..mock_phrases.len())];
            let _ = window.emit("voice-transcript", phrase);
        }
        let _ = window.emit("voice-status", "sleeping");
    });

    Ok(true)
}

#[tauri::command]
pub async fn stop_voice_listening() -> Result<bool, String> {
    LISTENING_ACTIVE.store(false, Ordering::Relaxed);
    Ok(true)
}

// 5. Settings persists
#[tauri::command]
pub async fn save_voice_settings(state: State<'_, AppState>, config: VoiceConfig) -> Result<bool, String> {
    let repo = &state.services.settings_repo;
    let serialized = serde_json::to_string(&config).map_err(|e| e.to_string())?;
    repo.save_setting("voice_engine_config", &serialized).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn load_voice_settings(state: State<'_, AppState>) -> Result<VoiceConfig, String> {
    let repo = &state.services.settings_repo;
    if let Some(serialized) = repo.load_setting("voice_engine_config").map_err(|e| e.to_string())? {
        if let Ok(config) = serde_json::from_str::<VoiceConfig>(&serialized) {
            return Ok(config);
        }
    }
    Ok(VoiceConfig::default())
}

fn rand_id() -> String {
    let mut rng = rand::thread_rng();
    let val: u32 = rand::Rng::gen(&mut rng);
    format!("{:08x}", val)
}
