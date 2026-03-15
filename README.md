![img](splash.png)

A crisp desktop app for managing [Broadcaster](https://github.com/ByHeads/Broadcaster) instances. Built with Electron and the Broadcaster API.

## 🍧 Features

- Everything you can do in [bcman](https://docs.heads.com/broadcaster/e/applications/broadcaster-manager)
- A fresh modern Electron-based GUI application that works on Windows, Mac and Linux
- Control one or more Broadcasters over network or running on the same computer
- Store connection credentials in the keychain, no more copy-pasting API keys and URLs on each connection
- Support for auto-configuring connections to Broadcasters running on the same computer
- Support for editing the app settings of Broadcasters running on the same computer
- Broadcaster documentation viewer built-in
- Viewing logs and downloading files is now waaay easier

### 🚀 Quick install 

**Windows** (PowerShell):
```plain
irm https://raw.githubusercontent.com/ByHeads/bcadmin/main/install.ps1 | iex
```

**macOS / Linux**:
```plain
curl -fsSL https://raw.githubusercontent.com/ByHeads/bcadmin/main/install.sh | bash
```

## 🌟 Getting started

Install using one of the scripts above, or by downloading binaries from the [latest release page](https://github.com/ByHeads/bcadmin/releases/latest). For Windows, check for the `.exe` or `.msi` installers.

On first launch, you'll be asked to add a connection to a Broadcaster instance. You need:

- **URL** — the Broadcaster's base URL (e.g. `https://broadcaster.example-company.heads-api.com`)
- **API key** — an API key with access to the admin resources

API keys are stored securely in the OS keychain (macOS Keychain, Windows Credential Manager, or libsecret on Linux).

## 🤓 Development

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- npm >= 9

### Setup

```sh
npm install
```

### Running in dev mode

```sh
npm run dev
```

This starts electron-vite with hot-reload for the renderer process.

### Type checking and linting

```sh
npm run typecheck     # Check both main and renderer
npm run lint          # ESLint
npm run format        # Prettier
```

### Building

```sh
npm run build         # Compile to out/
npm run start         # Preview the compiled build
```

### Packaging for distribution

```sh
npm run dist          # Build + package for current platform
npm run dist:mac      # macOS (dmg + zip, arm64 + x64)
npm run dist:win      # Windows (nsis + msi, x64)
npm run dist:linux    # Linux (AppImage + deb, x64)
```

Distributables are written to `release/`.

### Project structure

```
src/
├── main/             Electron main process (window, IPC, keychain, auto-updater)
├── preload/          Context bridge (typed window.api)
├── renderer/
│   └── src/
│       ├── api/      HTTP + WebSocket clients for the RESTable API
│       ├── components/
│       ├── pages/
│       └── stores/   Zustand state (connections, auth)
└── shared/           Types shared between main and renderer
```
