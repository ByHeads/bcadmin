# Localization Spec: Swedish (sv-SE)

## Goal

Add Swedish as an alternative UI language to bcadmin. English remains the default. The user can switch language at runtime via a setting; the preference persists across sessions.

---

## 1. Framework

**react-i18next** + **i18next**

- Standard React localization stack, well-supported, tiny runtime (~8 kB gzipped)
- Supports interpolation, plurals, nesting, context, and namespace splitting
- React integration via `useTranslation()` hook and `<Trans>` component

### Packages to install

```
npm i i18next react-i18next
```

No backend loader needed — translations are bundled as JSON imports.

---

## 2. File Structure

```
src/renderer/src/
  i18n/
    index.ts              # i18next init + language detection
    en/
      common.json         # Shared: buttons, states, errors, labels
      nav.json            # Sidebar navigation, section headers
      overview.json       # Overview page
      receivers.json      # Receivers page + tabs
      dashboards.json     # Dashboards page + tabs
      notifications.json  # Notifications page
      deploy.json         # Remote page + all deploy tabs (Install, Uninstall, ISM, etc.)
      deployment.json     # Deployment page + tabs
      replication.json    # Replication page + tabs
      terminals.json      # Terminals page
      logs.json           # Logs page + tabs
      settings.json       # Settings page + tabs (Config, Update, Restart, Dependencies, Connections)
      connection.json     # Connection screen, ReAuth, ConnectionDrop
    sv/
      (same files as en/)
```

### Namespace mapping

Each JSON file is an i18next **namespace**. Components load only the namespaces they need:

```tsx
const { t } = useTranslation('deploy')
// t('install.button') → "Install" | "Installera"
```

The `common` namespace is the default fallback and is always loaded.

---

## 3. i18next Configuration

```ts
// src/renderer/src/i18n/index.ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Import all namespace JSONs
import enCommon from './en/common.json'
import enNav from './en/nav.json'
// ... all en/ files
import svCommon from './sv/common.json'
import svNav from './sv/nav.json'
// ... all sv/ files

i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon, nav: enNav, /* ... */ },
    sv: { common: svCommon, nav: svNav, /* ... */ }
  },
  lng: localStorage.getItem('bcadmin-lang') ?? 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false } // React already escapes
})

export default i18n
```

Initialize in `main.tsx` before `<App />`:

```tsx
import './i18n'
```

---

## 4. Language Switcher

Add a language toggle in the sidebar bottom section (next to Docs/Connections), or in Settings. A simple `EN | SV` toggle button that calls:

```ts
i18n.changeLanguage(lang)
localStorage.setItem('bcadmin-lang', lang)
```

---

## 5. String Inventory

### 5.1 common.json — Shared strings (~60 keys)

**Buttons & actions:**
| Key | English | Swedish |
|-----|---------|---------|
| `button.install` | Install | Installera |
| `button.uninstall` | Uninstall | Avinstallera |
| `button.launch` | Launch | Starta |
| `button.reset` | Reset | Aterstall |
| `button.restart` | Restart | Starta om |
| `button.start` | Start | Starta |
| `button.stop` | Stop | Stoppa |
| `button.cancel` | Cancel | Avbryt |
| `button.confirm` | Confirm | Bekrafta |
| `button.save` | Save | Spara |
| `button.dismiss` | Dismiss | Avfarda |
| `button.download` | Download | Ladda ner |
| `button.refresh` | Refresh | Uppdatera |
| `button.copy` | Copy | Kopiera |
| `button.connect` | Connect | Anslut |
| `button.disconnect` | Disconnect | Koppla fran |
| `button.generate` | Generate | Generera |
| `button.close` | Close | Stang |

**States & status:**
| Key | English | Swedish |
|-----|---------|---------|
| `state.loading` | Loading... | Laddar... |
| `state.saving` | Saving... | Sparar... |
| `state.connecting` | Connecting... | Ansluter... |
| `state.executing` | Executing operation... | Utfor operation... |
| `state.inProgress` | In progress... | Pagar... |
| `state.success` | Success | Lyckades |
| `state.failed` | Failed | Misslyckades |
| `state.copied` | Copied! | Kopierat! |
| `state.connected` | Connected | Ansluten |
| `state.disconnected` | Disconnected | Frankopp lad |
| `state.upToDate` | Up to date | Uppdaterad |
| `state.configured` | Configured | Konfigurerad |
| `state.notConfigured` | Not configured | Ej konfigurerad |

**Labels:**
| Key | English | Swedish |
|-----|---------|---------|
| `label.product` | Product | Produkt |
| `label.version` | Version | Version |
| `label.status` | Status | Status |
| `label.workstation` | Workstation | Arbetsstation |
| `label.details` | Details | Detaljer |
| `label.url` | URL | URL |
| `label.name` | Name | Namn |
| `label.id` | ID | ID |
| `label.apiKey` | API Key | API-nyckel |

**Plurals (i18next interpolation):**
| Key | English | Swedish |
|-----|---------|---------|
| `count.succeeded` | {{count}} succeeded | {{count}} lyckades |
| `count.failed` | {{count}} failed | {{count}} misslyckades |
| `count.workstations` | {{count}} workstation(s) | {{count}} arbetsstation(er) |
| `count.notifications` | {{count}} notification(s) | {{count}} avisering(ar) |
| `count.rows` | {{count}} rows | {{count}} rader |

### 5.2 nav.json — Sidebar (~20 keys)

| Key | English | Swedish |
|-----|---------|---------|
| `overview` | Overview | Oversikt |
| `section.monitoring` | MONITORING | OVERVAKNING |
| `receivers` | Receivers | Mottagare |
| `dashboards` | Dashboards | Instrumentpaneler |
| `notifications` | Notifications | Aviseringar |
| `section.operations` | OPERATIONS | OPERATIONER |
| `remote` | Remote | Fjarrstyrning |
| `deployment` | Deployment | Distribution |
| `replication` | Replication | Replikering |
| `section.tools` | TOOLS | VERKTYG |
| `terminals` | Terminals | Terminaler |
| `logs` | Logs | Loggar |
| `settings` | Settings | Installningar |
| `docs` | Docs | Dokumentation |
| `connections` | Connections | Anslutningar |
| `logout` | Logout | Logga ut |

### 5.3 Per-page namespaces

Each page namespace contains 20-80 keys covering:
- Page title and tab labels
- Table column headers
- Form labels, placeholders, and validation messages
- Dialog titles, messages, and details
- Info/warning banners
- Empty states and error messages
- Status text and format strings

Full key definitions are provided below for the largest namespaces.

#### deploy.json (~120 keys) — Remote page

```jsonc
{
  "title": "Remote",
  "tab": {
    "install": "Install",
    "uninstall": "Uninstall",
    "manualLaunch": "Manual Launch",
    "serviceControl": "Service Control",
    "reset": "Reset",
    "closeDayJournal": "Close Day Journal",
    "downloadFile": "Download File",
    "ism": "ISM",
    "installToken": "Install Token"
  },
  "target": {
    "label": "Target Workstations",
    "all": "(All)",
    "selected": "({{count}} selected)",
    "search": "Search workstations...",
    "selectAll": "Select all ({{count}})",
    "noMatch": "No workstations match \"{{query}}\""
  },
  "install": {
    "receiverInfo": "Receiver cannot be remote-installed. Use the Install Script Maker (ISM) tab to generate an install script for new receivers.",
    "csaNote": "CSA and WPF Client are mutually exclusive. POS Server is excluded when CSA is selected.",
    "runtimeId": "Runtime ID",
    "loadingVersions": "Loading versions...",
    "noVersions": "No launched versions available",
    "confirmTitle": "Install {{product}}",
    "confirmMessage": "Install {{product}} {{version}} on {{count}} workstation(s)?",
    "confirmDetail": "Runtime: {{runtime}}"
  },
  "uninstall": {
    "legacyToggle": "Legacy uninstall",
    "legacyInfo": "Legacy mode uninstalls all products without product selection.",
    "manualClient": "Manual client",
    "labelPlaceholder": "e.g. Heads Testmiljo",
    "confirmLegacyTitle": "Legacy Uninstall",
    "confirmLegacyMessage": "Legacy uninstall on {{count}} workstation(s)?",
    "confirmLegacyDetail": "All products will be removed",
    "confirmTitle": "Uninstall {{product}}",
    "confirmMessage": "Uninstall {{product}} on {{count}} workstation(s)?"
  },
  "serviceControl": {
    "command": "Command",
    "receiverInfo": "Receiver only supports Restart.",
    "wpfInfo": "WPF Client only supports Stop.",
    "confirmTitle": "{{command}} {{product}}",
    "confirmMessage": "{{command}} {{product}} on {{count}} workstation(s)?"
  },
  "manualLaunch": {
    "noVersions": "No deployed versions available",
    "confirmTitle": "Manual Launch {{product}}",
    "confirmMessage": "Launch {{product}} {{version}} on {{count}} workstation(s)?"
  },
  "reset": {
    "warningTitle": "Day journals must be closed first",
    "warningMessage": "Run Close Day Journal before resetting to avoid data loss.",
    "confirmTitle": "Reset",
    "confirmMessage": "Reset {{count}} workstation(s)?",
    "confirmDetail": "Ensure day journals have been closed before proceeding."
  },
  "closeDayJournal": {
    "credentialsHeader": "POS Server Credentials",
    "posUser": "POS User",
    "posPassword": "POS Password",
    "confirmTitle": "Close Day Journal",
    "confirmMessage": "Close day journal on {{count}} workstation(s)?",
    "confirmDetail": "POS user: {{user}}"
  },
  "ism": {
    "targetUrl": "Target Broadcaster URL",
    "installToken": "Install Token",
    "preInstall": "Pre-install Options",
    "software": "Software to Install",
    "oneLiner": "PowerShell One-Liner",
    "uninstallExisting": "Uninstall existing software first",
    "legacyUninstall": "Include legacy (SUS/RA) uninstall",
    "installReceiver": "Install Receiver",
    "installWpf": "Install WpfClient",
    "installCsa": "Install CustomerServiceApplication",
    "installPosServer": "Install PosServer",
    "usePosServer": "Use POS Server",
    "useArchiveServer": "Use Archive Server",
    "createDump": "Create dump",
    "manualClient": "Manual client",
    "label": "Label",
    "collation": "Collation",
    "dbImageSize": "Database Image Size (MB)",
    "dbLogSize": "Database Log Size (MB)",
    "hostedInfo": "Hosted Broadcaster detected — script includes IP diagnostic steps",
    "verifying": "Verifying...",
    "expires": "Expires: {{date}}"
  }
}
```

#### logs.json (~40 keys)

```jsonc
{
  "title": "Logs",
  "tab": {
    "broadcaster": "Broadcaster Logs",
    "connections": "Connection Attempts",
    "feed": "Feed Messages"
  },
  "column": {
    "logFile": "Log File",
    "time": "Time",
    "workstation": "Workstation",
    "ip": "IP",
    "token": "Token",
    "foreignReplacements": "Foreign Replacements",
    "received": "Received",
    "type": "Type",
    "message": "Message"
  },
  "search": "Search in log...",
  "noMatches": "No matches",
  "matchCount": "{{index}}/{{total}}",
  "empty": {
    "logFiles": "No log files available",
    "connections": "No connection attempts recorded",
    "feed": "No feed messages available"
  },
  "loadingContent": "Loading log content...",
  "loadingFiles": "Loading...",
  "count": {
    "attempts": "{{count}} attempt(s) — refreshing every 10s",
    "messages": "{{count}} message(s) — refreshing every 10s",
    "overflow": "1000+ (showing latest 1000)"
  }
}
```

#### connection.json (~50 keys)

```jsonc
{
  "title": "Broadcaster Administrator",
  "section": {
    "connections": "Connections",
    "detected": "Detected on this computer"
  },
  "form": {
    "url": "Broadcaster URL",
    "name": "Name",
    "apiKey": "API Key",
    "newApiKey": "New API Key",
    "title": "Title"
  },
  "placeholder": {
    "apiKey": "API key for localhost:8101",
    "enterApiKey": "Enter API key",
    "filterConnections": "Filter...",
    "urlExample": "store5 or https://broadcaster.store5.heads-api.com/api",
    "nameExample": "e.g. Production Store 5"
  },
  "button": {
    "connect": "Connect",
    "newConnection": "New Broadcaster connection",
    "addConnection": "Add connection",
    "editConnections": "Edit connections",
    "doneEditing": "Done editing",
    "testConnection": "Test connection",
    "editConnection": "Edit connection",
    "removeConnection": "Remove connection"
  },
  "dialog": {
    "removeTitle": "Remove connection",
    "removeMessage": "Remove '{{name}}'? The API key will be permanently deleted.",
    "activeWarning": "This is the active connection. You will be disconnected."
  },
  "reauth": {
    "title": "Authentication failed",
    "message": "The API key for '{{name}}' was rejected (401/403). Enter a new API key to reconnect.",
    "reconnect": "Reconnect"
  },
  "drop": {
    "message": "Connection lost",
    "reconnecting": "attempting to reconnect...",
    "retrying": "retrying automatically every 5s",
    "retryNow": "Retry now"
  },
  "security": {
    "httpWarning": "Unencrypted HTTP — credentials sent in plaintext",
    "keychainUnavailable": "Credential encryption unavailable",
    "keychainDetail": "API keys will be stored without encryption."
  },
  "status": {
    "active": "Active",
    "lastConnected": "Last connected: {{date}}",
    "testSuccess": "Connection successful",
    "testFailed": "Connection failed"
  },
  "validation": {
    "required": "Required",
    "titleUrlRequired": "Title and URL are required",
    "apiKeyRequired": "API key is required for new connections",
    "invalidUrl": "Invalid URL",
    "keepCurrent": "(leave blank to keep current)"
  },
  "local": "Local Broadcaster",
  "noMatches": "No matches",
  "copyUrl": "Copy URL"
}
```

### 5.4 Strings that should NOT be translated

The following remain in English regardless of locale:
- Product names: `Receiver`, `WpfClient`, `PosServer`, `CustomerServiceApplication`
- Technical identifiers: runtime IDs, collation codes, API paths
- Workstation IDs (data from server)
- Log file names and log content
- JSON keys and API resource names
- Version numbers
- The word "Broadcaster" (product name)

---

## 6. Implementation Plan

### Phase 1 — Setup (~1 hour)

1. Install `i18next` and `react-i18next`
2. Create `src/renderer/src/i18n/` structure
3. Create `en/common.json` and `sv/common.json` with shared strings
4. Initialize i18next in `main.tsx`
5. Add language preference to `localStorage`

### Phase 2 — Migrate strings, page by page (~4-6 hours)

For each page/component, replace hardcoded strings with `t()` calls:

```tsx
// Before
<h1>Overview</h1>

// After
const { t } = useTranslation('overview')
<h1>{t('title')}</h1>
```

**Migration order** (by string count, largest first):
1. `common` — shared buttons, states, labels (used everywhere)
2. `nav` + `AppShell` — sidebar navigation
3. `connection` — ConnectionScreen, ReAuth, ConnectionDrop
4. `deploy` — Remote page + 9 tabs (most strings)
5. `settings` — Settings page + 5 tabs
6. `logs` — Logs page + 3 tabs
7. `dashboards` — Dashboards page + 3 tabs
8. `receivers` — Receivers page + 6 tabs
9. `deployment` — Deployment page + 5 tabs
10. `replication` — Replication page + 4 tabs
11. `terminals` — Terminals page
12. `notifications` — Notifications page
13. `overview` — Overview page

### Phase 3 — Swedish translations (~2-3 hours)

Translate all `sv/*.json` files. ~400-500 total keys.

### Phase 4 — Language switcher UI (~30 min)

Add EN/SV toggle to sidebar or settings.

---

## 7. Conventions

- **Key naming**: dot-separated, camelCase segments: `install.confirmMessage`
- **Interpolation**: `{{variable}}` syntax: `"Install {{product}} on {{count}} workstation(s)?"`
- **Plurals**: Use i18next plural suffixes when needed: `key` / `key_other`
- **No HTML in translations**: Use `<Trans>` component for strings with inline markup
- **Fallback**: Missing Swedish keys fall back to English automatically
- **Context**: Use i18next context for gender/form variations if needed

---

## 8. Files to Modify

68 `.tsx` files contain user-facing strings (all files in `src/renderer/src/pages/` and `src/renderer/src/components/`). Key high-touch files:

| File | Approx. string count |
|------|---------------------|
| `components/connection/ConnectionScreen.tsx` | ~50 |
| `components/deploy/tabs/ISMTab.tsx` | ~45 |
| `components/settings/ConnectionsTab.tsx` | ~40 |
| `components/layout/AppShell.tsx` | ~30 |
| `pages/Logs.tsx` | ~30 |
| `components/settings/UpdateTab.tsx` | ~25 |
| `components/settings/RestartTab.tsx` | ~20 |
| `components/deploy/tabs/InstallTab.tsx` | ~20 |
| `components/deploy/TargetSelector.tsx` | ~10 |
| `components/deploy/OperationProgress.tsx` | ~10 |
| `components/deploy/ConfirmDialog.tsx` | ~5 |
| All other files | ~5-15 each |

**Total estimated keys: ~450-500**

---

## 9. Testing

- Verify all pages render correctly in both `en` and `sv`
- Check that interpolated values (counts, names, versions) display correctly
- Confirm language preference persists across app restart
- Verify fallback: remove a key from `sv/` and confirm English shows
- Check text overflow: Swedish strings are often longer than English — verify no layout breaks
