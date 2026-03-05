import { useState, useCallback, useEffect } from 'react'
import { Loader2, CheckCircle, AlertTriangle, ArrowRight, Pencil, Trash2, Plus, Plug } from 'lucide-react'
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'
import { useTranslation } from 'react-i18next'
import { useConnectionStore, normalizeUrl } from '@/stores/connection'
import { formatTimestamp } from '@/lib/utils'
import type { SavedConnection } from '@shared/types'

type ConnectionEditMode = { type: 'add' } | { type: 'edit'; connection: SavedConnection } | null

function inferNameFromUrl(raw: string): string | null {
  try {
    const url = normalizeUrl(raw)
    const hostname = new URL(url).hostname
    const match = hostname.match(/^broadcaster\.([^.]+)\.heads-api\.com$/i)
    if (match) {
      return match[1]
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    }
    const label = hostname.split('.')[0]
    if (label && label !== 'localhost') {
      return label.charAt(0).toUpperCase() + label.slice(1)
    }
    return null
  } catch {
    return null
  }
}

function autoCompleteUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed
  if (/:\d+/.test(trimmed)) return `http://${trimmed}`
  return `https://${trimmed}`
}

export function ConnectionsTab(): React.ReactNode {
  const { t } = useTranslation('settings')
  const { connections, activeConnection, connect, addConnection, removeConnection, loadConnections } =
    useConnectionStore()
  const [editMode, setEditMode] = useState<ConnectionEditMode>(null)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<SavedConnection | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, 'success' | 'error' | null>>({})

  const startAdd = (): void => {
    setEditMode({ type: 'add' })
    setName('')
    setUrl('')
    setApiKey('')
    setFormError(null)
    setSubmitted(false)
    setNameManuallyEdited(false)
  }

  const startEdit = async (conn: SavedConnection): Promise<void> => {
    setEditMode({ type: 'edit', connection: conn })
    setName(conn.name)
    setUrl(conn.url)
    setNameManuallyEdited(true)
    setFormError(null)
    // Load existing API key
    try {
      const key = await window.api.getCredential(conn.id)
      setApiKey(key ?? '')
    } catch {
      setApiKey('')
    }
  }

  const cancelEdit = (): void => {
    setEditMode(null)
    setFormError(null)
  }

  const handleSave = async (): Promise<void> => {
    if (!name.trim() || !url.trim()) {
      setFormError(t('connections.titleUrlRequired'))
      return
    }

    let normalizedUrl: string
    try {
      normalizedUrl = normalizeUrl(url.trim())
    } catch {
      setFormError(t('connections.invalidUrl'))
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      if (editMode?.type === 'add') {
        if (!apiKey.trim()) {
          setFormError(t('connections.apiKeyRequired'))
          setSaving(false)
          return
        }
        const connection: SavedConnection = {
          id: crypto.randomUUID(),
          name: name.trim(),
          url: normalizedUrl,
          lastConnected: null,
          color: null
        }
        await addConnection(connection, apiKey.trim())
      } else if (editMode?.type === 'edit') {
        const updated: SavedConnection = {
          ...editMode.connection,
          name: name.trim(),
          url: normalizedUrl
        }
        await window.api.saveConnection(updated)
        if (apiKey.trim()) {
          await window.api.setCredential(updated.id, apiKey.trim())
        }
        await loadConnections()
      }
      setEditMode(null)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t('connections.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id: string): Promise<void> => {
    try {
      await removeConnection(id)
    } catch (e) {
      console.error('Failed to remove connection:', e)
    } finally {
      setPendingRemoval(null)
    }
  }

  const handleTest = async (conn: SavedConnection): Promise<void> => {
    setTesting(conn.id)
    setTestResult((prev) => ({ ...prev, [conn.id]: null }))
    try {
      const key = await window.api.getCredential(conn.id)
      if (!key) throw new Error('No API key')
      const res = await fetch(`${conn.url}/AvailableResource`, {
        headers: {
          Authorization: `Basic ${btoa(`any:${key}`)}`,
          Accept: 'application/json;raw=true'
        },
        signal: AbortSignal.timeout(10_000)
      })
      setTestResult((prev) => ({ ...prev, [conn.id]: res.ok ? 'success' : 'error' }))
    } catch {
      setTestResult((prev) => ({ ...prev, [conn.id]: 'error' }))
    } finally {
      setTesting(null)
    }
  }

  const handleRemovalKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!pendingRemoval) return
      if (e.key === 'Escape') {
        e.preventDefault()
        setPendingRemoval(null)
      }
    },
    [pendingRemoval]
  )

  useEffect(() => {
    if (!pendingRemoval) return
    window.addEventListener('keydown', handleRemovalKeyDown)
    return () => window.removeEventListener('keydown', handleRemovalKeyDown)
  }, [pendingRemoval, handleRemovalKeyDown])

  return (
    <div className="p-6">
      <div className="max-w-2xl space-y-4">
        {/* Connection list */}
        {connections.map((conn) => (
          <div
            key={conn.id}
            className={`rounded-lg border bg-surface p-4 ${
              activeConnection?.id === conn.id ? 'border-accent' : 'border-border'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{conn.name}</span>
                  {conn.id === 'local-broadcaster' && <VerifiedBadge />}
                  {activeConnection?.id === conn.id && (
                    <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                      {t('connections.active')}
                    </span>
                  )}
                </div>
                <div className="mt-1 truncate font-mono text-xs text-muted">{conn.url}</div>
                {conn.lastConnected && (
                  <div className="mt-0.5 text-xs text-muted">
                    {t('connections.lastConnected', { date: formatTimestamp(conn.lastConnected) })}
                  </div>
                )}
              </div>
              <div className="ml-4 flex items-center gap-1">
                <button
                  onClick={() => handleTest(conn)}
                  disabled={testing === conn.id}
                  className="rounded p-1.5 text-muted transition-colors hover:text-foreground disabled:opacity-50"
                  title={t('connections.testConnection')}
                >
                  {testing === conn.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plug size={14} />
                  )}
                </button>
                {activeConnection?.id !== conn.id && (
                  <button
                    onClick={() => connect(conn)}
                    className="rounded p-1.5 text-muted transition-colors hover:text-accent"
                    title={t('connections.connectTo')}
                  >
                    <ArrowRight size={14} />
                  </button>
                )}
                <button
                  onClick={() => startEdit(conn)}
                  className="rounded p-1.5 text-muted transition-colors hover:text-foreground"
                  title={t('connections.editConnection')}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setPendingRemoval(conn)}
                  className="rounded p-1.5 text-muted transition-colors hover:text-error"
                  title={t('connections.removeConnection')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {testResult[conn.id] === 'success' && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-success">
                <CheckCircle size={12} /> {t('connections.connectionSuccessful')}
              </div>
            )}
            {testResult[conn.id] === 'error' && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-error">
                <AlertTriangle size={12} /> {t('connections.connectionFailed')}
              </div>
            )}
          </div>
        ))}

        {/* Add button */}
        {!editMode && (
          <button
            onClick={startAdd}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm text-muted transition-colors hover:border-accent hover:text-foreground"
          >
            <Plus size={16} />
            {t('connections.addConnection')}
          </button>
        )}

        {/* Add/Edit form */}
        {editMode && (
          <div className="rounded-lg border border-accent/30 bg-surface p-4">
            <h3 className="mb-4 text-sm font-medium text-foreground">
              {editMode.type === 'add' ? t('connections.newConnection') : t('connections.editTitle', { name: editMode.connection.name })}
            </h3>

            {formError && (
              <div className="mb-3 rounded-md bg-error/10 p-2 text-xs text-error">{formError}</div>
            )}

            <div className="space-y-3">
              <fieldset className={`relative rounded-md border ${submitted && !url.trim() ? 'border-error' : 'border-input'}`}>
                <legend className={`ml-3 px-1 text-xs ${submitted && !url.trim() ? 'text-error' : 'text-muted'}`}>{t('connections.broadcasterUrl')}</legend>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setSubmitted(false) }}
                  onBlur={() => {
                    const completed = autoCompleteUrl(url)
                    if (completed !== url) setUrl(completed)
                    if (!nameManuallyEdited && completed) {
                      const inferred = inferNameFromUrl(completed)
                      if (inferred) setName(inferred)
                    }
                  }}
                  placeholder={submitted && !url.trim() ? t('validation.required', { ns: 'common' }) : undefined}
                  className="w-full rounded-md bg-background px-3 pb-2 pt-0.5 font-mono text-sm text-foreground placeholder:font-sans placeholder:text-error/50 focus:outline-none"
                  autoFocus={editMode?.type === 'add'}
                />
              </fieldset>

              <fieldset className={`relative rounded-md border ${submitted && !name.trim() ? 'border-error' : 'border-input'}`}>
                <legend className={`ml-3 px-1 text-xs ${submitted && !name.trim() ? 'text-error' : 'text-muted'}`}>{t('connections.title')}</legend>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameManuallyEdited(true); setSubmitted(false) }}
                  placeholder={submitted && !name.trim() ? t('validation.required', { ns: 'common' }) : undefined}
                  className="w-full rounded-md bg-background px-3 pb-2 pt-0.5 text-sm text-foreground placeholder:text-error/50 focus:outline-none"
                  autoFocus={editMode?.type === 'edit'}
                />
              </fieldset>

              <fieldset className={`relative rounded-md border ${submitted && editMode?.type === 'add' && !apiKey.trim() ? 'border-error' : 'border-input'}`}>
                <legend className={`ml-3 px-1 text-xs ${submitted && editMode?.type === 'add' && !apiKey.trim() ? 'text-error' : 'text-muted'}`}>
                  {t('connections.apiKey')}{editMode?.type === 'edit' ? ` ${t('connections.apiKeyKeepCurrent')}` : ''}
                </legend>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setSubmitted(false) }}
                  placeholder={submitted && editMode?.type === 'add' && !apiKey.trim() ? t('validation.required', { ns: 'common' }) : (editMode?.type === 'edit' ? '••••••••' : undefined)}
                  className="w-full rounded-md bg-background px-3 pb-2 pt-0.5 text-sm text-foreground placeholder:text-error/50 focus:outline-none"
                />
              </fieldset>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={cancelEdit}
                  className="flex-1 rounded-md border border-border px-4 pt-[7px] pb-[9px] text-sm text-muted transition-colors hover:text-foreground"
                >
                  {t('button.cancel', { ns: 'common' })}
                </button>
                <button
                  onClick={() => { setSubmitted(true); handleSave() }}
                  disabled={saving}
                  className="flex-1 rounded-md bg-accent px-4 pt-[7px] pb-[9px] text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
                >
                  {saving ? t('state.saving', { ns: 'common' }) : t('button.save', { ns: 'common' })}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Removal confirmation dialog */}
      {pendingRemoval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-foreground">{t('connections.removeTitle')}</h2>
            <p className="mt-2 text-sm text-muted">
              {t('connections.removeMessage', { name: pendingRemoval.name })}
            </p>
            {activeConnection?.id === pendingRemoval.id && (
              <p className="mt-2 text-sm text-warning">
                {t('connections.activeWarning')}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setPendingRemoval(null)}
                className="rounded-md border border-border px-4 pt-[7px] pb-[9px] text-sm text-muted transition-colors hover:text-foreground"
              >
                {t('button.cancel', { ns: 'common' })}
              </button>
              <button
                onClick={() => handleRemove(pendingRemoval.id)}
                className="rounded-md bg-error px-4 pt-[7px] pb-[9px] text-sm font-medium text-white transition-colors hover:bg-error/90"
              >
                {t('button.remove', { ns: 'common' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
