# BYTE Production Deployment & Release Guide

This guide details the complete deployment workflow for **BYTE AI Assistant**, including native installer packaging (NSIS/MSI), cryptographic binary signing, and automated GitHub Release distribution.

---

## 1. Prerequisites & Environment Setup

### Required Tools
- **Node.js**: v18+ (`npm v10+`)
- **Rust Toolchain**: `stable-x86_64-pc-windows-msvc` (`cargo 1.75+`)
- **Python**: 3.10+ (with `pip install -r backend/requirements.txt`)
- **Tauri CLI**: Installed locally or via `npx @tauri-apps/cli`

---

## 2. Local Production Build

### Step 1: Compile Frontend Assets
```powershell
cd frontend
npm run build
```

### Step 2: Build Native Windows Installer (.msi / .exe)
```powershell
cd ../desktop/src-tauri
cargo tauri build
```
The compiled installer binaries will be placed in:
`desktop/src-tauri/target/release/bundle/nsis/BYTE_1.0.0_x64-setup.exe`

---

## 3. Cryptographic Keypair Setup for Auto-Updates

Generate Minisign keypair using Tauri CLI:
```powershell
npx @tauri-apps/cli signer generate
```
1. Copy the **Public Key** into `desktop/src-tauri/tauri.conf.json` under `plugins.updater.pubkey`.
2. Add secret variables to your GitHub Repository (`https://github.com/Anik-da/BYTE`):
   - `TAURI_SIGNING_PRIVATE_KEY`: Content of the generated private key.
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: Key password (if configured).

---

## 4. Automated Release Pipeline

BYTE includes an automated GitHub Actions workflow (`.github/workflows/release.yml`).

To trigger an automated release build:
```powershell
git tag v1.0.0
git push origin v1.0.0
```

The CI workflow will:
1. Compile the React + TypeScript frontend bundle.
2. Build the Tauri v2 Rust executable for Windows x64.
3. Package NSIS installer and signature files (`BYTE_1.0.0_x64-setup.exe.sig`).
4. Generate `latest.json` release manifest.
5. Publish all assets directly to `https://github.com/Anik-da/BYTE/releases/tag/v1.0.0`.
