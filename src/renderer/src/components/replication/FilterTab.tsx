import { useState, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Search, Users, Monitor, Save, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useConnectionStore } from '@/stores/connection'
import { useWorkstationIds } from '@/hooks/useWorkstationIds'

type FilterMode = 'all' | 'none' | 'custom'

interface ReplicationFilterData {
  EnabledRecipients: string[]
}

function deriveMode(recipients: string[]): FilterMode {
  if (recipients.length === 1 && recipients[0] === '*') return 'all'
  if (recipients.length === 0) return 'none'
  return 'custom'
}

export function FilterTab(): React.ReactNode {
  const { t } = useTranslation('replication')
  const { client, activeConnection, hasAccess } = useConnectionStore()
  const queryClient = useQueryClient()
  const canEdit = hasAccess('Broadcaster.Replication.ReplicationFilter', 'PATCH')

  // Fetch current filter
  const { data: filterData, isLoading: filterLoading, error: filterError } = useQuery({
    queryKey: ['replication-filter', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      const results = await client.get<ReplicationFilterData>(
        'Broadcaster.Replication.ReplicationFilter',
        undefined,
        undefined,
        signal
      )
      return results[0] ?? { EnabledRecipients: [] }
    },
    enabled: !!client
  })

  // Fetch workstation IDs for custom multi-select
  const { data: workstations } = useWorkstationIds()

  // Fetch workstation groups for the multi-select
  const canViewGroups = hasAccess('Broadcaster.Replication.WorkstationGroups', 'GET')
  const { data: groupNames } = useQuery({
    queryKey: ['replication-filter-groups', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      const results = await client.get<Record<string, string[]>>(
        'Broadcaster.Replication.WorkstationGroups',
        undefined,
        undefined,
        signal
      )
      // Groups API returns a single object with group names as keys
      const groups = results[0]
      return groups ? Object.keys(groups).sort() : []
    },
    enabled: !!client && canViewGroups
  })

  const currentRecipients = filterData?.EnabledRecipients ?? []
  const currentMode = deriveMode(currentRecipients)

  // Local editing state
  const [mode, setMode] = useState<FilterMode | null>(null)
  const [customSelection, setCustomSelection] = useState<string[]>([])
  const [searchFilter, setSearchFilter] = useState('')
  const [isDirty, setIsDirty] = useState(false)

  // Initialize local state from fetched data
  const effectiveMode = mode ?? currentMode
  const effectiveSelection = isDirty ? customSelection : (currentMode === 'custom' ? currentRecipients : [])

  const handleModeChange = useCallback((newMode: FilterMode) => {
    setMode(newMode)
    setIsDirty(true)
    if (newMode === 'custom' && !isDirty) {
      // Pre-populate with current custom selection if switching to custom
      setCustomSelection(currentMode === 'custom' ? [...currentRecipients] : [])
    }
  }, [currentMode, currentRecipients, isDirty])

  const toggleRecipient = useCallback((recipient: string) => {
    setIsDirty(true)
    if (mode !== 'custom') setMode('custom')
    setCustomSelection((prev) =>
      prev.includes(recipient) ? prev.filter((r) => r !== recipient) : [...prev, recipient]
    )
  }, [mode])

  const resetEdits = useCallback(() => {
    setMode(null)
    setCustomSelection([])
    setSearchFilter('')
    setIsDirty(false)
  }, [])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('No client')
      let recipients: string[]
      if (effectiveMode === 'all') recipients = ['*']
      else if (effectiveMode === 'none') recipients = []
      else recipients = effectiveSelection

      await client.patch(
        'Broadcaster.Replication.ReplicationFilter',
        { EnabledRecipients: recipients }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['replication-filter'] })
      resetEdits()
    }
  })

  // Available options for custom multi-select
  const allOptions = useMemo(() => {
    const opts: { label: string; value: string; type: 'workstation' | 'group' }[] = []
    if (groupNames) {
      for (const g of groupNames) {
        opts.push({ label: g, value: g, type: 'group' })
      }
    }
    if (workstations) {
      for (const ws of workstations) {
        opts.push({ label: ws, value: ws, type: 'workstation' })
      }
    }
    return opts
  }, [workstations, groupNames])

  const filteredOptions = useMemo(() => {
    if (!searchFilter) return allOptions
    const lower = searchFilter.toLowerCase()
    return allOptions.filter((o) => o.label.toLowerCase().includes(lower))
  }, [allOptions, searchFilter])

  if (filterLoading) {
    return <div className="flex h-64 items-center justify-center text-muted">{t('state.loading', { ns: 'common' })}</div>
  }

  if (filterError) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-error/10 p-4 text-error">
          {filterError instanceof Error ? filterError.message : t('filter.error')}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-2xl space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('filter.title')}</h2>
          <p className="mt-1 text-sm text-muted">
            {t('filter.description')}
          </p>
        </div>

        {/* Three-state selector */}
        <div className="flex gap-2">
          {(['all', 'none', 'custom'] as FilterMode[]).map((m) => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              disabled={!canEdit}
              className={`rounded-md px-4 pt-[7px] pb-[9px] text-sm font-medium transition-colors ${
                effectiveMode === m
                  ? 'bg-accent text-white'
                  : 'bg-surface text-muted hover:text-foreground border border-border'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {m === 'all' ? t('filter.modeAll') : m === 'none' ? t('filter.modeNone') : t('filter.modeCustom')}
            </button>
          ))}
        </div>

        {/* Mode description */}
        <div className="rounded-md border border-border bg-surface p-3 text-sm text-muted">
          {effectiveMode === 'all' && t('filter.descAll')}
          {effectiveMode === 'none' && t('filter.descNone')}
          {effectiveMode === 'custom' && t('filter.descCustom', { count: effectiveSelection.length })}
        </div>

        {/* Custom multi-select */}
        {effectiveMode === 'custom' && (
          <div className="space-y-3">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder={t('filter.searchPlaceholder')}
                className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </div>

            {/* Selection list */}
            <div className="max-h-64 overflow-y-auto rounded-md border border-border">
              {filteredOptions.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted">
                  {allOptions.length === 0 ? t('filter.noOptions') : t('filter.noMatchesFound')}
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = effectiveSelection.includes(opt.value)
                  return (
                    <label
                      key={`${opt.type}-${opt.value}`}
                      className={`flex cursor-pointer items-center gap-3 border-b border-border px-4 py-2 text-sm transition-colors last:border-b-0 hover:bg-hover ${
                        !canEdit ? 'cursor-not-allowed opacity-50' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRecipient(opt.value)}
                        disabled={!canEdit}
                        className="rounded border-border"
                      />
                      {opt.type === 'group' ? (
                        <Users size={14} className="text-accent" />
                      ) : (
                        <Monitor size={14} className="text-muted" />
                      )}
                      <span className="font-mono text-foreground">{opt.label}</span>
                      <span className="text-xs text-muted">
                        {opt.type === 'group' ? t('filter.group') : t('filter.workstation')}
                      </span>
                    </label>
                  )
                })
              )}
            </div>

            {/* Selected count */}
            <div className="text-xs text-muted">
              {t('filter.selectedCount', { selected: effectiveSelection.length, total: allOptions.length })}
            </div>
          </div>
        )}

        {/* Save / Cancel buttons */}
        {isDirty && canEdit && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 rounded-md bg-accent px-4 pt-[7px] pb-[9px] text-sm font-medium text-white transition-colors hover:bg-accent/80 disabled:opacity-50"
            >
              <Save size={16} />
              {saveMutation.isPending ? t('state.saving', { ns: 'common' }) : t('button.save', { ns: 'common' })}
            </button>
            <button
              onClick={resetEdits}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 rounded-md border border-border px-4 pt-[7px] pb-[9px] text-sm font-medium text-muted transition-colors hover:text-foreground disabled:opacity-50"
            >
              <X size={16} />
              {t('button.cancel', { ns: 'common' })}
            </button>
          </div>
        )}

        {saveMutation.isError && (
          <div className="rounded-md bg-error/10 p-4 text-error text-sm">
            {saveMutation.error instanceof Error ? saveMutation.error.message : t('filter.saveError')}
          </div>
        )}

        {saveMutation.isSuccess && !isDirty && (
          <div className="rounded-md bg-success/10 p-4 text-success text-sm">
            {t('filter.saveSuccess')}
          </div>
        )}

        {!canEdit && (
          <div className="rounded-md bg-warning/10 p-3 text-sm text-warning">
            {t('filter.noPermission')}
          </div>
        )}
      </div>
    </div>
  )
}
