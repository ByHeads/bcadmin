import { useTranslation } from 'react-i18next'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import type { ExecutedScriptResult, ManualLaunchResult, WorkstationResult } from './response-parsing'

interface OperationProgressProps {
  results: WorkstationResult[]
  isExecuting: boolean
  error?: string | null
}

export function OperationProgress({
  results,
  isExecuting,
  error
}: OperationProgressProps): React.ReactNode {
  const { t } = useTranslation(['deploy', 'common'])

  if (error) {
    return (
      <div className="rounded-md bg-error/10 p-4 text-sm text-error">
        {error}
      </div>
    )
  }

  if (isExecuting && results.length === 0) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted">
        <Loader2 size={16} className="animate-spin" />
        {t('state.executingOperation', { ns: 'common' })}
      </div>
    )
  }

  if (results.length === 0) return null

  const successCount = results.filter((r) => r.success).length
  const failureCount = results.length - successCount

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        {successCount > 0 && (
          <span className="flex items-center gap-1 text-success">
            <CheckCircle2 size={14} />
            {t('count.succeeded', { ns: 'common', count: successCount })}
          </span>
        )}
        {failureCount > 0 && (
          <span className="flex items-center gap-1 text-error">
            <XCircle size={14} />
            {t('count.failed', { ns: 'common', count: failureCount })}
          </span>
        )}
        {isExecuting && (
          <span className="flex items-center gap-1 text-muted">
            <Loader2 size={14} className="animate-spin" />
            {t('state.inProgress', { ns: 'common' })}
          </span>
        )}
      </div>

      {/* Per-workstation results */}
      <div className="rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                {t('progress.status')}
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                {t('progress.workstation')}
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                {t('progress.details')}
              </th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr
                key={result.workstationId}
                className="border-b border-border last:border-b-0"
              >
                <td className="px-4 py-2">
                  {result.success ? (
                    <CheckCircle2 size={16} className="text-success" />
                  ) : (
                    <XCircle size={16} className="text-error" />
                  )}
                </td>
                <td className="px-4 py-2 font-mono text-foreground">
                  {result.workstationId}
                </td>
                <td className="px-4 py-2 text-muted">
                  {result.errors.length > 0 ? (
                    <span className="text-error">{result.errors.join('; ')}</span>
                  ) : result.success ? (
                    t('state.success', { ns: 'common' })
                  ) : (
                    t('state.failed', { ns: 'common' })
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Re-export types for convenience
export type { ExecutedScriptResult, ManualLaunchResult, WorkstationResult }
