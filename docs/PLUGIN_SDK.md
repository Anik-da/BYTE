# Plugin SDK Specification — BYTE

## 1. Overview
BYTE's extensible architecture supports dynamic plugins loaded at runtime. Plugins can register new Command Palette actions, introduce custom Dashboard cards, or call native Rust hooks.

---

## 2. Plugin Structure
A BYTE plugin is packaged as a `.tar.gz` archive containing a `manifest.json` metadata file and an entrypoint script:

```
my-plugin/
├── manifest.json
└── index.js
```

### Manifest Example (`manifest.json`)
```json
{
  "id": "com.example.system-cleanup",
  "name": "System Cleaner",
  "version": "1.0.0",
  "description": "Purges temporary system directories.",
  "permissions": ["fs:read", "fs:write"]
}
```

---

## 3. Plugin APIs

### Frontend SDK
Plugins can access global APIs injected into their sandbox context:
```javascript
// Register a Command Palette action
byte.commands.register({
  label: "Clean Temp Files",
  category: "action",
  action: async () => {
    const deletedCount = await byte.fs.cleanTemp();
    byte.notifications.success(`Removed ${deletedCount} files.`);
  }
});
```
