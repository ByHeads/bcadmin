import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useConnectionStore } from '@/stores/connection'
import { useWorkstationIds } from '@/hooks/useWorkstationIds'
import {
  TargetSelector,
  OperationProgress,
  ConfirmDialog,
  parseManualLaunchResponse,
  DEFAULT_OPERATION_TIMEOUT,
  type WorkstationResult,
  type ManualLaunchResult
} from '@/components/deploy'

const LAUNCH_PRODUCTS = ['Receiver', 'WpfClient', 'PosServer', 'CustomerServiceApplication'] as const
type LaunchProduct = (typeof LAUNCH_PRODUCTS)[number]

export function ManualLaunchTab(): React.ReactNode {
  const { t } = useTranslation(['deploy', 'common'])
  const { client } = useConnectionStore()

  const [product, setProduct] = useState<LaunchProduct>('WpfClient')
  const [version, setVersion] = useState('')
  const [selectedWorkstations, setSelectedWorkstations] = useState<string[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [results, setResults] = useState<WorkstationResult[]>([])

  // Fetch workstations
  const { data: workstations = [] } = useWorkstationIds()

  // Fetch deployed (launchable) versions for selected product
  const { data: versions = [], isLoading: versionsLoading } = useQuery({
    queryKey: ['deploy-launchable-versions', product],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      const result = await client.get<{ Version: string }>(
        'Broadcaster.Deployment.File',
        { ProductName: product },
        { select: 'Version', order_asc: 'Version', distinct: true },
        signal
      )
      return result.map((r) => r.Version)
    },
    enabled: !!client
  })

  // Reset version when product changes or versions load
  useEffect(() => {
    if (versions.length > 0 && !versions.includes(version)) {
      setVersion(versions[versions.length - 1] ?? '')
    }
  }, [versions, product]) // eslint-disable-line react-hooks/exhaustive-deps

  const launchMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('No client')
      const body = {
        Workstations: selectedWorkstations,
        Product: product,
        Version: version
      }
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_OPERATION_TIMEOUT)
      try {
        const response = await client.post<ManualLaunchResult>(
          'Broadcaster.RemoteDeployment.ManualLaunch',
          body,
          undefined,
          controller.signal
        )
        return parseManualLaunchResponse(response)
      } finally {
        clearTimeout(timeoutId)
      }
    },
    onSuccess: (data) => {
      setResults(data)
      setShowConfirm(false)
    },
    onError: () => {
      setShowConfirm(false)
    }
  })

  const canSubmit = selectedWorkstations.length > 0 && version !== ''

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* Target workstations */}
      <TargetSelector
        workstations={workstations}
        selected={selectedWorkstations}
        onChange={setSelectedWorkstations}
        disabled={launchMutation.isPending}
      />

      {/* Product selector */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">{t('label.product', { ns: 'common' })}</label>
        <select
          value={product}
          onChange={(e) => {
            setProduct(e.target.value as LaunchProduct)
            setVersion('')
            setResults([])
          }}
          className="appearance-none rounded-md border border-border bg-surface py-1.5 pl-3 pr-8 text-sm text-foreground transition-colors hover:border-accent focus:border-accent focus:outline-none"
        >
          {LAUNCH_PRODUCTS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Version selector */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">{t('label.version', { ns: 'common' })}</label>
        {versionsLoading ? (
          <div className="text-sm text-muted">{t('install.loadingVersions')}</div>
        ) : versions.length === 0 ? (
          <div className="text-sm text-muted">{t('manualLaunch.noVersions')}</div>
        ) : (
          <select
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="appearance-none rounded-md border border-border bg-surface py-1.5 pl-3 pr-8 text-sm text-foreground transition-colors hover:border-accent focus:border-accent focus:outline-none"
          >
            {versions.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        )}
      </div>

      {/* Execute button */}
      <button
        onClick={() => { setResults([]); setShowConfirm(true) }}
        disabled={!canSubmit || launchMutation.isPending}
        className="rounded-md bg-accent px-4 pt-[7px] pb-[9px] text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t('button.launch', { ns: 'common' })}
      </button>

      {/* Results */}
      <OperationProgress
        results={results}
        isExecuting={launchMutation.isPending}
        error={launchMutation.error?.message ?? null}
      />

      {/* Confirmation dialog */}
      <ConfirmDialog
        open={showConfirm}
        title={t('manualLaunch.confirmTitle', { product })}
        message={t('manualLaunch.confirmMessage', { product, version, count: selectedWorkstations.length })}
        confirmLabel={t('button.launch', { ns: 'common' })}
        confirmVariant="primary"
        isLoading={launchMutation.isPending}
        onConfirm={() => launchMutation.mutate()}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}
