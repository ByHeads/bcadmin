import { useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { FileText, Copy, Check, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useConnectionStore } from '@/stores/connection'
import { useWorkstationIds } from '@/hooks/useWorkstationIds'

const HEADS_PATH_PREFIX = 'C:\\ProgramData\\Heads'

export function DownloadFileTab(): React.ReactNode {
  const { t } = useTranslation('deploy')
  const { client } = useConnectionStore()

  const [workstationId, setWorkstationId] = useState('')
  const [filePath, setFilePath] = useState(HEADS_PATH_PREFIX + '\\')
  const [copied, setCopied] = useState(false)
  const [savedPath, setSavedPath] = useState<string | null>(null)

  // Fetch workstation list for autocomplete/validation
  const { data: workstations = [] } = useWorkstationIds()

  const pathError = filePath.trim().length > 0 && !filePath.startsWith(HEADS_PATH_PREFIX)
    ? t('downloadFile.pathMustStartWith', { prefix: HEADS_PATH_PREFIX })
    : null

  const canFetch = workstationId.trim().length > 0 && filePath.trim().length > 0 && !pathError

  const fetchMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('No client')
      const results = await client.get<{ Content?: string; TextContent?: string; [key: string]: unknown }>(
        'Broadcaster.Admin.ReceiverHeadsTextFile',
        { WorkstationId: workstationId.trim(), FilePath: filePath.trim() },
        undefined
      )
      if (!results || results.length === 0) throw new Error(t('downloadFile.notFound'))
      const item = results[0]
      // Try common content field names
      const text = item.Content ?? item.TextContent ?? (typeof item === 'string' ? item : JSON.stringify(item, null, 2))
      return typeof text === 'string' ? text : JSON.stringify(text, null, 2)
    },
    onSuccess: () => {
      setCopied(false)
      setSavedPath(null)
    }
  })

  const handleCopy = useCallback(async () => {
    if (!fetchMutation.data) return
    await navigator.clipboard.writeText(fetchMutation.data)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [fetchMutation.data])

  const handleSave = useCallback(async () => {
    if (!fetchMutation.data) return
    const filename = filePath.split('\\').pop() || 'downloaded-file.txt'
    const result = await window.api.saveToDownloads(filename, fetchMutation.data)
    if (result) setSavedPath(result)
  }, [fetchMutation.data, filePath])

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* Workstation ID */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">{t('downloadFile.workstationId')}</label>
        <input
          type="text"
          list="workstation-ids"
          value={workstationId}
          onChange={(e) => setWorkstationId(e.target.value)}
          disabled={fetchMutation.isPending}
          placeholder={t('downloadFile.workstationPlaceholder')}
          className="w-full rounded-md border border-border bg-surface py-1.5 px-3 text-sm text-foreground placeholder:text-muted/50 transition-colors focus:border-accent focus:outline-none"
        />
        <datalist id="workstation-ids">
          {workstations.map((ws) => (
            <option key={ws} value={ws} />
          ))}
        </datalist>
      </div>

      {/* File Path */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">{t('downloadFile.filePath')}</label>
        <input
          type="text"
          value={filePath}
          onChange={(e) => {
            const val = e.target.value
            // Don't let the user erase the required prefix
            if ((HEADS_PATH_PREFIX + '\\').startsWith(val) && val.length < HEADS_PATH_PREFIX.length + 1) return
            setFilePath(val)
          }}
          disabled={fetchMutation.isPending}
          placeholder={HEADS_PATH_PREFIX + '\\...'}
          className={`w-full rounded-md border bg-surface py-1.5 px-3 text-sm font-mono text-foreground placeholder:text-muted/50 transition-colors focus:outline-none ${
            pathError ? 'border-error focus:border-error' : 'border-border focus:border-accent'
          }`}
        />
        {pathError && (
          <div className="mt-1 text-xs text-error">{pathError}</div>
        )}
        <div className="mt-1 text-xs text-muted">
          {t('downloadFile.pathMustBeUnder', { prefix: HEADS_PATH_PREFIX })}
        </div>
      </div>

      {/* Fetch button */}
      <button
        onClick={() => fetchMutation.mutate()}
        disabled={!canFetch || fetchMutation.isPending}
        className="flex items-center gap-2 rounded-md bg-accent px-4 pt-[7px] pb-[9px] text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <FileText size={16} />
        {fetchMutation.isPending ? t('state.fetching', { ns: 'common' }) : t('downloadFile.fetchFile')}
      </button>

      {/* Error */}
      {fetchMutation.error && (
        <div className="rounded-md border border-error/30 bg-error/10 p-3 text-sm text-error">
          {fetchMutation.error.message}
        </div>
      )}

      {/* File content */}
      {fetchMutation.data && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t('downloadFile.fileContent')}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-hover"
              >
                {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                {copied ? t('button.copied', { ns: 'common' }) : t('button.copy', { ns: 'common' })}
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-hover"
              >
                <Download size={14} />
                {t('button.save', { ns: 'common' })}
              </button>
            </div>
          </div>
          {savedPath && (
            <div className="text-xs text-success">{t('downloadFile.savedTo', { path: savedPath })}</div>
          )}
          <pre className="max-h-[500px] overflow-auto rounded-md border border-border bg-black/20 p-4 text-xs font-mono text-foreground whitespace-pre-wrap break-words">
            {fetchMutation.data}
          </pre>
        </div>
      )}
    </div>
  )
}
