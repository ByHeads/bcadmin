import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { Download, FileText, X, AlertTriangle, Info } from 'lucide-react'
import { useConnectionStore } from '@/stores/connection'
import { formatTimestamp } from '@/lib/utils'
import { DashboardTable, ProductSelector, type ProductName, PRODUCTS } from '@/components/dashboard'
import { ConfirmDialog } from '@/components/deploy'
import { buildVersionConditions } from './shared'

interface RemoteFileRow {
  Version: string
  CreatedUtc: string
  Name: string
  FullName: string
}

interface GroupedVersion {
  version: string
  latestBuild: string
  files: { name: string; fullName: string }[]
}

interface SftpSettingsRow {
  Url?: string
  Port?: number
  UserName?: string
}

interface RebuildIndexRow {
  Success: boolean
  ElapsedSeconds: number
  FoundFiles: number
  Error?: string
}

const groupedColumnHelper = createColumnHelper<GroupedVersion>()

export function DeployVersionsTab(): React.ReactNode {
  const { t } = useTranslation('deployment')
  const { client, activeConnection } = useConnectionStore()
  const queryClient = useQueryClient()
  const [product, setProduct] = useState<ProductName>('Receiver')
  const [confirmVersion, setConfirmVersion] = useState<string | null>(null)
  const [filesModal, setFilesModal] = useState<{ version: string; product: string; files: { name: string; fullName: string }[] } | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['deploy-versions', activeConnection?.id, product],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<RemoteFileRow>(
        'Broadcaster.Deployment.RemoteFile',
        `ProductName=${product}`,
        { order_asc: 'CreatedUTC', select: 'Version,CreatedUtc,Name,FullName' },
        signal
      )
    },
    enabled: !!client,
    refetchInterval: 5_000
  })

  // When the list is empty it can mean "nothing to deploy" — but also that the
  // Broadcaster has no access to the remote SFTP software server (the API returns
  // an empty list in both cases). Probe the SFTP sub-resources to tell them apart.
  const listEmpty = !isLoading && !error && (data?.length ?? 0) === 0

  const sftpSettings = useQuery({
    queryKey: ['sftp-settings', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<SftpSettingsRow>(
        'Broadcaster.Deployment.RemoteFile.Settings',
        undefined,
        undefined,
        signal
      )
    },
    enabled: !!client && listEmpty,
    staleTime: 60_000
  })
  const sftpConfigured = sftpSettings.data
    ? sftpSettings.data.length > 0 && !!sftpSettings.data[0].Url
    : undefined

  const sftpCheck = useQuery({
    queryKey: ['sftp-check', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<RebuildIndexRow>(
        'Broadcaster.Deployment.RemoteFile.RebuildIndex',
        undefined,
        undefined,
        signal
      )
    },
    enabled: !!client && listEmpty && sftpConfigured === true,
    staleTime: 300_000,
    refetchOnWindowFocus: false
  })
  const sftpCheckResult = sftpCheck.data?.[0]

  const grouped = useMemo<GroupedVersion[]>(() => {
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

  const deployMutation = useMutation({
    mutationFn: async (version: string) => {
      if (!client) throw new Error('No client')
      const conditions = `ProductName=${product}&${buildVersionConditions(version)}`
      return client.patch(
        'Broadcaster.Deployment.RemoteFile',
        { Deploy: true },
        conditions,
        { offset: -4, unsafe: true }
      )
    },
    onSuccess: () => {
      setConfirmVersion(null)
      queryClient.invalidateQueries({ queryKey: ['deployment-files'] })
      refetch()
    }
  })

  const deployColumns = useMemo<ColumnDef<GroupedVersion, unknown>[]>(
    () => [
      groupedColumnHelper.accessor('version', {
        header: t('deployVersions.column.version'),
        cell: (info) => info.getValue()
      }) as ColumnDef<GroupedVersion, unknown>,
      groupedColumnHelper.accessor('latestBuild', {
        header: t('deployVersions.column.latestBuild'),
        meta: { datetime: true },
        cell: (info) => {
          const val = info.getValue()
          try {
            return <span className="font-mono tabular-nums">{formatTimestamp(val)}</span>
          } catch {
            return val
          }
        }
      }) as ColumnDef<GroupedVersion, unknown>,
      groupedColumnHelper.display({
        id: 'files',
        header: t('deployVersions.column.files'),
        cell: ({ row }) => (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setFilesModal({ version: row.original.version, product, files: row.original.files })
            }}
            className="flex items-center gap-1 rounded p-1 text-muted transition-colors hover:text-foreground"
            title={t('deployVersions.viewFiles')}
          >
            <FileText size={14} />
            <span className="text-xs">{row.original.files.length}</span>
          </button>
        )
      }) as ColumnDef<GroupedVersion, unknown>,
      groupedColumnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setConfirmVersion(row.original.version)
            }}
            className="flex items-center gap-1 rounded-md bg-accent px-3 pt-[3px] pb-[5px] text-xs font-medium text-white transition-colors hover:bg-accent/90"
          >
            <Download size={12} />
            {t('deployVersions.deploy')}
          </button>
        )
      }) as ColumnDef<GroupedVersion, unknown>
    ],
    [t]
  )

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted">{t('state.loading', { ns: 'common' })}</div>
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-error/10 p-4 text-error">
          {error instanceof Error ? error.message : t('deployVersions.error')}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-center gap-4">
          <ProductSelector value={product} onChange={setProduct} products={PRODUCTS} />
          {deployMutation.isError && (
            <span className="text-sm text-error">
              {deployMutation.error instanceof Error ? deployMutation.error.message : t('deployVersions.deployError')}
            </span>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-6 pb-6">
        {grouped.length === 0 ? (
          <div className="pt-2">
            {sftpConfigured === false ? (
              <div className="flex items-start gap-3 rounded-md border border-warning bg-warning/10 p-4 text-sm text-warning">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>{t('deployVersions.sftpNotConfigured')}</span>
              </div>
            ) : sftpCheckResult && !sftpCheckResult.Success ? (
              <div className="flex items-start gap-3 rounded-md border border-warning bg-warning/10 p-4 text-sm text-warning">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">
                    {t('deployVersions.sftpNoAccess', { url: sftpSettings.data?.[0]?.Url ?? '' })}
                  </div>
                  {sftpCheckResult.Error && (
                    <div className="mt-1 font-mono text-xs">{sftpCheckResult.Error}</div>
                  )}
                </div>
              </div>
            ) : sftpSettings.isLoading || sftpCheck.isLoading ? (
              <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-4 text-sm text-muted">
                {t('deployVersions.sftpChecking')}
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-md border border-border bg-surface p-4 text-sm text-muted">
                <Info size={16} className="mt-0.5 shrink-0" />
                <span>{t('deployVersions.empty', { product })}</span>
              </div>
            )}
          </div>
        ) : (
          <DashboardTable
            data={grouped}
            columns={deployColumns}
          />
        )}
      </div>
      <ConfirmDialog
        open={confirmVersion !== null}
        title={t('deployVersions.confirmTitle')}
        message={t('deployVersions.confirmMessage', { product, version: confirmVersion })}
        detail={t('deployVersions.confirmDetail')}
        confirmLabel={deployMutation.isPending ? t('state.deploying', { ns: 'common' }) : t('deployVersions.deploy')}
        confirmVariant="primary"
        isLoading={deployMutation.isPending}
        onConfirm={() => {
          if (confirmVersion) deployMutation.mutate(confirmVersion)
        }}
        onCancel={() => setConfirmVersion(null)}
      />
      {filesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setFilesModal(null)}>
          <div className="w-full max-w-lg rounded-lg border border-border bg-surface p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                {t('deployVersions.filesTitle', { product: filesModal.product, version: filesModal.version })}
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
