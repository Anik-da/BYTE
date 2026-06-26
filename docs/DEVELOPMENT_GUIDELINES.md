# Development Guidelines — BYTE

## 1. Directory Structure Rules
- **Modular and Feature-First**: Keep UI code inside `src/components/` and pages inside `src/pages/`. Feature specific placeholders belong inside `src/features/`.
- **Rust Backend**: All Rust source code is contained within `src-tauri/src/`. Keep command handlers organized.

---

## 2. Code Quality & Standards

### React Frontend
- Use **TypeScript** strictly; avoid utilizing `any`. Declare precise interface typings.
- Standardize layout elements with CSS variables using Tailwind v4 custom themes. Do not inject hardcoded arbitrary colors.

### Rust Backend
- Wrap all command results in `Result<T, String>` to allow correct error handling in JS catch blocks.
- Minimize third-party crates to reduce bundle size and cargo build times.
- Ensure cross-platform build stability by guarding platform-specific code (e.g. `#[cfg(target_os = "windows")]`).

---

## 3. Deployment & Verification
- Verify TypeScript before committing using:
  `npx tsc --noEmit`
- Run local builds to confirm production bundler functionality:
  `npm run build`
- Format Rust code:
  `cargo fmt`
