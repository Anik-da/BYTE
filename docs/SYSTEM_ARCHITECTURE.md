# System Architecture Document — BYTE

## 1. Architectural Overview
BYTE is built using a hybrid desktop architecture consisting of a **Rust Core** (backend/host) and a **React + TypeScript View Layer** (frontend/client). Communication is brokered via Tauri's high-speed IPC bridge.

```
+-------------------------------------------------------+
|                 React Client (Webview)                |
|  - Theme Store & Auth Store (Zustand)                 |
|  - File Explorer View & Terminal UI                   |
|  - System Monitor Charts                              |
+-------------------------------------------------------+
                           |
                           v IPC (Tauri Invokes & Events)
+-------------------------------------------------------+
|                  Tauri Rust Core (Host)               |
|  - Terminal Runner (PTY/Subprocess Piped I/O)         |
|  - File Manager (std::fs, Native Dialogs)            |
|  - System Metrics Engine (sysinfo crate)              |
|  - Tray Icon & Registry (winreg Autostart)            |
+-------------------------------------------------------+
                           |
                           v OS APIs
+-------------------------------------------------------+
|                    Operating System                   |
+-------------------------------------------------------+
```

---

## 2. Core Modules

### 2.1 Window Manager
- Custom frameless window handles drag regions natively via `data-tauri-drag-region`.
- Rust controls window actions (Minimize, Maximize, Toggle, Always-on-top).

### 2.2 Native Terminal Integration
- Operates a bi-directional event stream.
- A background worker thread reads output from the spawned command shell process (e.g. PowerShell) and broadcasts it to the frontend via `emit()`. Input characters are written directly to the child process's stdin.

### 2.3 Filesystem Service
- Local directory reads are batched. Metadata (name, type, size, modified date) is compiled into a JSON array and sent to the client.

### 2.4 System Info Collector
- A dedicated background thread compiles system telemetry (CPU usage, free memory, active processes) at a configurable interval (default: 2s) and pushes update events to the client.

---

## 3. Data Flow Policies
- **IPC Safety**: No raw shell strings are executed unchecked. Commands spawned are locked to standard shell targets (PowerShell/CMD).
- **Filesystem Constraints**: Access is scoped to the user's home directories.
