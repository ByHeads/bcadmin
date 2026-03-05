import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Info } from 'lucide-react'
import { useConnectionStore } from '@/stores/connection'
import { useWorkstationIds } from '@/hooks/useWorkstationIds'
import { ProductSelector, type ProductName } from '@/components/dashboard'
import {
  TargetSelector,
  OperationProgress,
  ConfirmDialog,
  parseExecutedScriptResponse,
  DEFAULT_OPERATION_TIMEOUT,
  type WorkstationResult,
  type ExecutedScriptResult
} from '@/components/deploy'
import { validateLabel, WpfClientFields, PosServerFields } from './shared'

const INSTALL_PRODUCTS = ['WpfClient', 'PosServer', 'CustomerServiceApplication'] as const
type InstallProduct = (typeof INSTALL_PRODUCTS)[number]

export function InstallTab(): React.ReactNode {
  const { t } = useTranslation(['deploy', 'common'])
  const { client } = useConnectionStore()

  const [product, setProduct] = useState<ProductName>('WpfClient')
  const [selectedWorkstations, setSelectedWorkstations] = useState<string[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [results, setResults] = useState<WorkstationResult[]>([])

  // Product-specific state
  const [version, setVersion] = useState('')
  const [runtimeId, setRuntimeId] = useState('win7-x64')

  // WpfClient state
  const [usePosServer, setUsePosServer] = useState(false)
  const [useArchiveServer, setUseArchiveServer] = useState(false)
  const [isManualClient, setIsManualClient] = useState(false)
  const [manualBroadcasterUrl, setManualBroadcasterUrl] = useState('')
  const [manualInstallToken, setManualInstallToken] = useState('')
  const [manualLabel, setManualLabel] = useState('')

  // PosServer state
  const [createDump, setCreateDump] = useState(false)
  const [collation, setCollation] = useState<string>('sv-SE')
  const [databaseImageSize, setDatabaseImageSize] = useState(1024)
  const [databaseLogSize, setDatabaseLogSize] = useState(1024)

  const isReceiver = product === 'Receiver'
  const installProduct = isReceiver ? 'WpfClient' : product

  // Fetch workstations
  const { data: workstations = [] } = useWorkstationIds()

  // Fetch versions for selected product
  const { data: versions = [], isLoading: versionsLoading } = useQuery({
    queryKey: ['deploy-versions', installProduct],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      const result = await client.get<{ Version: string }>(
        'Broadcaster.Deployment.LaunchSchedule',
        { ProductName: installProduct },
        { select: 'Version', order_asc: 'Version', distinct: true },
        signal
      )
      return result.map((r) => r.Version)
    },
    enabled: !!client && !isReceiver
  })

  // Reset version when product changes
  useEffect(() => {
    if (versions.length > 0 && !versions.includes(version)) {
      setVersion(versions[versions.length - 1] ?? '')
    }
  }, [versions, product]) // eslint-disable-line react-hooks/exhaustive-deps

  // Build request body
  function buildRequestBody(): Record<string, unknown> {
    const body: Record<string, unknown> = {
      Workstations: selectedWorkstations,
      Product: installProduct,
      Version: version,
      Runtime: runtimeId
    }

    if (installProduct === 'WpfClient') {
      body.Parameters = { usePosServer, useArchiveServer }
      if (isManualClient) {
        body.BroadcasterUrl = manualBroadcasterUrl
        body.InstallToken = manualInstallToken
        body.Parameters = {
          ...body.Parameters as Record<string, unknown>,
          installPath: manualLabel,
          shortcutLabel: manualLabel
        }
      }
    } else if (installProduct === 'PosServer') {
      body.Parameters = {
        createDump,
        collation,
        databaseImageSize,
        databaseLogSize
      }
    }

    return body
  }

  const installMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('No client')
      const body = buildRequestBody()
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_OPERATION_TIMEOUT)
      try {
        const response = await client.post<ExecutedScriptResult>(
          'Broadcaster.RemoteDeployment.RemoteInstall',
          body,
          undefined,
          controller.signal
        )
        return parseExecutedScriptResponse(response)
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

  const labelError = isManualClient ? validateLabel(manualLabel) : null

  const canSubmit =
    !isReceiver &&
    selectedWorkstations.length > 0 &&
    version !== '' &&
    runtimeId !== '' &&
    (!isManualClient || (manualBroadcasterUrl !== '' && manualInstallToken !== '' && !labelError))

  function handleProductChange(p: ProductName): void {
    setProduct(p)
    setVersion('')
    setResults([])
    setIsManualClient(false)
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* Target workstations */}
      <TargetSelector
        workstations={workstations}
        selected={selectedWorkstations}
        onChange={setSelectedWorkstations}
        disabled={installMutation.isPending}
      />

      {/* Product selector */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">{t('label.product', { ns: 'common' })}</label>
        <ProductSelector value={product} onChange={handleProductChange} />
      </div>

      {/* Receiver info message */}
      {isReceiver && (
        <div className="flex items-start gap-2 rounded-md bg-accent/10 p-4 text-sm text-accent">
          <Info size={16} className="mt-0.5 shrink-0" />
          <span>
            {t('install.receiverInfo')}
          </span>
        </div>
      )}

      {!isReceiver && (
        <>
          {/* Version selector */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">{t('label.version', { ns: 'common' })}</label>
            {versionsLoading ? (
              <div className="text-sm text-muted">{t('install.loadingVersions')}</div>
            ) : versions.length === 0 ? (
              <div className="text-sm text-muted">{t('install.noVersions')}</div>
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

          {/* Runtime ID */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">{t('install.runtimeId')}</label>
            <input
              type="text"
              value={runtimeId}
              onChange={(e) => setRuntimeId(e.target.value)}
              className="rounded-md border border-border bg-surface py-1.5 px-3 text-sm text-foreground transition-colors focus:border-accent focus:outline-none"
            />
          </div>

          {/* WpfClient-specific fields */}
          {installProduct === 'WpfClient' && (
            <WpfClientFields
              usePosServer={usePosServer}
              setUsePosServer={setUsePosServer}
              useArchiveServer={useArchiveServer}
              setUseArchiveServer={setUseArchiveServer}
              isManualClient={isManualClient}
              setIsManualClient={setIsManualClient}
              manualBroadcasterUrl={manualBroadcasterUrl}
              setManualBroadcasterUrl={setManualBroadcasterUrl}
              manualInstallToken={manualInstallToken}
              setManualInstallToken={setManualInstallToken}
              manualLabel={manualLabel}
              setManualLabel={setManualLabel}
              labelError={labelError ? t(labelError, { ns: 'common' }) : null}
            />
          )}

          {/* PosServer-specific fields */}
          {installProduct === 'PosServer' && (
            <PosServerFields
              createDump={createDump}
              setCreateDump={setCreateDump}
              collation={collation}
              setCollation={setCollation}
              databaseImageSize={databaseImageSize}
              setDatabaseImageSize={setDatabaseImageSize}
              databaseLogSize={databaseLogSize}
              setDatabaseLogSize={setDatabaseLogSize}
            />
          )}

          {/* CSA note */}
          {installProduct === 'CustomerServiceApplication' && (
            <div className="flex items-start gap-2 rounded-md bg-surface border border-border p-3 text-xs text-muted">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>
                {t('install.csaNote')}
              </span>
            </div>
          )}

          {/* Execute button */}
          <button
            onClick={() => { setResults([]); setShowConfirm(true) }}
            disabled={!canSubmit || installMutation.isPending}
            className="rounded-md bg-accent px-4 pt-[7px] pb-[9px] text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('button.install', { ns: 'common' })}
          </button>

          {/* Results */}
          <OperationProgress
            results={results}
            isExecuting={installMutation.isPending}
            error={installMutation.error?.message ?? null}
          />

          {/* Confirmation dialog */}
          <ConfirmDialog
            open={showConfirm}
            title={t('install.confirmTitle', { product: installProduct })}
            message={t('install.confirmMessage', { product: installProduct, version, count: selectedWorkstations.length })}
            detail={t('install.confirmDetail', { runtime: runtimeId }) + (isManualClient ? ' (manual client)' : '')}
            confirmLabel={t('button.install', { ns: 'common' })}
            confirmVariant="primary"
            isLoading={installMutation.isPending}
            onConfirm={() => installMutation.mutate()}
            onCancel={() => setShowConfirm(false)}
          />
        </>
      )}
    </div>
  )
}
