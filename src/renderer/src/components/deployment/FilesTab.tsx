import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { FileText, Trash2, X } from 'lucide-react'
import { useConnectionStore } from '@/stores/connection'
import { formatTimestamp } from '@/lib/utils'
import { DashboardTable, ProductSelector, type ProductName, PRODUCTS } from '@/components/dashboard'
import { ConfirmDialog } from '@/components/deploy'
import { buildVersionConditions } from './shared'

interface FileRow {
  ProductName: string
  Version: string
  CreatedUtc: string
  Name: string
  FullName: string
}

interface GroupedFile {
  version: string
  latestBuild: string
  files: { name: string; fullName: string }[]
}

const columnHelper = createColumnHelper<GroupedFile>()

export function FilesTab(): React.ReactNode {
  const { t } = useTranslation('deployment')
  const { client, activeConnection } = useConnectionStore()
  const queryClient = useQueryClient()
  const [product, setProduct] = useState<ProductName>('Receiver')
  const [filesModal, setFilesModal] = useState<{ version: string; product: string; files: { name: string; fullName: string }[] } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['deployment-files', activeConnection?.id, product],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<FileRow>(
        'Broadcaster.Deployment.File',
        `ProductName=${product}`,
        { select: 'ProductName,Version,CreatedUtc,Name,FullName', order_asc: 'CreatedUtc' },
        signal
      )
    },
    enabled: !!client,
    refetchInterval: 5_000
  })

  const { data: scheduleData } = useQuery({
    queryKey: ['launch-schedule-versions', activeConnection?.id, product],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<{ ProductName: string; Version: string }>(
        'Broadcaster.Deployment.LaunchSchedule',
        `ProductName=${product}`,
        { select: 'ProductName,Version' },
        signal
      )
    },
    enabled: !!client,
    refetchInterval: 5_000
  })

  const scheduledVersions = useMemo(() => {
    if (!scheduleData) return new Set<string>()
    return new Set(scheduleData.map((s) => s.Version))
  }, [scheduleData])

  const grouped = useMemo<GroupedFile[]>(() => {
    if (!data) return []
    const map = new Map<string, { latestBuild: string; files: { name: string; fullName: string }[] }>()
    for (const row of data) {
      const existing = map.get(row.Version)
      if (existing) {
        existing.files.push({ name: row.Name, fullName: row.FullName })
        if (row.CreatedUtc > existing.latestBuild) existing.latestBuild = row.CreatedUtc
      } else {
        map.set(row.Version, {
          latestBuild: row.CreatedUtc,
          files: [{ name: row.Name, fullName: row.FullName }]
        })
      }
    }
    return Array.from(map.entries())
      .map(([version, info]) => ({ version, latestBuild: info.latestBuild, files: info.files }))
      .sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }))
  }, [data])

  const deleteMutation = useMutation({
    mutationFn: async (version: string) => {
      if (!client) throw new Error('No client')
      const conditions = `ProductName=${product}&${buildVersionConditions(version)}`
      await client.delete('Broadcaster.Deployment.File', conditions)
    },
    onSuccess: () => {
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['deployment-files'] })
    }
  })

  const columns = useMemo<ColumnDef<GroupedFile, unknown>[]>(
    () => [
      columnHelper.accessor('version', {
        header: t('files.column.version'),
        cell: (info) => info.getValue()
      }) as ColumnDef<GroupedFile, unknown>,
      columnHelper.accessor('latestBuild', {
        header: t('files.column.latestBuild'),
        meta: { datetime: true },
        cell: (info) => {
          const val = info.getValue()
          try {
            return <span className="font-mono tabular-nums">{formatTimestamp(val)}</span>
          } catch {
            return val
          }
        }
      }) as ColumnDef<GroupedFile, unknown>,
      columnHelper.display({
        id: 'files',
        header: t('files.column.files'),
        cell: ({ row }) => (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setFilesModal({ version: row.original.version, product, files: row.original.files })
            }}
            className="flex items-center gap-1 rounded p-1 text-muted transition-colors hover:text-foreground"
            title={t('files.viewFiles')}
          >
            <FileText size={14} />
            <span className="text-xs">{row.original.files.length}</span>
          </button>
        )
      }) as ColumnDef<GroupedFile, unknown>,
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const inSchedule = scheduledVersions.has(row.original.version)
          return (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (!inSchedule) setDeleteTarget(row.original.version)
              }}
              disabled={inSchedule}
              title={inSchedule ? t('files.deleteDisabled') : undefined}
              className={`flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors ${inSchedule ? 'cursor-not-allowed bg-muted/10 text-muted/50' : 'bg-error/10 text-error hover:bg-error/20'}`}
            >
              <Trash2 size={12} />
              {t('button.delete', { ns: 'common' })}
            </button>
          )
        }
      }) as ColumnDef<GroupedFile, unknown>
    ],
    [product, scheduledVersions, t]
  )

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted">{t('state.loading', { ns: 'common' })}</div>
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-error/10 p-4 text-error">
          {error instanceof Error ? error.message : t('files.error')}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 px-6 pt-6 pb-4">
        <ProductSelector value={product} onChange={setProduct} products={PRODUCTS} />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-6 pb-6">
        <DashboardTable
          data={grouped}
          columns={columns}
        />
      </div>
      {deleteTarget !== null && (
        <ConfirmDialog
          open
          title={t('files.cleanupTitle')}
          message={t('files.deleteMessage', { version: deleteTarget, product })}
          confirmLabel={deleteMutation.isPending
            ? t('state.deleting', { ns: 'common' })
            : t('button.delete', { ns: 'common' })}
          confirmVariant="danger"
          isLoading={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {filesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setFilesModal(null)}>
          <div className="w-full max-w-lg rounded-lg border border-border bg-surface p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                {t('files.filesTitle', { product: filesModal.product, version: filesModal.version })}
              </h2>
              <button onClick={() => setFilesModal(null)} className="rounded p-1 text-muted transition-colors hover:text-foreground">
                <X size={16} />
              </button>
            </div>
            <div className="mt-3 space-y-1">
              {filesModal.files.map((f) => (
                <div key={f.fullName} className="rounded bg-hover/50 px-3 py-1.5 font-mono text-xs text-muted">
                  {f.fullName}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
