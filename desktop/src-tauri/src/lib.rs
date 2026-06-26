use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Stdio};
use std::sync::{Mutex, OnceLock};
use tauri::Manager;

mod auth_db;
mod auth_commands;
mod db;
mod repositories;
mod memory;
mod cache;
mod services;
mod commands;
mod ai;
mod voice;


#[derive(Serialize)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub hostname: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppConfig {
    pub theme_mode: String,
    pub accent_color: String,
    pub animations_enabled: bool,
    pub user_name: Option<String>,
    pub user_email: Option<String>,
    pub user_avatar: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            theme_mode: "dark".to_string(),
            accent_color: "blue".to_string(),
            animations_enabled: true,
            user_name: None,
            user_email: None,
            user_avatar: None,
        }
    }
}

#[derive(Serialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
}

#[derive(Serialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu: f32,
    pub memory: u64,
}

#[derive(Serialize)]
pub struct DiskInfo {
    pub name: String,
    pub mount_point: String,
    pub total: u64,
    pub available: u64,
}

#[derive(Serialize)]
pub struct SystemMetrics {
    pub cpu_usage: f32,
    pub ram_used: u64,
    pub ram_total: u64,
    pub disks: Vec<DiskInfo>,
    pub processes: Vec<ProcessInfo>,
}

#[derive(Clone, Serialize)]
struct TerminalPayload {
    session_id: String,
    data: String,
}

// Global state for terminal processes
static TERMINAL_STDIN: OnceLock<Mutex<HashMap<String, ChildStdin>>> = OnceLock::new();
static TERMINAL_PROCESSES: OnceLock<Mutex<HashMap<String, Child>>> = OnceLock::new();

fn get_terminal_stdin_map() -> &'static Mutex<HashMap<String, ChildStdin>> {
    TERMINAL_STDIN.get_or_init(|| Mutex::new(HashMap::new()))
}

fn get_terminal_processes_map() -> &'static Mutex<HashMap<String, Child>> {
    TERMINAL_PROCESSES.get_or_init(|| Mutex::new(HashMap::new()))
}

// Helper to get the path to the config file
fn get_config_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let mut path = app_handle
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?;
    // Ensure the config directory exists
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }
    path.push("config.json");
    Ok(path)
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        hostname: hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "unknown".to_string()),
    }
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn load_config(app_handle: tauri::AppHandle) -> AppConfig {
    if let Ok(path) = get_config_path(&app_handle) {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(path) {
                if let Ok(config) = serde_json::from_str::<AppConfig>(&content) {
                    return config;
                }
            }
        }
    }
    AppConfig::default()
}

#[tauri::command]
fn save_config(app_handle: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    let path = get_config_path(&app_handle)?;
    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------- Clipboard Commands ----------------
#[tauri::command]
fn write_clipboard(text: String) -> Result<(), String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(text).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn read_clipboard() -> Result<String, String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.get_text().map_err(|e| e.to_string())
}

// ---------------- RFD Dialog Commands ----------------
#[tauri::command]
fn show_message_dialog(title: String, message: String, level: String) -> Result<(), String> {
    let rfd_level = match level.as_str() {
        "warning" => rfd::MessageLevel::Warning,
        "error" => rfd::MessageLevel::Error,
        _ => rfd::MessageLevel::Info,
    };
    rfd::MessageDialog::new()
        .set_title(&title)
        .set_description(&message)
        .set_level(rfd_level)
        .show();
    Ok(())
}

#[tauri::command]
fn show_file_picker(title: String, is_folder: bool) -> Result<Option<String>, String> {
    if is_folder {
        let folder = rfd::FileDialog::new()
            .set_title(&title)
            .pick_folder();
        Ok(folder.map(|p| p.to_string_lossy().to_string()))
    } else {
        let file = rfd::FileDialog::new()
            .set_title(&title)
            .pick_file();
        Ok(file.map(|p| p.to_string_lossy().to_string()))
    }
}

// ---------------- File Explorer Commands ----------------
#[tauri::command]
fn read_dir(path: String) -> Result<Vec<FileInfo>, String> {
    let mut files = Vec::new();
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    for entry in entries {
        if let Ok(entry) = entry {
            if let Ok(metadata) = entry.metadata() {
                let modified = metadata.modified()
                    .map(|t| t.duration_since(std::time::SystemTime::UNIX_EPOCH).unwrap_or_default().as_secs())
                    .unwrap_or(0);
                files.push(FileInfo {
                    name: entry.file_name().to_string_lossy().to_string(),
                    path: entry.path().to_string_lossy().to_string(),
                    is_dir: metadata.is_dir(),
                    size: metadata.len(),
                    modified,
                });
            }
        }
    }
    files.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            b.is_dir.cmp(&a.is_dir)
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });
    Ok(files)
}

#[tauri::command]
fn create_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_file_or_dir(path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);
    if path_buf.is_dir() {
        fs::remove_dir_all(path).map_err(|e| e.to_string())
    } else {
        fs::remove_file(path).map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn rename_file_or_dir(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(old_path, new_path).map_err(|e| e.to_string())
}

// ---------------- System Telemetry Commands ----------------
#[tauri::command]
fn get_system_metrics() -> Result<SystemMetrics, String> {
    use sysinfo::{CpuExt, DiskExt, ProcessExt, System, SystemExt};
    let mut sys = System::new_all();
    sys.refresh_cpu();
    // Tiny sleep for CPU calculation
    std::thread::sleep(std::time::Duration::from_millis(50));
    sys.refresh_cpu();
    sys.refresh_memory();
    sys.refresh_disks();
    sys.refresh_processes();

    let cpu_usage = sys.global_cpu_info().cpu_usage();
    let ram_used = sys.used_memory();
    let ram_total = sys.total_memory();

    let mut disks = Vec::new();
    for disk in sys.disks() {
        disks.push(DiskInfo {
            name: disk.name().to_string_lossy().to_string(),
            mount_point: disk.mount_point().to_string_lossy().to_string(),
            total: disk.total_space(),
            available: disk.available_space(),
        });
    }

    let mut processes = Vec::new();
    for (pid, process) in sys.processes() {
        processes.push(ProcessInfo {
            pid: pid.as_u32(),
            name: process.name().to_string(),
            cpu: process.cpu_usage(),
            memory: process.memory(),
        });
    }
    processes.sort_by(|a, b| b.cpu.partial_cmp(&a.cpu).unwrap_or(std::cmp::Ordering::Equal));
    processes.truncate(15);

    Ok(SystemMetrics {
        cpu_usage,
        ram_used,
        ram_total,
        disks,
        processes,
    })
}

#[tauri::command]
fn kill_process(pid: u32) -> Result<(), String> {
    use sysinfo::{Pid, ProcessExt, System, SystemExt};
    let mut sys = System::new_all();
    sys.refresh_processes();
    if let Some(process) = sys.process(Pid::from(pid as usize)) {
        process.kill();
        Ok(())
    } else {
        Err("Process not found".to_string())
    }
}

// ---------------- Terminal Spawning & I/O ----------------
#[tauri::command]
fn spawn_terminal(app_handle: tauri::AppHandle, session_id: String, shell: String) -> Result<(), String> {
    let shell_cmd = if shell == "cmd" {
        "cmd.exe"
    } else {
        "powershell.exe"
    };

    let mut child = std::process::Command::new(shell_cmd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let stdin = child.stdin.take().ok_or("Failed to open stdin")?;
    let stdout = child.stdout.take().ok_or("Failed to open stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to open stderr")?;

    {
        let mut map = get_terminal_stdin_map().lock().unwrap();
        map.insert(session_id.clone(), stdin);
    }
    
    {
        let mut proc_map = get_terminal_processes_map().lock().unwrap();
        proc_map.insert(session_id.clone(), child);
    }

    let app_handle_clone = app_handle.clone();
    let session_id_clone = session_id.clone();
    std::thread::spawn(move || {
        use std::io::Read;
        let mut buffer = [0; 1024];
        let mut stdout = stdout;
        while let Ok(n) = stdout.read(&mut buffer) {
            if n == 0 { break; }
            if let Ok(text) = String::from_utf8(buffer[..n].to_vec()) {
                let _ = app_handle_clone.emit("terminal-stdout", TerminalPayload {
                    session_id: session_id_clone.clone(),
                    data: text,
                });
            }
        }
    });

    let app_handle_clone2 = app_handle.clone();
    let session_id_clone2 = session_id.clone();
    std::thread::spawn(move || {
        use std::io::Read;
        let mut buffer = [0; 1024];
        let mut stderr = stderr;
        while let Ok(n) = stderr.read(&mut buffer) {
            if n == 0 { break; }
            if let Ok(text) = String::from_utf8(buffer[..n].to_vec()) {
                let _ = app_handle_clone2.emit("terminal-stdout", TerminalPayload {
                    session_id: session_id_clone2.clone(),
                    data: text,
                });
            }
        }
    });

    Ok(())
}

#[tauri::command]
fn write_terminal_input(session_id: String, input: String) -> Result<(), String> {
    let mut map = get_terminal_stdin_map().lock().unwrap();
    if let Some(stdin) = map.get_mut(&session_id) {
        stdin.write_all(input.as_bytes()).map_err(|e| e.to_string())?;
        stdin.flush().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Terminal session not found".to_string())
    }
}

#[tauri::command]
fn kill_terminal(session_id: String) -> Result<(), String> {
    {
        let mut map = get_terminal_stdin_map().lock().unwrap();
        map.remove(&session_id);
    }
    {
        let mut proc_map = get_terminal_processes_map().lock().unwrap();
        if let Some(mut child) = proc_map.remove(&session_id) {
            let _ = child.kill();
        }
    }
    Ok(())
}

// ---------------- Autostart & Window Modes ----------------
#[tauri::command]
fn set_autostart(enabled: bool) -> Result<(), String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();
    
    if enabled {
        let status = std::process::Command::new("reg")
            .args(&[
                "add",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                "BYTE",
                "/t",
                "REG_SZ",
                "/d",
                &exe_path,
                "/f"
            ])
            .status()
            .map_err(|e| e.to_string())?;
        if !status.success() {
            return Err("Failed to add autostart key".to_string());
        }
    } else {
        let _ = std::process::Command::new("reg")
            .args(&[
                "delete",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                "BYTE",
                "/f"
            ])
            .status();
    }
    Ok(())
}

#[tauri::command]
fn is_autostart_enabled() -> Result<bool, String> {
    let output = std::process::Command::new("reg")
        .args(&[
            "query",
            "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
            "/v",
            "BYTE"
        ])
        .output();

    match output {
        Ok(out) => Ok(out.status.success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
fn set_always_on_top(app_handle: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        window.set_always_on_top(enabled).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Manage Auth State and initialize secure SQLite db
            app.manage(auth_commands::AuthState {
                db: std::sync::Mutex::new(None),
            });
            auth_commands::init_auth_db(app.handle());

            // Initialize Module 04 unified database and core services
            let app_dir = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
            let services = services::Services::new(app_dir);
            app.manage(commands::AppState { services });

            // Build Tray Icon Menu
            let quit_i = tauri::menu::MenuItemBuilder::with_id("quit", "Quit BYTE").build(app)?;
            let toggle_i = tauri::menu::MenuItemBuilder::with_id("toggle", "Show/Hide Window").build(app)?;
            let menu = tauri::menu::MenuBuilder::new(app)
                .items(&[&toggle_i, &quit_i])
                .build()?;

            let _tray = tauri::tray::TrayIconBuilder::new()
                .menu(&menu)
                .icon(app.default_window_icon().cloned().unwrap())
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "toggle" => {
                            if let Some(window) = app.get_webview_window("main") {
                                if let Ok(visible) = window.is_visible() {
                                    if visible {
                                        let _ = window.hide();
                                    } else {
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                    }
                                }
                            }
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            get_app_version,
            load_config,
            save_config,
            write_clipboard,
            read_clipboard,
            show_message_dialog,
            show_file_picker,
            read_dir,
            create_dir,
            delete_file_or_dir,
            rename_file_or_dir,
            get_system_metrics,
            kill_process,
            spawn_terminal,
            write_terminal_input,
            kill_terminal,
            set_autostart,
            is_autostart_enabled,
            set_always_on_top,
            
            // Authentication & Security Commands
            auth_commands::register_user,
            auth_commands::login_user,
            auth_commands::verify_windows_hello,
            auth_commands::voice_auth_enroll,
            auth_commands::voice_auth_verify,
            auth_commands::face_auth_enroll,
            auth_commands::face_auth_verify,
            auth_commands::list_local_users,

            // Core Database & Memory Engine Commands
            commands::save_user,
            commands::load_user,
            commands::save_settings,
            commands::load_settings,
            commands::save_memory,
            commands::load_memory,
            commands::save_chat,
            commands::load_chat,
            commands::create_workspace,
            commands::open_workspace,
            commands::save_logs,
            commands::load_logs,
            commands::index_files_meta,

            // AI Core Commands
            ai::ai_chat_complete,
            ai::ai_chat_stream,
            ai::test_provider_connection,

            // Voice Engine Commands
            voice::speak_text,
            voice::get_audio_devices,
            voice::test_microphone_level,
            voice::start_voice_listening,
            voice::stop_voice_listening,
            voice::save_voice_settings,
            voice::load_voice_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
