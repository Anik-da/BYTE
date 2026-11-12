#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::io::Write;
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WindowEvent};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

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
    "1.2.1".to_string()
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

fn get_pythonw_executable() -> String {
    if let Ok(user_profile) = std::env::var("USERPROFILE") {
        let candidates = [
            Path::new(&user_profile).join("AppData").join("Local").join("Python").join("bin").join("pythonw.exe"),
            Path::new(&user_profile).join("AppData").join("Local").join("Programs").join("Python").join("Python314").join("pythonw.exe"),
            Path::new(&user_profile).join("AppData").join("Local").join("Python").join("bin").join("python.exe"),
            Path::new(&user_profile).join("AppData").join("Local").join("Programs").join("Python").join("Python314").join("python.exe"),
        ];
        for path in candidates {
            if path.exists() {
                return path.to_string_lossy().to_string();
            }
        }
    }
    "pythonw".to_string()
}

fn find_backend_script() -> Option<(PathBuf, PathBuf)> {
    let script_names = ["run_forever.py", "main.py"];

    if let Ok(cwd) = std::env::current_dir() {
        for name in script_names {
            let script = cwd.join("backend").join(name);
            if script.exists() {
                return Some((script, cwd));
            }
        }
    }

    let dev_root = PathBuf::from(r"C:\Users\anikd\Downloads\BYTE-main");
    if dev_root.join(".env").exists() {
        for name in script_names {
            let script = dev_root.join("backend").join(name);
            if script.exists() {
                return Some((script, dev_root));
            }
        }
    }

    if let Ok(exe_path) = std::env::current_exe() {
        let mut cur = exe_path.as_path();
        for _ in 0..6 {
            if let Some(parent) = cur.parent() {
                for name in script_names {
                    let direct = parent.join("backend").join(name);
                    if direct.exists() {
                        return Some((direct, parent.to_path_buf()));
                    }
                    let res = parent.join("resources").join("backend").join(name);
                    if res.exists() {
                        return Some((res, parent.join("resources")));
                    }
                    let up_root = parent.join("_up_").join("_up_");
                    let bundled = up_root.join("backend").join(name);
                    if bundled.exists() {
                        return Some((bundled, up_root));
                    }
                }
                cur = parent;
            } else {
                break;
            }
        }
    }

    for name in script_names {
        let script = dev_root.join("backend").join(name);
        if script.exists() {
            return Some((script, dev_root));
        }
    }

    None
}

fn is_backend_running() -> bool {
    let addr: SocketAddr = ([127, 0, 0, 1], 8000).into();
    TcpStream::connect_timeout(&addr, Duration::from_millis(250)).is_ok()
}

fn post_backend_endpoint(path: &str) {
    let addr: SocketAddr = ([127, 0, 0, 1], 8000).into();
    if let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_millis(500)) {
        let req = format!(
            "POST {} HTTP/1.1\r\nHost: 127.0.0.1:8000\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
            path
        );
        let _ = stream.write_all(req.as_bytes());
    }
}

fn spawn_backend_service() {
    #[cfg(target_os = "windows")]
    {
        if is_backend_running() {
            return;
        }
        if let Some((script_path, work_dir)) = find_backend_script() {
            let py_exe = get_pythonw_executable();
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            let _ = Command::new(&py_exe)
                .arg(&script_path)
                .current_dir(&work_dir)
                .creation_flags(CREATE_NO_WINDOW)
                .spawn();
        }
    }
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn main() {
    spawn_backend_service();

    let start_minimized = std::env::args().any(|arg| arg == "--minimized" || arg == "--tray");

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(move |app| {
            if start_minimized {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }

            let show_item = MenuItem::with_id(app, "show", "Show BYTE Mission Control", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "Minimize to Tray", true, None::<&str>)?;
            let listen_item = MenuItem::with_id(app, "listen", "Listen Now (Hey BYTE)", true, None::<&str>)?;
            let quit_ui_item = MenuItem::with_id(app, "quit_ui", "Close UI (Keep 24/7 Engine Running)", true, None::<&str>)?;
            let stop_all_item = MenuItem::with_id(app, "stop_all", "Stop BYTE 24/7 Completely", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[&show_item, &hide_item, &listen_item, &quit_ui_item, &stop_all_item],
            )?;

            let mut tray_builder = TrayIconBuilder::with_id("byte-tray")
                .menu(&menu)
                .tooltip("BYTE Assistant — 24/7 Active")
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "listen" => {
                        std::thread::spawn(|| {
                            post_backend_endpoint("/api/voice/arm");
                        });
                    }
                    "quit_ui" => {
                        app.exit(0);
                    }
                    "stop_all" => {
                        std::thread::spawn(|| {
                            post_backend_endpoint("/api/system/shutdown");
                        });
                        std::thread::sleep(Duration::from_millis(250));
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                show_main_window(app);
                            }
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            tray_builder.build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_app_version,
            get_sys_info,
            open_native_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
