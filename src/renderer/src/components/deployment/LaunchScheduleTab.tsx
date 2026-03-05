import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { Plus, Trash2 } from 'lucide-react'
import { useConnectionStore } from '@/stores/connection'
import { useDateTimeStore } from '@/stores/datetime'
import { DashboardTable, ProductSelector, type ProductName, PRODUCTS } from '@/components/dashboard'
import { ConfirmDialog } from '@/components/deploy'
import { formatDateTimeDisplay, parseDateTimeInput, extractTicksFromDateTime } from './shared'

interface LaunchScheduleEntry {
  ProductName: string
  Version: string
  RuntimeId: string
  DateTime: string
}

interface CurrentVersionEntry {
  [product: string]: { Version: string } | string | unknown
}

type ActiveVersionsMap = Record<string, string[]>

const scheduleColumnHelper = createColumnHelper<LaunchScheduleEntry>()

export function LaunchScheduleTab(): React.ReactNode {
  const { t } = useTranslation('deployment')
  const { client, activeConnection } = useConnectionStore()
  const queryClient = useQueryClient()
  const [showAddForm, setShowAddForm] = useState(false)
  const [addProduct, setAddProduct] = useState<ProductName>('Receiver')
  const [addVersion, setAddVersion] = useState('')
  const [addRuntimeId, setAddRuntimeId] = useState('win7-x64')
  const [addDateTime, setAddDateTime] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<LaunchScheduleEntry | null>(null)
  const [inputUtc, setInputUtc] = useState(() => useDateTimeStore.getState().utc)

  // Fetch current versions
  const { data: currentVersionsData } = useQuery({
    queryKey: ['launch-schedule-current-versions', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<CurrentVersionEntry>(
        'Broadcaster.Deployment.LaunchSchedule.CurrentVersions',
        undefined,
        undefined,
        signal
      )
    },
    enabled: !!client,
    refetchInterval: 5_000
  })

  // Fetch active versions (scheduled launches)
  const { data: activeVersionsData } = useQuery({
    queryKey: ['launch-schedule-active-versions', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<ActiveVersionsMap>(
        'Broadcaster.Deployment.LaunchSchedule.ActiveVersions',
        undefined,
        undefined,
        signal
      )
    },
    enabled: !!client,
    refetchInterval: 5_000
  })

  // Fetch scheduled launches
  const { data: scheduleData, isLoading, error, refetch } = useQuery({
    queryKey: ['launch-schedule', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<LaunchScheduleEntry>(
        'Broadcaster.Deployment.LaunchSchedule',
        undefined,
        undefined,
        signal
      )
    },
    enabled: !!client,
    refetchInterval: 5_000
  })

  // Fetch deployed versions for the add-form product selector
  const { data: deployedVersions } = useQuery({
    queryKey: ['deployed-versions-for-schedule', activeConnection?.id, addProduct],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<{ Version: string }>(
        'Broadcaster.Deployment.File',
        `ProductName=${addProduct}`,
        { order_asc: 'Version', select: 'Version', distinct: true },
        signal
      )
    },
    enabled: !!client && showAddForm
  })

  // Parse current versions into a display-friendly format
  const currentVersions = useMemo(() => {
    if (!currentVersionsData || !Array.isArray(currentVersionsData) || currentVersionsData.length === 0) return null
    const item = currentVersionsData[0] as Record<string, unknown>
    const result: Record<string, string> = {}
    for (const product of PRODUCTS) {
      const val = item[product]
      if (val && typeof val === 'object' && val !== null && 'Version' in val) {
        result[product] = (val as { Version: string }).Version
      } else if (typeof val === 'string') {
        result[product] = val
      }
    }
    return result
  }, [currentVersionsData])

  // Parse active versions — API returns [{ ProductName: ["v1", "v2"], ... }]
  const activeVersions = useMemo<Array<{ product: string; versions: string[] }>>(() => {
    if (!activeVersionsData || !Array.isArray(activeVersionsData) || activeVersionsData.length === 0) return []
    const map = activeVersionsData[0] as ActiveVersionsMap
    if (!map || typeof map !== 'object') return []
    return Object.entries(map)
      .filter(([, versions]) => Array.isArray(versions) && versions.length > 0)
      .map(([product, versions]) => ({ product, versions: versions.map(String) }))
  }, [activeVersionsData])

  const rows = useMemo(() => scheduleData ?? [], [scheduleData])

  // Add schedule mutation
  const addMutation = useMutation({
    mutationFn: async (entry: { ProductName: string; Version: string; RuntimeId: string; DateTime: string }) => {
      if (!client) throw new Error('No client')
      return client.post('Broadcaster.Deployment.LaunchSchedule', entry)
    },
    onSuccess: () => {
      setShowAddForm(false)
      setAddVersion('')
      setAddDateTime('')
      queryClient.invalidateQueries({ queryKey: ['launch-schedule'] })
      queryClient.invalidateQueries({ queryKey: ['launch-schedule-current-versions'] })
      queryClient.invalidateQueries({ queryKey: ['launch-schedule-active-versions'] })
      refetch()
    }
  })

  // Delete schedule mutation
  const deleteMutation = useMutation({
    mutationFn: async (entry: LaunchScheduleEntry) => {
      if (!client) throw new Error('No client')
      const ticks = extractTicksFromDateTime(entry.DateTime)
      if (!ticks) throw new Error('Cannot determine DateTime.Ticks for deletion')
      const conditions = `ProductName=${entry.ProductName}&Version=${entry.Version}&RuntimeId=${entry.RuntimeId}&DateTime.Ticks=${ticks}`
      return client.delete(
        'Broadcaster.Deployment.LaunchSchedule',
        conditions
      )
    },
    onSuccess: () => {
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['launch-schedule'] })
      queryClient.invalidateQueries({ queryKey: ['launch-schedule-current-versions'] })
      queryClient.invalidateQueries({ queryKey: ['launch-schedule-active-versions'] })
      refetch()
    }
  })

  const scheduleColumns = useMemo<ColumnDef<LaunchScheduleEntry, unknown>[]>(
    () => [
      scheduleColumnHelper.accessor('ProductName', {
        header: t('launchSchedule.column.product'),
        cell: (info) => info.getValue()
      }) as ColumnDef<LaunchScheduleEntry, unknown>,
      scheduleColumnHelper.accessor('Version', {
        header: t('launchSchedule.column.version'),
        cell: (info) => info.getValue()
      }) as ColumnDef<LaunchScheduleEntry, unknown>,
      scheduleColumnHelper.accessor('RuntimeId', {
        header: t('launchSchedule.column.runtime'),
        cell: (info) => info.getValue()
      }) as ColumnDef<LaunchScheduleEntry, unknown>,
      scheduleColumnHelper.accessor('DateTime', {
        header: t('launchSchedule.column.scheduled'),
        meta: { datetime: true },
        cell: (info) => formatDateTimeDisplay(info.getValue())
      }) as ColumnDef<LaunchScheduleEntry, unknown>,
      scheduleColumnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setDeleteTarget(row.original)
            }}
            className="flex items-center gap-1 rounded-md bg-error/10 px-3 py-1 text-xs font-medium text-error transition-colors hover:bg-error/20"
          >
            <Trash2 size={12} />
            {t('button.delete', { ns: 'common' })}
          </button>
        )
      }) as ColumnDef<LaunchScheduleEntry, unknown>
    ],
    [t]
  )

  function handleAddSubmit(): void {
    if (!addVersion) return
    const dateTimeValue = parseDateTimeInput(addDateTime, inputUtc)
    addMutation.mutate({
      ProductName: addProduct,
      Version: addVersion,
      RuntimeId: addRuntimeId,
      DateTime: dateTimeValue
    })
  }

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted">{t('state.loading', { ns: 'common' })}</div>
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-error/10 p-4 text-error">
          {error instanceof Error ? error.message : t('launchSchedule.error')}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Current Versions summary */}
      {currentVersions && Object.keys(currentVersions).length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">{t('launchSchedule.currentVersions')}</h3>
          <div className="flex flex-wrap gap-3">
            {PRODUCTS.map((p) =>
              currentVersions[p] ? (
                <div key={p} className="rounded-md border border-border bg-card px-3 py-1.5 text-xs">
                  <span className="text-muted">{p}:</span>{' '}
                  <span className="font-medium text-foreground">{currentVersions[p]}</span>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}

      {/* Active Versions summary */}
      {activeVersions.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">{t('launchSchedule.activeVersions')}</h3>
          <div className="flex flex-wrap gap-3">
            {activeVersions.map((av) => (
              <div key={av.product} className="rounded-md border border-border bg-card px-3 py-1.5 text-xs">
                <span className="text-muted">{av.product}:</span>{' '}
                <span className="font-medium text-foreground">{av.versions.join(', ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add schedule button / form */}
      <div className="mb-4">
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 rounded-md bg-accent px-3 pt-[5px] pb-[7px] text-sm font-medium text-white transition-colors hover:bg-accent/90"
          >
            <Plus size={14} />
            {t('launchSchedule.addSchedule')}
          </button>
        ) : (
          <div className="rounded-md border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">{t('launchSchedule.addLaunchSchedule')}</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted">{t('label.product', { ns: 'common' })}</label>
                <ProductSelector value={addProduct} onChange={(p) => { setAddProduct(p); setAddVersion('') }} products={PRODUCTS} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">{t('label.version', { ns: 'common' })}</label>
                <select
                  value={addVersion}
                  onChange={(e) => setAddVersion(e.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                >
                  <option value="">{t('launchSchedule.selectVersion')}</option>
                  {deployedVersions?.map((v) => (
                    <option key={v.Version} value={v.Version}>
                      {v.Version}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">{t('label.runtime', { ns: 'common' })}</label>
                <input
                  type="text"
                  value={addRuntimeId}
                  onChange={(e) => setAddRuntimeId(e.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                  placeholder="win7-x64"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">
                  {t('launchSchedule.dateTimeLabel')}{' '}
                  <span className="text-muted/60">{t('launchSchedule.dateTimeEmpty')}</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="datetime-local"
                    value={addDateTime}
                    onChange={(e) => setAddDateTime(e.target.value)}
                    className="w-64 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setInputUtc((prev) => !prev)}
                    className={`w-[42px] rounded border py-0.5 text-center text-[10px] font-medium transition-colors ${inputUtc ? 'border-accent/40 text-accent' : 'border-border text-muted hover:border-foreground/30 hover:text-foreground'}`}
                    title={inputUtc ? 'Input is UTC — click for local time' : 'Input is local time — click for UTC'}
                  >
                    {inputUtc ? 'UTC' : 'Local'}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddSubmit}
                  disabled={!addVersion || addMutation.isPending}
                  className="rounded-md bg-accent px-3 pt-[5px] pb-[7px] text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {addMutation.isPending ? t('state.adding', { ns: 'common' }) : t('button.add', { ns: 'common' })}
                </button>
                <button
                  onClick={() => { setShowAddForm(false); setAddVersion(''); setAddDateTime('') }}
                  className="rounded-md border border-border px-3 pt-[5px] pb-[7px] text-sm text-muted transition-colors hover:text-foreground"
                >
                  {t('button.cancel', { ns: 'common' })}
                </button>
              </div>
            </div>
            {addMutation.isError && (
              <p className="mt-2 text-sm text-error">
                {addMutation.error instanceof Error ? addMutation.error.message : t('launchSchedule.addError')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Scheduled launches table */}
      <h3 className="mb-2 text-sm font-semibold text-foreground">{t('launchSchedule.scheduledLaunches')}</h3>
      <DashboardTable
        data={rows}
        columns={scheduleColumns}
      />

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title={t('launchSchedule.deleteTitle')}
        message={t('launchSchedule.deleteMessage', { product: deleteTarget?.ProductName, version: deleteTarget?.Version })}
        detail={t('launchSchedule.deleteDetail', { runtime: deleteTarget?.RuntimeId, dateTime: deleteTarget?.DateTime ? formatDateTimeDisplay(deleteTarget.DateTime) : '\u2014' })}
        confirmLabel={deleteMutation.isPending ? t('state.deleting', { ns: 'common' }) : t('button.delete', { ns: 'common' })}
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget)
        }}
        onCancel={() => setDeleteTarget(null)}
      />
      {deleteMutation.isError && (
        <p className="mt-2 text-sm text-error">
          {deleteMutation.error instanceof Error ? deleteMutation.error.message : t('launchSchedule.deleteError')}
        </p>
      )}
    </div>
  )
}
