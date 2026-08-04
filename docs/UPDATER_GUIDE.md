# BYTE Auto-Updater & Developer Release Guide

This document explains how the automatic update system works in **BYTE**, how semantic versioning is enforced, and how to publish signed releases using GitHub Releases.

---

## 1. Development Mode Setup

To run BYTE in development mode with React Hot Module Replacement (HMR) and automatic Rust backend rebuilds:

```powershell
# From the frontend directory:
cd frontend
npm run tauri:dev
```

### Hot Reload Features:
- **Frontend**: Vite provides instant React UI state preservation on save.
- **Tauri Shell**: Rust code changes inside `desktop/src-tauri` automatically rebuild the native shell window.
- **Python Backend**: Fast API backend runs on `http://127.0.0.1:8000`.

---

## 2. Production Updater Architecture

BYTE uses Tauri v2's native `plugins.updater` module connected to GitHub Releases:

1. **Manifest Endpoint**: `https://github.com/Anik-da/BYTE/releases/latest/download/latest.json`
2. **Signature Verification**: Updates are signed with a Minisign private key and validated using the public key configured in `tauri.conf.json`.
3. **Zero Data Loss**: User SQLite databases, settings, and MongoDB sync keys are stored in persistent user folders (`%LOCALAPPDATA%/BYTE/` & `%APPDATA%/BYTE/`), ensuring software updates never erase logs or user preferences.

---

## 3. Version Bump Procedure

When preparing a new release (e.g. updating from `1.0.0` to `1.1.0`):

1. **Update `desktop/src-tauri/tauri.conf.json`**:
   ```json
   "version": "1.1.0"
   ```

2. **Update `desktop/src-tauri/Cargo.toml`**:
   ```toml
   version = "1.1.0"
   ```

3. **Update `frontend/src/lib/updater.ts`**:
   ```typescript
   export const CURRENT_APP_VERSION = '1.1.0';
   ```

---

## 4. How to Generate Signing Keys

To generate your cryptographic update signing key pair:

```powershell
npx @tauri-apps/cli signer generate
```

- **Public Key**: Add to `plugins.updater.pubkey` inside `tauri.conf.json`.
- **Private Key**: Add to your GitHub Repository Secrets as `TAURI_SIGNING_PRIVATE_KEY`.

---

## 5. Publishing a New Release

To publish a signed update to all desktop users automatically:

1. Commit your changes and create a git version tag:
   ```powershell
   git add .
   git commit -m "Release v1.1.0: Added enhanced voice features"
   git tag v1.1.0
   git push origin main --tags
   ```

2. **GitHub Actions** will automatically:
   - Build the Windows `.msi` and `.exe` installers.
   - Sign the update binaries with your private key.
   - Generate `latest.json` updater manifest.
   - Attach all assets to the GitHub Release.

3. All installed BYTE desktop applications will prompt the user with the **Update Available** HUD modal on launch!
