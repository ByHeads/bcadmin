import { useTranslation } from 'react-i18next'
import { ReplicationTab } from '@/components/dashboard/tabs'

export function DashboardReplicationPage(): React.ReactNode {
  const { t } = useTranslation('dashboards')
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 px-6">
        <h1 className="text-xl font-bold text-foreground">{t('tab.replication')}</h1>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <ReplicationTab />
      </div>
    </div>
  )
}
