# Quiet Browse

A personal browser for macOS and Windows that supports:

- Blocking domains outright
- Daily per-domain time budgets
- A focus mode that allows only approved domains
- Local-only settings and usage history

## Run locally

Requires Node.js 20+.

```bash
npm install
npm start
```

After pulling a runtime update, run `npm install` again before starting the app.

If your machine has an old `--openssl-legacy-provider` value in `NODE_OPTIONS`, the start command clears it only for Electron. This avoids a compatibility error from recent Electron versions on both macOS and Windows.

All settings are saved locally in Electron's application-data directory:

- macOS: `~/Library/Application Support/Quiet Browse`
- Windows: `%APPDATA%/Quiet Browse`

## Create an installable app

Build on the target operating system where possible.

```bash
# macOS: creates a .dmg in release/
npm run dist:mac

# Windows: creates an NSIS installer (.exe) in release/
npm run dist:win
```

The Windows installer adds Start Menu and desktop shortcuts, and lets the user choose the install location. Windows may show a SmartScreen warning for an unsigned application; code-signing is needed before public distribution.

## Current MVP scope

The browser area is an Electron `BrowserView`; its network requests are evaluated before navigation. A blocked page is shown when a domain is denied, and active-tab time is accumulated every second while the app is focused.

This is a personal productivity tool, not a security boundary: system-level browser access, VPNs, or another browser are outside its control.
