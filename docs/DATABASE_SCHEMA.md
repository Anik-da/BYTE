# Database Schema Document — BYTE

## 1. Overview
BYTE currently utilizes a lightweight local-first filesystem configuration system (`config.json`). In Phase 3, this configuration will be migrated to a structured local database using SQLite via Tauri's official SQL plugin (`tauri-plugin-sql`).

---

## 2. Proposed SQLite Database Schema

### Table: `settings`
Stores core application configurations.
```sql
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Table: `users`
Stores user profile information.
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar TEXT, -- Base64 payload or file path
    role TEXT DEFAULT 'Admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Table: `terminal_history`
Stores persistent terminal command logs for shell quick-access.
```sql
CREATE TABLE terminal_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shell TEXT NOT NULL, -- 'powershell', 'cmd', etc.
    command TEXT NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Table: `pinned_folders`
Stores folders pinned in the File Explorer.
```sql
CREATE TABLE pinned_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    path TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
