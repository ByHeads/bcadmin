import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
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

export function CloseDayJournalTab(): React.ReactNode {
  const { t } = useTranslation(['deploy', 'common'])
  const { client } = useConnectionStore()

  const [selectedWorkstations, setSelectedWorkstations] = useState<string[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [results, setResults] = useState<WorkstationResult[]>([])
  const [posUser, setPosUser] = useState('')
  const [posPassword, setPosPassword] = useState('')

  // Fetch workstations
  const { data: workstations = [] } = useWorkstationIds()

  const closeDayJournalMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('No client')
      const body: Record<string, unknown> = {
        Workstations: selectedWorkstations,
        PosUser: posUser,
        PosPassword: posPassword
      }
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_OPERATION_TIMEOUT)
      try {
        const response = await client.post<ExecutedScriptResult>(
          'Broadcaster.RemoteDeployment.CloseDayJournal',
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

  const canSubmit = selectedWorkstations.length > 0 && posUser.length > 0 && posPassword.length > 0

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* Target workstations */}
      <TargetSelector
        workstations={workstations}
        selected={selectedWorkstations}
        onChange={setSelectedWorkstations}
        disabled={closeDayJournalMutation.isPending}
      />

      {/* POS Server Credentials */}
      <div className="space-y-3 rounded-md border border-border p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">
          {t('closeDayJournal.credentialsHeader')}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">{t('closeDayJournal.posUser')}</label>
          <input
            type="text"
            value={posUser}
            onChange={(e) => setPosUser(e.target.value)}
            disabled={closeDayJournalMutation.isPending}
            className="w-full rounded-md border border-border bg-surface py-1.5 px-3 text-sm text-foreground placeholder:text-muted/50 transition-colors focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">{t('closeDayJournal.posPassword')}</label>
          <input
            type="password"
            value={posPassword}
            onChange={(e) => setPosPassword(e.target.value)}
            disabled={closeDayJournalMutation.isPending}
            className="w-full rounded-md border border-border bg-surface py-1.5 px-3 text-sm text-foreground transition-colors focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      {/* Execute button */}
      <button
        onClick={() => { setResults([]); setShowConfirm(true) }}
        disabled={!canSubmit || closeDayJournalMutation.isPending}
        className="rounded-md bg-accent px-4 pt-[7px] pb-[9px] text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t('tab.closeDayJournal')}
      </button>

      {/* Results */}
      <OperationProgress
        results={results}
        isExecuting={closeDayJournalMutation.isPending}
        error={closeDayJournalMutation.error?.message ?? null}
      />

      {/* Confirmation dialog */}
      <ConfirmDialog
        open={showConfirm}
        title={t('closeDayJournal.confirmTitle')}
        message={t('closeDayJournal.confirmMessage', { count: selectedWorkstations.length })}
        detail={t('closeDayJournal.confirmDetail', { user: posUser })}
        confirmLabel={t('tab.closeDayJournal')}
        isLoading={closeDayJournalMutation.isPending}
        onConfirm={() => closeDayJournalMutation.mutate()}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}
