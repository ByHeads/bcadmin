import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Save, RotateCcw, AlertTriangle, CheckCircle, Loader2, FolderOpen, Plus, Trash2, Pencil, Eye, EyeOff, X, Copy, Check, Plug } from 'lucide-react'
import { ResourceListInput, MethodSelector } from './ResourceInput'
import { useConnectionStore } from '@/stores/connection'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccessRule {
  Resources?: string[]
  Methods?: string[]
}

interface ApiKeyEntry {
  ApiKey?: string
  AllowAccess?: AccessRule[]
}

interface SftpServer {
  Url?: string
  Port?: number
  UserName?: string
  Password?: string
}

interface AppSettings {
  Urls?: string
  Environment?: string
  ClientName?: string
  RetailConnection?: {
    Url?: string
    BasicAuth?: string
    ConnectToRetail?: boolean
  }
  Deployment?: {
    CentralServerUrl?: string
    ArchiveServerUrl?: string
    DependencySourcePolicy?: string
    SftpSoftwareServer?: SftpServer
  }
  Replication?: {
    ReplicationSourceDirectoryPath?: string
    DeleteReplicationFilesAfterWeeks?: number
  }
  Notifications?: {
    PosWorkstationOfflineLimitDays?: number
    MaxNoReplicationIntervalDays?: number
    MaxNumberOfReplicationFiles?: number
    NotifyOnPosServerNotRunning?: boolean
  }
  Authentication?: {
    AuthTokenSigningKey?: string
    ApiKeys?: ApiKeyEntry[]
  }
  Logging?: unknown
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Config field schema — all known fields per section from bc-config.txt
// ---------------------------------------------------------------------------

type FieldType = 'string' | 'number' | 'boolean' | 'password'

interface FieldDef {
  key: string
  type: FieldType
  default?: unknown
}

/** All known config fields per section. Fields already shown in the dedicated UI are marked with `shown: true` below and excluded from the "add" dropdown. */
const CONFIG_SCHEMA: Record<string, { fields: FieldDef[]; shownKeys: string[] }> = {
  General: {
    fields: [
      { key: 'LogDirectoryPath', type: 'string' },
      { key: 'WorkItemMaintenanceIntervalSeconds', type: 'number', default: 45 },
      { key: 'IterationIntervalSeconds', type: 'number', default: 15 },
      { key: 'WorkItemExecutionTimeoutSeconds', type: 'number', default: 3 },
      { key: 'FeedPersistIntervalSeconds', type: 'number', default: 45 },
      { key: 'FeedRequestTimeoutSeconds', type: 'number', default: 10 },
      { key: 'ConnectionAttemptRecentIntervalMinutes', type: 'number', default: 30 },
      { key: 'ConnectionAttemptCleanAfterIntervalMinutes', type: 'number', default: 720 },
    ],
    shownKeys: [],
  },
  RetailConnection: {
    fields: [
      { key: 'Url', type: 'string' },
      { key: 'BasicAuth', type: 'password' },
      { key: 'ConnectToRetail', type: 'boolean', default: true },
      { key: 'VersionHashEndpoint', type: 'string', default: 'api/v1/replication/hash' },
      { key: 'WorkstationObsoleteEndpoint', type: 'string', default: 'api/v1/replication/outofsync' },
      { key: 'IgnoreCertificateErrors', type: 'boolean', default: false },
      { key: 'NotifyIfNotConnectedIntervalMinutes', type: 'number', default: 180 },
    ],
    shownKeys: ['Url', 'BasicAuth', 'ConnectToRetail'],
  },
  Deployment: {
    fields: [
      { key: 'CentralServerUrl', type: 'string' },
      { key: 'ArchiveServerUrl', type: 'string' },
      { key: 'DependencySourcePolicy', type: 'string' },
      { key: 'MaxNumberOfConcurrentDownloads', type: 'number', default: 25 },
      { key: 'BroadcasterBuildTag', type: 'string', default: 'main' },
      { key: 'ReceiverBuildTag', type: 'string', default: 'main' },
      { key: 'PosServerRestartHourOfDay', type: 'number', default: 5 },
      { key: 'PosServerRestartMinuteOfHour', type: 'number', default: 0 },
      { key: 'KeepOldVersionsIntervalDays', type: 'number', default: 30 },
      { key: 'KeepDownloadsIntervalMinutes', type: 'number', default: 30 },
      { key: 'SoftwareMonitorIntervalSeconds', type: 'number', default: 10 },
      { key: 'DeploymentDirectoryPath', type: 'string' },
      { key: 'RemoteFileMonitorIntervalSeconds', type: 'number', default: 720 },
      { key: 'LaunchSchedulePath', type: 'string' },
      { key: 'RemoteBuildTagsPath', type: 'string' },
    ],
    shownKeys: ['CentralServerUrl', 'ArchiveServerUrl', 'DependencySourcePolicy'],
  },
  Replication: {
    fields: [
      { key: 'ReplicationSourceDirectoryPath', type: 'string' },
      { key: 'DeleteReplicationFilesAfterWeeks', type: 'number', default: 3 },
      { key: 'ReplicationDestinationDirectoryPath', type: 'string' },
      { key: 'VersionHashPath', type: 'string' },
      { key: 'WorkItemObsolescenceIntervalDays', type: 'number', default: 21 },
      { key: 'WorkstationGroupsPath', type: 'string' },
      { key: 'ReplicationFilterPath', type: 'string' },
    ],
    shownKeys: ['ReplicationSourceDirectoryPath', 'DeleteReplicationFilesAfterWeeks'],
  },
  Notifications: {
    fields: [
      { key: 'PosWorkstationOfflineLimitDays', type: 'number', default: 4 },
      { key: 'MaxNoReplicationIntervalDays', type: 'number', default: 2 },
      { key: 'MaxNumberOfReplicationFiles', type: 'number', default: 100000 },
      { key: 'NotifyOnPosServerNotRunning', type: 'boolean', default: true },
      { key: 'MaxNoNewReplicationFilesIntervalDays', type: 'number', default: 1 },
      { key: 'MaxNumberOfRecentForeignReplacements', type: 'number', default: 25 },
      { key: 'NotificationsFilePath', type: 'string' },
    ],
    shownKeys: ['PosWorkstationOfflineLimitDays', 'MaxNoReplicationIntervalDays', 'MaxNumberOfReplicationFiles', 'NotifyOnPosServerNotRunning'],
  },
  Authentication: {
    fields: [
      { key: 'AuthTokenSigningKey', type: 'password' },
    ],
    shownKeys: ['AuthTokenSigningKey', 'ApiKeys'],
  },
}

/** Dropdown to add a missing config field from the section's schema */
function AddFieldDropdown({ section, currentKeys, onAdd }: {
  section: string
  currentKeys: string[]
  onAdd: (key: string, type: FieldType, defaultValue?: unknown) => void
}): React.ReactNode {
  const { t } = useTranslation('settings')
  const schema = CONFIG_SCHEMA[section]
  if (!schema) return null

  const available = schema.fields.filter(
    (f) => !schema.shownKeys.includes(f.key) && !currentKeys.includes(f.key)
  )
  if (available.length === 0) return null

  return (
    <div className="flex items-center gap-2 pt-1">
      <select
        className="rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-muted focus:border-accent focus:outline-none"
        defaultValue=""
        onChange={(e) => {
          const field = available.find((f) => f.key === e.target.value)
          if (field) {
            onAdd(field.key, field.type, field.default)
            e.target.value = ''
          }
        }}
      >
        <option value="" disabled>{t('appSettings.addField')}</option>
        {available.map((f) => (
          <option key={f.key} value={f.key}>{f.key}</option>
        ))}
      </select>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Get a nested value by dot path */
function getPath(obj: unknown, path: string): unknown {
  let current: unknown = obj
  for (const key of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

/** Set a nested value by dot path, returning a new object */
function setPath(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const result = deepClone(obj)
  const keys = path.split('.')
  let current: Record<string, unknown> = result
  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]] == null || typeof current[keys[i]] !== 'object') {
      current[keys[i]] = {}
    }
    current = current[keys[i]] as Record<string, unknown>
  }
  current[keys[keys.length - 1]] = value
  return result
}

// ---------------------------------------------------------------------------
// Section component
// ---------------------------------------------------------------------------

function Section({ title, defaultOpen, children }: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}): React.ReactNode {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-hover/50 transition-colors"
      >
        {title}
        <ChevronDown size={16} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-border px-4 py-4 space-y-3">
          {children}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Field components
// ---------------------------------------------------------------------------

function TextField({ label, value, onChange, type = 'text', note }: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'password'
  note?: string
}): React.ReactNode {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-xs font-medium text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none"
      />
      {note && <span className="mt-0.5 block text-xs text-warning">{note}</span>}
    </label>
  )
}

function NumberField({ label, value, onChange, note }: {
  label: string
  value: number
  onChange: (v: number) => void
  note?: string
}): React.ReactNode {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-xs font-medium text-muted">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full max-w-[200px] rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground focus:border-accent focus:outline-none"
      />
      {note && <span className="mt-0.5 block text-xs text-warning">{note}</span>}
    </label>
  )
}

function BoolField({ label, value, onChange }: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}): React.ReactNode {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border accent-accent"
      />
      <span className="font-mono text-sm text-foreground">{label}</span>
    </label>
  )
}

// ---------------------------------------------------------------------------
// API Keys CRUD editor
// ---------------------------------------------------------------------------

function ApiKeysEditor({ keys, onChange }: {
  keys: ApiKeyEntry[]
  onChange: (keys: ApiKeyEntry[]) => void
}): React.ReactNode {
  const { t } = useTranslation('settings')
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [editKey, setEditKey] = useState<ApiKeyEntry | null>(null)
  const [showKey, setShowKey] = useState<Record<number, boolean>>({})
  const [copied, setCopied] = useState<number | null>(null)

  const startEdit = (idx: number): void => {
    setEditIdx(idx)
    setEditKey(deepClone(keys[idx]))
  }

  const startAdd = (): void => {
    setEditIdx(-1)
    setEditKey({ ApiKey: '', AllowAccess: [{ Resources: [''], Methods: ['*'] }] })
  }

  const cancelEdit = (): void => {
    setEditIdx(null)
    setEditKey(null)
  }

  const saveEdit = (): void => {
    if (!editKey?.ApiKey?.trim()) return
    const updated = [...keys]
    if (editIdx === -1) {
      updated.push(editKey)
    } else if (editIdx !== null) {
      updated[editIdx] = editKey
    }
    onChange(updated)
    setEditIdx(null)
    setEditKey(null)
  }

  const removeKey = (idx: number): void => {
    onChange(keys.filter((_, i) => i !== idx))
  }

  const copyKey = (idx: number): void => {
    const key = keys[idx]?.ApiKey
    if (key) {
      navigator.clipboard.writeText(key)
      setCopied(idx)
      setTimeout(() => setCopied(null), 2000)
    }
  }

  const updateAccessRule = (ruleIdx: number, field: 'Resources' | 'Methods', value: string[]): void => {
    if (!editKey) return
    const access = [...(editKey.AllowAccess ?? [])]
    access[ruleIdx] = { ...access[ruleIdx], [field]: value }
    setEditKey({ ...editKey, AllowAccess: access })
  }

  const addAccessRule = (): void => {
    if (!editKey) return
    setEditKey({ ...editKey, AllowAccess: [...(editKey.AllowAccess ?? []), { Resources: [''], Methods: ['*'] }] })
  }

  const removeAccessRule = (ruleIdx: number): void => {
    if (!editKey) return
    setEditKey({ ...editKey, AllowAccess: editKey.AllowAccess?.filter((_, i) => i !== ruleIdx) })
  }

  const maskKey = (key: string): string => {
    if (key.length <= 4) return '••••'
    return key.slice(0, 2) + '•'.repeat(Math.min(key.length - 4, 12)) + key.slice(-2)
  }

  return (
    <div className="space-y-2">
      <span className="mb-1 block font-mono text-xs font-medium text-muted">ApiKeys</span>

      {keys.map((entry, idx) => (
        <div key={idx} className="rounded-md border border-border p-3">
          {editIdx === idx ? (
            /* Edit form */
            <EditForm
              editKey={editKey!}
              setEditKey={setEditKey}
              updateAccessRule={updateAccessRule}
              addAccessRule={addAccessRule}
              removeAccessRule={removeAccessRule}
              saveEdit={saveEdit}
              cancelEdit={cancelEdit}
              t={t}
            />
          ) : (
            /* Display mode */
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-foreground">
                    {showKey[idx] ? entry.ApiKey : maskKey(entry.ApiKey ?? '')}
                  </span>
                  <button onClick={() => setShowKey((s) => ({ ...s, [idx]: !s[idx] }))} className="rounded p-0.5 text-muted hover:text-foreground">
                    {showKey[idx] ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button onClick={() => copyKey(idx)} className="rounded p-0.5 text-muted hover:text-foreground">
                    {copied === idx ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => startEdit(idx)} className="rounded p-1 text-muted hover:text-foreground">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => removeKey(idx)} className="rounded p-1 text-muted hover:text-error">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {entry.AllowAccess?.map((rule, ri) => (
                <div key={ri} className="mt-1.5 text-xs text-muted">
                  <span className="font-medium">
                    {rule.Methods?.length === 1 && rule.Methods[0] === '*' ? t('appSettings.allMethods') : rule.Methods?.join(', ') || t('appSettings.noMethods')}
                  </span>
                  {' → '}
                  <span className="font-mono">
                    {rule.Resources?.join(', ') || t('appSettings.noResources')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {editIdx === -1 ? (
        <div className="rounded-md border border-accent/30 p-3">
          <EditForm
            editKey={editKey!}
            setEditKey={setEditKey}
            updateAccessRule={updateAccessRule}
            addAccessRule={addAccessRule}
            removeAccessRule={removeAccessRule}
            saveEdit={saveEdit}
            cancelEdit={cancelEdit}
            t={t}
            isNew
          />
        </div>
      ) : (
        <button
          onClick={startAdd}
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border p-2 text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
        >
          <Plus size={14} />
          {t('appSettings.addApiKey')}
        </button>
      )}
    </div>
  )
}

function EditForm({ editKey, setEditKey, updateAccessRule, addAccessRule, removeAccessRule, saveEdit, cancelEdit, t, isNew }: {
  editKey: ApiKeyEntry
  setEditKey: (k: ApiKeyEntry) => void
  updateAccessRule: (ruleIdx: number, field: 'Resources' | 'Methods', value: string[]) => void
  addAccessRule: () => void
  removeAccessRule: (ruleIdx: number) => void
  saveEdit: () => void
  cancelEdit: () => void
  t: (key: string) => string
  isNew?: boolean
}): React.ReactNode {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block font-mono text-xs font-medium text-muted">ApiKey</span>
        <input
          type="text"
          value={editKey.ApiKey ?? ''}
          onChange={(e) => setEditKey({ ...editKey, ApiKey: e.target.value })}
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground focus:border-accent focus:outline-none"
          placeholder={isNew ? t('appSettings.newApiKeyPlaceholder') : undefined}
          autoFocus={isNew}
        />
      </label>

      <div className="space-y-2">
        <span className="block text-xs font-medium text-muted">{t('appSettings.accessRules')}</span>
        {editKey.AllowAccess?.map((rule, ri) => (
          <div key={ri} className="rounded border border-border/50 p-2.5 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-3">
                <div>
                  <span className="mb-1 block font-mono text-[11px] text-muted">Resources</span>
                  <ResourceListInput
                    values={rule.Resources ?? []}
                    onChange={(vals) => updateAccessRule(ri, 'Resources', vals)}
                  />
                </div>
                <div>
                  <span className="mb-1 block font-mono text-[11px] text-muted">Methods</span>
                  <MethodSelector
                    values={rule.Methods ?? []}
                    onChange={(vals) => updateAccessRule(ri, 'Methods', vals)}
                  />
                </div>
              </div>
              {(editKey.AllowAccess?.length ?? 0) > 1 && (
                <button onClick={() => removeAccessRule(ri)} className="ml-2 mt-1 rounded p-1 text-muted hover:text-error" type="button">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
        <button
          onClick={addAccessRule}
          type="button"
          className="text-xs text-accent hover:text-accent/80"
        >
          + {t('appSettings.addAccessRule')}
        </button>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={cancelEdit} type="button" className="rounded-md border border-border px-3 py-1 text-xs text-muted hover:text-foreground">
          {t('button.cancel', { ns: 'common' })}
        </button>
        <button
          onClick={saveEdit}
          type="button"
          disabled={!editKey.ApiKey?.trim()}
          className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {isNew ? t('appSettings.addApiKey') : t('button.save', { ns: 'common' })}
        </button>
      </div>
    </div>
  )
}

/** Render dynamically-added fields for a section + "Add field" dropdown */
function ExtraFields({ section, settings, update }: {
  section: string
  settings: Record<string, unknown>
  update: (path: string, value: unknown) => void
}): React.ReactNode {
  const sectionData = (settings[section] ?? {}) as Record<string, unknown>
  const schema = CONFIG_SCHEMA[section]
  if (!schema) return null

  // Find fields present in the data but not in the default shown set
  const extraKeys = Object.keys(sectionData).filter(
    (k) => schema.shownKeys.includes(k) ? false : schema.fields.some((f) => f.key === k)
  )

  const handleAdd = (key: string, type: FieldType, defaultValue?: unknown): void => {
    const val = defaultValue ?? (type === 'boolean' ? false : type === 'number' ? 0 : '')
    update(`${section}.${key}`, val)
  }

  const handleRemove = (key: string): void => {
    // Remove the key from the section data by setting the section without it
    const { [key]: _, ...rest } = sectionData
    update(section, Object.keys(rest).length > 0 ? rest : undefined)
  }

  return (
    <>
      {extraKeys.map((k) => {
        const field = schema.fields.find((f) => f.key === k)
        if (!field) return null
        const val = sectionData[k]
        return (
          <div key={k} className="group/extra">
            <span className="mb-1 block font-mono text-xs font-medium text-muted">{k}</span>
            <div className="flex items-center gap-1.5">
              {field.type === 'boolean'
                ? <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={val as boolean} onChange={(e) => update(`${section}.${k}`, e.target.checked)} className="h-4 w-4 rounded border-border accent-accent" />
                    <span className="font-mono text-sm text-foreground">{val ? 'true' : 'false'}</span>
                  </label>
                : field.type === 'number'
                  ? <input type="number" value={val as number} onChange={(e) => update(`${section}.${k}`, Number(e.target.value))} className="w-full max-w-[200px] rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground focus:border-accent focus:outline-none" />
                  : <input type={field.type === 'password' ? 'password' : 'text'} value={String(val ?? '')} onChange={(e) => update(`${section}.${k}`, e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none" />
              }
              <button
                type="button"
                onClick={() => handleRemove(k)}
                className="shrink-0 rounded p-1 text-muted opacity-0 transition-opacity hover:text-error group-hover/extra:opacity-100"
                title="Remove field"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        )
      })}
      <AddFieldDropdown
        section={section}
        currentKeys={Object.keys(sectionData)}
        onAdd={handleAdd}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Phase = 'idle' | 'saving' | 'saved' | 'restart-prompt' | 'restarting' | 'reconnecting' | 'restart-done' | 'error'

export function AppSettingsTab(): React.ReactNode {
  const { t } = useTranslation('settings')
  const { client, activeConnection, setSuppressConnectionDrop } = useConnectionStore()

  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [original, setOriginal] = useState<AppSettings | null>(null)
  const [fileError, setFileError] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [apiKeysJson, setApiKeysJson] = useState('')
  const [apiKeysError, setApiKeysError] = useState('')
  const [retailCheck, setRetailCheck] = useState<'idle' | 'checking' | 'success' | 'error'>('idle')
  const [retailCheckMsg, setRetailCheckMsg] = useState('')
  const appDirRef = useRef('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch AppDirectory from Broadcaster config
  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ['settings-config-appdir', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<Record<string, unknown>>(
        'Broadcaster.Admin.Config',
        undefined,
        { select: 'AppDirectory' },
        signal
      )
    },
    enabled: !!client,
    staleTime: 60_000
  })

  const appDir = configData?.[0]?.AppDirectory as { Path?: string } | undefined

  // Load appsettings.json (or appsettings.Development.json) from disk
  useEffect(() => {
    if (!appDir?.Path) return
    const sep = appDir.Path.includes('\\') ? '\\' : '/'
    const base = appDir.Path.replace(/[\\/]$/, '')
    const candidates = [
      base + sep + 'appsettings.json',
      base + sep + 'appsettings.Development.json'
    ]

    async function tryLoad(): Promise<void> {
      for (const filePath of candidates) {
        try {
          const data = await window.api.readJsonFile(filePath)
          const s = data as AppSettings
          appDirRef.current = filePath
          setOriginal(deepClone(s))
          setSettings(deepClone(s))
          setApiKeysJson(JSON.stringify(s.Authentication?.ApiKeys ?? [], null, 2))
          setFileError('')
          return
        } catch { /* try next */ }
      }
      setFileError(`No appsettings file found in ${base}`)
    }
    tryLoad()
  }, [appDir?.Path])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      setSuppressConnectionDrop(false)
    }
  }, [setSuppressConnectionDrop])

  const isDirty = settings && original && !deepEqual(settings, original)
  const replicationPathChanged = settings && original &&
    settings.Replication?.ReplicationSourceDirectoryPath !== original.Replication?.ReplicationSourceDirectoryPath

  const update = useCallback((path: string, value: unknown) => {
    setSettings((prev) => prev ? setPath(prev as Record<string, unknown>, path, value) as AppSettings : prev)
  }, [])

  const handleApiKeysChange = useCallback((json: string) => {
    setApiKeysJson(json)
    try {
      const parsed = JSON.parse(json)
      if (!Array.isArray(parsed)) {
        setApiKeysError(t('appSettings.apiKeysNotArray'))
        return
      }
      setApiKeysError('')
      setSettings((prev) => {
        if (!prev) return prev
        return { ...deepClone(prev), Authentication: { ...prev.Authentication, ApiKeys: parsed } }
      })
    } catch {
      setApiKeysError(t('appSettings.invalidJson'))
    }
  }, [t])

  const handleSave = useCallback(async () => {
    if (!settings || !appDirRef.current || apiKeysError) return
    setPhase('saving')
    setErrorMsg('')
    try {
      // Preserve non-editable fields from original
      const toWrite = { ...deepClone(settings) }
      if (original?.Environment !== undefined) toWrite.Environment = original.Environment
      if (original?.Logging !== undefined) toWrite.Logging = original.Logging
      await window.api.writeJsonFile(appDirRef.current, toWrite)
      setOriginal(deepClone(settings))
      if (replicationPathChanged) {
        setPhase('restart-prompt')
      } else {
        setPhase('saved')
        setTimeout(() => setPhase('idle'), 3000)
      }
    } catch (err) {
      setPhase('error')
      setErrorMsg(err instanceof Error ? err.message : String(err))
    }
  }, [settings, original, replicationPathChanged, apiKeysError])

  const handleRestart = useCallback(async () => {
    if (!client) return
    setPhase('restarting')
    setSuppressConnectionDrop(true)
    try {
      await client.patch('Broadcaster.Admin.BroadcasterRestart', {})
    } catch {
      // May fail because Broadcaster restarts mid-response
    }
    setPhase('reconnecting')
    let attempts = 0
    pollRef.current = setInterval(async () => {
      attempts++
      if (attempts > 90) {
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = null
        setSuppressConnectionDrop(false)
        setPhase('error')
        setErrorMsg(t('restart.timeout'))
        return
      }
      try {
        await client.get('Broadcaster.Admin.Config', undefined, { select: 'Version' })
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = null
        setSuppressConnectionDrop(false)
        setPhase('restart-done')
        setTimeout(() => setPhase('idle'), 3000)
      } catch {
        // Expected while restarting
      }
    }, 2000)
  }, [client, setSuppressConnectionDrop, t])

  const handleDiscard = useCallback(() => {
    if (original) {
      setSettings(deepClone(original))
      setApiKeysJson(JSON.stringify(original.Authentication?.ApiKeys ?? [], null, 2))
      setApiKeysError('')
    }
  }, [original])

  const handleCheckRetail = useCallback(async () => {
    if (!client) return
    setRetailCheck('checking')
    setRetailCheckMsg('')
    try {
      const result = await client.get<Record<string, unknown>>('Broadcaster.Replication.CheckRetailConnection')
      const data = result?.[0] ?? result
      const status = (data as Record<string, unknown>)?.Status as string ?? 'Unknown'
      const isOk = status === 'Connected'
      setRetailCheck(isOk ? 'success' : 'error')
      setRetailCheckMsg(status)
      setTimeout(() => setRetailCheck('idle'), 8000)
    } catch (err) {
      setRetailCheck('error')
      setRetailCheckMsg(err instanceof Error ? err.message : String(err))
      setTimeout(() => setRetailCheck('idle'), 8000)
    }
  }, [client])

  // --- Loading / error states ---

  if (configLoading) {
    return <div className="flex h-64 items-center justify-center text-muted">{t('state.loading', { ns: 'common' })}</div>
  }

  if (!appDir?.Path) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-error/10 p-4 text-sm text-error">{t('appSettings.noAppDir')}</div>
      </div>
    )
  }

  if (fileError) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-error/10 p-4 text-sm text-error">
          <div className="font-medium">{t('appSettings.readError')}</div>
          <div className="mt-1 font-mono text-xs">{fileError}</div>
          <div className="mt-2 text-xs text-muted">{t('appSettings.localOnly')}</div>
        </div>
      </div>
    )
  }

  if (!settings) {
    return <div className="flex h-64 items-center justify-center text-muted">{t('state.loading', { ns: 'common' })}</div>
  }

  // --- Form ---

  return (
    <div className="p-6">
      <div className="max-w-2xl space-y-3">
        {/* General */}
        <Section title={t('appSettings.section.general')} defaultOpen>
          <TextField label="Urls" value={settings.Urls ?? ''} onChange={(v) => update('Urls', v)} />
          <TextField label="ClientName" value={settings.ClientName ?? ''} onChange={(v) => update('ClientName', v)} />
          <ExtraFields section="General" settings={settings as Record<string, unknown>} update={update} />
        </Section>

        {/* Retail Connection */}
        <Section title={t('appSettings.section.retail')}>
          <TextField label="Url" value={settings.RetailConnection?.Url ?? ''} onChange={(v) => update('RetailConnection.Url', v)} />
          <TextField label="BasicAuth" value={settings.RetailConnection?.BasicAuth ?? ''} onChange={(v) => update('RetailConnection.BasicAuth', v)} type="password" />
          <BoolField label="ConnectToRetail" value={settings.RetailConnection?.ConnectToRetail ?? false} onChange={(v) => update('RetailConnection.ConnectToRetail', v)} />
          <ExtraFields section="RetailConnection" settings={settings as Record<string, unknown>} update={update} />
          <div className="pt-2">
            <button
              type="button"
              onClick={handleCheckRetail}
              disabled={retailCheck === 'checking'}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:text-foreground disabled:opacity-50"
            >
              {retailCheck === 'checking' ? <Loader2 size={13} className="animate-spin" /> : <Plug size={13} />}
              {t('appSettings.checkRetailConnection')}
            </button>
            {retailCheck !== 'idle' && retailCheck !== 'checking' && (() => {
              const statusKey = `appSettings.retailStatus.${retailCheckMsg}` as const
              const translated = t(statusKey, { defaultValue: retailCheckMsg })
              const isConnected = retailCheckMsg === 'Connected'
              const isNotConfigured = retailCheckMsg === 'NotConfigured'
              const colorClass = isConnected ? 'text-success' : isNotConfigured ? 'text-muted' : 'text-error'
              const Icon = isConnected ? CheckCircle : AlertTriangle
              return (
                <div className={`mt-2 flex items-center gap-1.5 text-xs ${colorClass}`}>
                  <Icon size={13} className="shrink-0" />
                  <span>{translated}</span>
                </div>
              )
            })()}
          </div>
        </Section>

        {/* Deployment */}
        <Section title={t('appSettings.section.deployment')}>
          <TextField label="CentralServerUrl" value={settings.Deployment?.CentralServerUrl ?? ''} onChange={(v) => update('Deployment.CentralServerUrl', v)} />
          <TextField label="ArchiveServerUrl" value={settings.Deployment?.ArchiveServerUrl ?? ''} onChange={(v) => update('Deployment.ArchiveServerUrl', v)} />
          <TextField label="DependencySourcePolicy" value={settings.Deployment?.DependencySourcePolicy ?? ''} onChange={(v) => update('Deployment.DependencySourcePolicy', v)} />
          <div className="mt-2 text-xs font-medium text-muted">{t('appSettings.section.sftp')}</div>
          <TextField label="Url" value={settings.Deployment?.SftpSoftwareServer?.Url ?? ''} onChange={(v) => update('Deployment.SftpSoftwareServer.Url', v)} />
          <NumberField label="Port" value={settings.Deployment?.SftpSoftwareServer?.Port ?? 22} onChange={(v) => update('Deployment.SftpSoftwareServer.Port', v)} />
          <TextField label="UserName" value={settings.Deployment?.SftpSoftwareServer?.UserName ?? ''} onChange={(v) => update('Deployment.SftpSoftwareServer.UserName', v)} />
          <TextField label="Password" value={settings.Deployment?.SftpSoftwareServer?.Password ?? ''} onChange={(v) => update('Deployment.SftpSoftwareServer.Password', v)} type="password" />
          <ExtraFields section="Deployment" settings={settings as Record<string, unknown>} update={update} />
        </Section>

        {/* Replication */}
        <Section title={t('appSettings.section.replication')}>
          <label className="block">
            <span className="mb-1 block font-mono text-xs font-medium text-muted">ReplicationSourceDirectoryPath</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.Replication?.ReplicationSourceDirectoryPath ?? ''}
                onChange={(e) => update('Replication.ReplicationSourceDirectoryPath', e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={async () => {
                  const dir = await window.api.chooseDirectory(settings.Replication?.ReplicationSourceDirectoryPath || undefined)
                  if (dir) update('Replication.ReplicationSourceDirectoryPath', dir)
                }}
                className="shrink-0 rounded-md border border-border px-3 py-1.5 text-muted transition-colors hover:text-foreground"
                title={t('appSettings.browseDirectory')}
              >
                <FolderOpen size={16} />
              </button>
            </div>
            <span className="mt-0.5 block text-xs text-warning">{t('appSettings.requiresRestart')}</span>
          </label>
          <NumberField label="DeleteReplicationFilesAfterWeeks" value={settings.Replication?.DeleteReplicationFilesAfterWeeks ?? 3} onChange={(v) => update('Replication.DeleteReplicationFilesAfterWeeks', v)} />
          <ExtraFields section="Replication" settings={settings as Record<string, unknown>} update={update} />
        </Section>

        {/* Notifications */}
        <Section title={t('appSettings.section.notifications')}>
          <NumberField label="PosWorkstationOfflineLimitDays" value={settings.Notifications?.PosWorkstationOfflineLimitDays ?? 4} onChange={(v) => update('Notifications.PosWorkstationOfflineLimitDays', v)} />
          <NumberField label="MaxNoReplicationIntervalDays" value={settings.Notifications?.MaxNoReplicationIntervalDays ?? 6} onChange={(v) => update('Notifications.MaxNoReplicationIntervalDays', v)} />
          <NumberField label="MaxNumberOfReplicationFiles" value={settings.Notifications?.MaxNumberOfReplicationFiles ?? 100000} onChange={(v) => update('Notifications.MaxNumberOfReplicationFiles', v)} />
          <BoolField label="NotifyOnPosServerNotRunning" value={settings.Notifications?.NotifyOnPosServerNotRunning ?? true} onChange={(v) => update('Notifications.NotifyOnPosServerNotRunning', v)} />
          <ExtraFields section="Notifications" settings={settings as Record<string, unknown>} update={update} />
        </Section>

        {/* Authentication */}
        <Section title={t('appSettings.section.authentication')}>
          <div>
            <ApiKeysEditor
              keys={(settings.Authentication?.ApiKeys ?? []) as ApiKeyEntry[]}
              onChange={(keys) => {
                setSettings((prev) => {
                  if (!prev) return prev
                  return { ...deepClone(prev), Authentication: { ...prev.Authentication, ApiKeys: keys } }
                })
              }}
            />
          </div>
          <ExtraFields section="Authentication" settings={settings as Record<string, unknown>} update={update} />
        </Section>

        {/* Action bar */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={!isDirty || phase === 'saving' || !!apiKeysError}
            className="flex items-center gap-2 rounded-md bg-accent px-4 pt-[7px] pb-[9px] text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={14} />
            {t('appSettings.save')}
          </button>
          <button
            onClick={handleDiscard}
            disabled={!isDirty}
            className="flex items-center gap-2 rounded-md border border-border px-4 pt-[7px] pb-[9px] text-sm text-muted hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw size={14} />
            {t('appSettings.discard')}
          </button>

          {phase === 'saving' && (
            <span className="flex items-center gap-2 text-sm text-muted">
              <Loader2 size={14} className="animate-spin" /> {t('appSettings.saving')}
            </span>
          )}
          {phase === 'saved' && (
            <span className="flex items-center gap-2 text-sm text-success">
              <CheckCircle size={14} /> {t('appSettings.saved')}
            </span>
          )}
        </div>

        {/* Restart prompt */}
        {phase === 'restart-prompt' && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
              <div>
                <div className="font-medium text-foreground">{t('appSettings.restartTitle')}</div>
                <div className="mt-1 text-sm text-muted">{t('appSettings.restartMessage')}</div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleRestart}
                    className="rounded-md bg-error px-4 pt-[5px] pb-[7px] text-sm font-medium text-white hover:bg-error/90 transition-colors"
                  >
                    {t('restart.confirmButton')}
                  </button>
                  <button
                    onClick={() => setPhase('idle')}
                    className="rounded-md border border-border px-4 pt-[5px] pb-[7px] text-sm text-muted hover:text-foreground transition-colors"
                  >
                    {t('appSettings.restartLater')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Restarting states */}
        {phase === 'restarting' && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
            <Loader2 size={20} className="animate-spin text-accent" />
            <span className="text-sm text-foreground">{t('restart.restarting')}</span>
          </div>
        )}
        {phase === 'reconnecting' && (
          <div className="flex items-center gap-3 rounded-lg border border-accent/30 bg-accent/10 p-4">
            <Loader2 size={20} className="animate-spin text-accent" />
            <div>
              <div className="text-sm font-medium text-foreground">{t('restart.broadcasterRestarting')}</div>
              <div className="text-xs text-muted">{t('restart.waitingReconnection')}</div>
            </div>
          </div>
        )}
        {phase === 'restart-done' && (
          <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 p-4">
            <CheckCircle size={20} className="text-success" />
            <div>
              <div className="text-sm font-medium text-foreground">{t('restart.complete')}</div>
              <div className="text-xs text-muted">{t('restart.backOnline')}</div>
            </div>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="rounded-lg border border-error/30 bg-error/10 p-4">
            <div className="text-sm text-error">{errorMsg}</div>
            <button
              onClick={() => setPhase('idle')}
              className="mt-2 text-xs text-muted hover:text-foreground transition-colors"
            >
              {t('button.dismiss', { ns: 'common' })}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
