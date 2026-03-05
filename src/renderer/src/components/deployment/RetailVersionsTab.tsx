import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, AlertTriangle } from 'lucide-react'
import { useConnectionStore } from '@/stores/connection'
import { ConfirmDialog } from '@/components/deploy'
import { isValidRetailVersion } from './shared'

interface RemoteFileSettings {
  RetailBuildTags: string[]
}

export function RetailVersionsTab(): React.ReactNode {
  const { t } = useTranslation('deployment')
  const { client, activeConnection } = useConnectionStore()
  const queryClient = useQueryClient()
  const [newTag, setNewTag] = useState('')
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['retail-versions', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      const result = await client.get<RemoteFileSettings>(
        'Broadcaster.Deployment.RemoteFile.Settings',
        undefined,
        { select: 'RetailBuildTags' },
        signal
      )
      // API returns array with single settings object
      if (Array.isArray(result) && result.length > 0) {
        const tags = result[0].RetailBuildTags
        return Array.isArray(tags) ? tags : []
      }
      return []
    },
    enabled: !!client
  })

  const tags = useMemo(() => data ?? [], [data])

  const updateMutation = useMutation({
    mutationFn: async (newTags: string[]) => {
      if (!client) throw new Error('No client')
      return client.patch('Broadcaster.Deployment.RemoteFile.Settings', {
        RetailBuildTags: newTags
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail-versions'] })
    }
  })

  function handleAdd(): void {
    const trimmed = newTag.trim()
    if (!trimmed) return

    // Strip @ prefix for storage but allow it for validation bypass
    const tagValue = trimmed.startsWith('@') ? trimmed.slice(1).trim() : trimmed

    if (!tagValue) return

    if (!isValidRetailVersion(trimmed)) {
      setValidationError(t('retailVersions.invalidFormat'))
      return
    }

    if (tags.includes(tagValue)) {
      setValidationError(t('retailVersions.alreadyExists'))
      return
    }

    setValidationError(null)
    updateMutation.mutate([...tags, tagValue])
    setNewTag('')
  }

  function handleRemove(tag: string): void {
    const newTags = tags.filter((t) => t !== tag)
    updateMutation.mutate(newTags)
    setRemoveTarget(null)
  }

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted">{t('state.loading', { ns: 'common' })}</div>
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-error/10 p-4 text-error">
          {error instanceof Error ? error.message : t('retailVersions.error')}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <p className="mb-4 text-sm text-muted">
        {t('retailVersions.description')}
      </p>

      {/* Add tag input */}
      <div className="mb-6">
        <div className="flex items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted">
              {t('retailVersions.versionTag')}{' '}
              <span className="text-muted/60">
                {t('retailVersions.versionTagHint')}
              </span>
            </label>
            <input
              type="text"
              value={newTag}
              onChange={(e) => {
                setNewTag(e.target.value)
                setValidationError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd()
              }}
              placeholder={t('retailVersions.tagPlaceholder')}
              className="w-64 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={!newTag.trim() || updateMutation.isPending}
            className="flex items-center gap-1 rounded-md bg-accent px-3 pt-[5px] pb-[7px] text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={14} />
            {updateMutation.isPending ? t('state.adding', { ns: 'common' }) : t('button.add', { ns: 'common' })}
          </button>
        </div>
        {validationError && (
          <p className="mt-1 flex items-center gap-1 text-xs text-error">
            <AlertTriangle size={12} />
            {validationError}
          </p>
        )}
        {updateMutation.isError && (
          <p className="mt-1 text-xs text-error">
            {updateMutation.error instanceof Error
              ? updateMutation.error.message
              : t('retailVersions.updateError')}
          </p>
        )}
      </div>

      {/* Tags list */}
      {tags.length === 0 ? (
        <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted">
          {t('retailVersions.empty')}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <div
              key={tag}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm"
            >
              <span className="font-medium text-foreground">{tag}</span>
              <button
                onClick={() => setRemoveTarget(tag)}
                className="text-muted transition-colors hover:text-error"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Remove confirmation dialog */}
      <ConfirmDialog
        open={removeTarget !== null}
        title={t('retailVersions.removeTitle')}
        message={t('retailVersions.removeMessage', { tag: removeTarget })}
        detail={t('retailVersions.removeDetail')}
        confirmLabel={updateMutation.isPending ? t('state.removing', { ns: 'common' }) : t('button.remove', { ns: 'common' })}
        confirmVariant="danger"
        isLoading={updateMutation.isPending}
        onConfirm={() => {
          if (removeTarget) handleRemove(removeTarget)
        }}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  )
}
