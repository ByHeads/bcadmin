import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Info } from 'lucide-react'
import { useConnectionStore } from '@/stores/connection'
import { useWorkstationIds } from '@/hooks/useWorkstationIds'
import {
  TargetSelector,
  OperationProgress,
  ConfirmDialog,
  parseExecutedScriptResponse,
  DEFAULT_OPERATION_TIMEOUT,
  type WorkstationResult,
  type ExecutedScriptResult
} from '@/components/deploy'
import { validateLabel, Toggle } from './shared'

const UNINSTALL_PRODUCTS = ['WpfClient', 'PosServer'] as const
type UninstallProduct = (typeof UNINSTALL_PRODUCTS)[number]

export function UninstallTab(): React.ReactNode {
  const { t } = useTranslation(['deploy', 'common'])
  const { client } = useConnectionStore()

  const [isLegacy, setIsLegacy] = useState(false)
  const [product, setProduct] = useState<UninstallProduct>('WpfClient')
  const [isManualClient, setIsManualClient] = useState(false)
  const [manualLabel, setManualLabel] = useState('')
  const [selectedWorkstations, setSelectedWorkstations] = useState<string[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [results, setResults] = useState<WorkstationResult[]>([])

  // Fetch workstations
  const { data: workstations = [] } = useWorkstationIds()

  const labelError = isManualClient && !isLegacy ? validateLabel(manualLabel) : null

  const canSubmit =
    selectedWorkstations.length > 0 &&
    (isLegacy || (!isManualClient || !labelError))

  function buildRequestBody(): Record<string, unknown> {
    if (isLegacy) {
      return {
        Workstations: selectedWorkstations,
        Legacy: true
      }
    }

    const body: Record<string, unknown> = {
      Workstations: selectedWorkstations,
      Product: product
    }

    if (product === 'WpfClient' && isManualClient) {
      body.ManualClientName = manualLabel
    }

    return body
  }

  const uninstallMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('No client')
      const body = buildRequestBody()
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_OPERATION_TIMEOUT)
      try {
        const response = await client.post<ExecutedScriptResult>(
          'Broadcaster.RemoteDeployment.RemoteUninstall',
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

  const confirmTitle = isLegacy
    ? t('uninstall.confirmLegacyTitle')
    : t('uninstall.confirmTitle', { product })

  const confirmMessage = isLegacy
    ? t('uninstall.confirmLegacyMessage', { count: selectedWorkstations.length })
    : t('uninstall.confirmMessage', { product, label: isManualClient ? manualLabel : undefined, count: selectedWorkstations.length })

  const confirmDetail = isLegacy
    ? t('uninstall.confirmLegacyDetail')
    : undefined

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* Target workstations */}
      <TargetSelector
        workstations={workstations}
        selected={selectedWorkstations}
        onChange={setSelectedWorkstations}
        disabled={uninstallMutation.isPending}
      />

      {/* Legacy toggle */}
      <Toggle label={t('uninstall.legacyToggle')} checked={isLegacy} onChange={setIsLegacy} />
      {isLegacy && (
        <div className="flex items-start gap-2 rounded-md bg-accent/10 p-3 text-xs text-accent">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>{t('uninstall.legacyInfo')}</span>
        </div>
      )}

      {/* Product selector (hidden in legacy mode) */}
      {!isLegacy && (
        <>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">{t('label.product', { ns: 'common' })}</label>
            <select
              value={product}
              onChange={(e) => {
                setProduct(e.target.value as UninstallProduct)
                setIsManualClient(false)
                setManualLabel('')
              }}
              className="appearance-none rounded-md border border-border bg-surface py-1.5 pl-3 pr-8 text-sm text-foreground transition-colors hover:border-accent focus:border-accent focus:outline-none"
            >
              {UNINSTALL_PRODUCTS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Manual client option for WpfClient */}
          {product === 'WpfClient' && (
            <div className="space-y-3 rounded-md border border-border p-4">
              <Toggle label={t('uninstall.manualClient')} checked={isManualClient} onChange={setIsManualClient} />
              {isManualClient && (
                <div className="pl-4 border-l-2 border-accent/20">
                  <label className="mb-1 block text-xs font-medium text-muted">{t('shared.label')}</label>
                  <input
                    type="text"
                    value={manualLabel}
                    onChange={(e) => setManualLabel(e.target.value)}
                    placeholder={t('uninstall.labelPlaceholder')}
                    className={`w-full rounded-md border bg-surface py-1.5 px-3 text-sm text-foreground placeholder:text-muted/50 transition-colors focus:outline-none ${
                      labelError ? 'border-error focus:border-error' : 'border-border focus:border-accent'
                    }`}
                  />
                  {labelError && (
                    <div className="mt-1 text-xs text-error">{t(labelError, { ns: 'common' })}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Execute button */}
      <button
        onClick={() => { setResults([]); setShowConfirm(true) }}
        disabled={!canSubmit || uninstallMutation.isPending}
        className="rounded-md bg-error px-4 pt-[7px] pb-[9px] text-sm font-medium text-white transition-colors hover:bg-error/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t('button.uninstall', { ns: 'common' })}
      </button>

      {/* Results */}
      <OperationProgress
        results={results}
        isExecuting={uninstallMutation.isPending}
        error={uninstallMutation.error?.message ?? null}
      />

      {/* Confirmation dialog */}
      <ConfirmDialog
        open={showConfirm}
        title={confirmTitle}
        message={confirmMessage}
        detail={confirmDetail}
        confirmLabel={t('button.uninstall', { ns: 'common' })}
        confirmVariant="danger"
        isLoading={uninstallMutation.isPending}
        onConfirm={() => uninstallMutation.mutate()}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}
