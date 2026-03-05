import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
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

export function ResetTab(): React.ReactNode {
  const { t } = useTranslation(['deploy', 'common'])
  const { client } = useConnectionStore()

  const [selectedWorkstations, setSelectedWorkstations] = useState<string[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [results, setResults] = useState<WorkstationResult[]>([])

  // Fetch workstations
  const { data: workstations = [] } = useWorkstationIds()

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('No client')
      const body = {
        Workstations: selectedWorkstations
      }
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_OPERATION_TIMEOUT)
      try {
        const response = await client.post<ExecutedScriptResult>(
          'Broadcaster.RemoteDeployment.Reset',
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

  const canSubmit = selectedWorkstations.length > 0

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* Target workstations */}
      <TargetSelector
        workstations={workstations}
        selected={selectedWorkstations}
        onChange={setSelectedWorkstations}
        disabled={resetMutation.isPending}
      />

      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-md border border-warning bg-warning/10 p-4 text-sm text-warning">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <div>
          <div className="font-medium">{t('reset.warningTitle')}</div>
          <div className="mt-1 text-xs opacity-80">
            {t('reset.warningMessage')}
          </div>
        </div>
      </div>

      {/* Execute button */}
      <button
        onClick={() => { setResults([]); setShowConfirm(true) }}
        disabled={!canSubmit || resetMutation.isPending}
        className="rounded-md bg-error px-4 pt-[7px] pb-[9px] text-sm font-medium text-white transition-colors hover:bg-error/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t('button.reset', { ns: 'common' })}
      </button>

      {/* Results */}
      <OperationProgress
        results={results}
        isExecuting={resetMutation.isPending}
        error={resetMutation.error?.message ?? null}
      />

      {/* Confirmation dialog */}
      <ConfirmDialog
        open={showConfirm}
        title={t('reset.confirmTitle')}
        message={t('reset.confirmMessage', { count: selectedWorkstations.length })}
        detail={t('reset.confirmDetail')}
        confirmLabel={t('button.reset', { ns: 'common' })}
        confirmVariant="danger"
        isLoading={resetMutation.isPending}
        onConfirm={() => resetMutation.mutate()}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}
