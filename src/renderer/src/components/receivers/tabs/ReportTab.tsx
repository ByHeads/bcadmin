import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { useConnectionStore } from '@/stores/connection'
import { ReportCard } from './shared'

interface ReportData {
  receiverCount: number
  wpfClientNoPosCount: number
  wpfClientWithPosCount: number
  csaCount: number
}

function parseReportResult(result: Record<string, unknown>): ReportData {
  const extract = (key: string): number => {
    const val = result[key] as Record<string, unknown> | undefined
    return (val?.Count as number) ?? 0
  }
  return {
    receiverCount: extract('receiverCount'),
    wpfClientNoPosCount: extract('wpfClientNoPosCount'),
    wpfClientWithPosCount: extract('wpfClientWithPosCount'),
    csaCount: extract('csaCount')
  }
}

export function ReportTab(): React.ReactNode {
  const { client, activeConnection } = useConnectionStore()
  const { t } = useTranslation('receivers')
  const [startDate, setStartDate] = useState('')
  const [submittedDate, setSubmittedDate] = useState<string | null>(null)

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['receivers-report', activeConnection?.id, submittedDate],
    queryFn: async ({ signal }) => {
      if (!client || !submittedDate) throw new Error('No client or date')
      const dateCondition = `lastactive>=${submittedDate}`
      const result = await client.aggregate(
        {
          receiverCount: `REPORT /Broadcaster.Admin.ReceiverLog/${dateCondition}`,
          wpfClientNoPosCount: `REPORT /Broadcaster.Admin.ReceiverLog/${dateCondition}&modules.WpfClient.isinstalled=true&modules.PosServer.isinstalled=false`,
          wpfClientWithPosCount: `REPORT /Broadcaster.Admin.ReceiverLog/${dateCondition}&modules.WpfClient.isinstalled=true&modules.PosServer.isinstalled=true`,
          csaCount: `REPORT /Broadcaster.Admin.ReceiverLog/${dateCondition}&modules.CustomerServiceApplication.isinstalled=true`
        },
        signal
      )
      return parseReportResult(result)
    },
    enabled: !!client && !!submittedDate
  })

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (startDate) {
      setSubmittedDate(startDate)
    }
  }

  return (
    <div className="p-6">
      <form onSubmit={handleSubmit} className="mb-6 flex items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">{t('report.startDate')}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={!startDate || isLoading}
          className="rounded-md bg-accent px-4 pt-[7px] pb-[9px] text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
        >
          {isFetching ? (
            <span className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              {t('state.loading', { ns: 'common' })}
            </span>
          ) : (
            t('report.generateReport')
          )}
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded-md bg-error/10 p-4 text-error">
          {error instanceof Error ? error.message : t('report.error')}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ReportCard label={t('report.totalReceivers')} value={data.receiverCount} />
          <ReportCard label={t('report.wpfClientNoPos')} value={data.wpfClientNoPosCount} />
          <ReportCard label={t('report.wpfClientWithPos')} value={data.wpfClientWithPosCount} />
          <ReportCard label={t('report.csa')} value={data.csaCount} />
        </div>
      )}

      {!data && !error && !isFetching && (
        <div className="flex h-48 items-center justify-center text-muted">
          {t('report.emptyHint')}
        </div>
      )}
    </div>
  )
}
