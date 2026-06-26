# API Specification — BYTE

## 1. Tauri Backend IPC Commands
These Rust commands are registered on the Tauri builder and invoked from the React frontend via `@tauri-apps/api/core` -> `invoke`.

### 1.1 Config Operations
- **`load_config()`**
  - **Returns**: `AppConfig` JSON object
- **`save_config(config: AppConfig)`**
  - **Arguments**: `{ config: AppConfig }`
  - **Returns**: `Result<Void, String>`

### 1.2 System Info & Telemetry
- **`get_system_info()`**
  - **Returns**: `SystemInfo { os: string, arch: string, hostname: string }`
- **`get_system_metrics()`**
  - **Returns**: `SystemMetrics { cpu_usage: f32, cpu_cores: Vec<f32>, ram_used: u64, ram_total: u64, disks: Vec<DiskInfo>, processes: Vec<ProcessInfo> }`

### 1.3 Native Dialogs & Clipboard
- **`show_message_dialog(title: string, message: string, level: string)`**
  - **Arguments**: `{ title: string, message: string, level: 'info' | 'warning' | 'error' }`
- **`select_file(title: string, filter: string)`**
  - **Returns**: `Option<String>` (Absolute path of selected file)
- **`write_clipboard(text: string)`** / **`read_clipboard()`**

### 1.4 Native File Explorer
- **`read_dir(path: string)`**
  - **Returns**: `Vec<FileInfo { name: string, path: string, is_dir: bool, size: u64, modified: u64 }>`

---

## 2. Tauri Async Event Streams
Events emitted from the Rust backend to the React frontend.

### 2.1 Terminal Output
- **Event Name**: `terminal-stdout`
- **Payload**: `{ data: String }` (Text with ANSI codes)

### 2.2 System Monitor Live Data
- **Event Name**: `system-metrics-update`
- **Payload**: `SystemMetrics` object
