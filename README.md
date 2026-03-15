# Broadcaster Administrator

A crisp desktop app for managing [Broadcaster](https://github.com/ByHeads/Broadcaster) instances. Built with Electron and the the Broadcaster API.

## Installation

**[Download the latest release](https://github.com/ByHeads/bcadmin/releases/latest)**

| Platform | Architecture | Formats |
| --- | --- | --- |
| Windows | x64 | `.exe` installer, `.msi` |
| macOS | Apple Silicon | `.dmg` |
| macOS | Intel | `.dmg` |
| Linux | x64, arm64 | `.AppImage`, `.deb` |

### Quick install

**Windows** (PowerShell):
```plain
irm https://raw.githubusercontent.com/ByHeads/bcadmin/main/scripts/install.ps1 | iex
```

**macOS / Linux**:
```plain
curl -fsSL https://raw.githubusercontent.com/ByHeads/bcadmin/main/scripts/install.sh | bash
```

After installation, the app checks for updates automatically and will prompt you when a new version is available.

### Getting started

On first launch, you'll be asked to add a connection to a Broadcaster instance. You need:

- **URL** — the Broadcaster's base URL (e.g. `https://broadcaster.example.com/api`)
- **API key** — a RESTable API key with access to the admin resources

API keys are stored securely in the OS keychain (macOS Keychain, Windows Credential Manager, or libsecret on Linux).

---

## Development

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
