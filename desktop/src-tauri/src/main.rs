#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Serialize, Deserialize)]
struct SysInfo {
    os: String,
    arch: String,
    platform: String,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("BYTE Desktop Shell initialized. Greetings, {}!", name)
}

#[tauri::command]
fn get_app_version() -> String {
    "1.1.0".to_string()
}

#[tauri::command]
fn get_sys_info() -> SysInfo {
    SysInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        platform: "Windows 11 Desktop Workstation".to_string(),
    }
}

#[tauri::command]
fn open_native_app(target: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let status = Command::new("cmd")
            .args(["/C", "start", "", &target])
            .status();

        match status {
            Ok(s) if s.success() => Ok(format!("Successfully launched {}", target)),
            Ok(_) => Err(format!("Command exited with non-zero status launching {}", target)),
            Err(e) => Err(format!("Failed to execute process launcher: {}", e)),
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Native process launcher is optimized for Windows 11 platform.".to_string())
    }
}

fn spawn_backend_service() {
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("powershell")
            .args(["-Command", "Start-Process python -ArgumentList 'backend/main.py' -WindowStyle Hidden"])
            .spawn();
    }
}

fn main() {
    spawn_backend_service();

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_app_version,
            get_sys_info,
            open_native_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
