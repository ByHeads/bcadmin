import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UpdatesTab, SoftwareTab, ReplicationTab } from '@/components/dashboard/tabs'
import { TabButton } from '@/components/ui/TabButton'

type DashboardTab = 'updates' | 'software' | 'replication'

export function DashboardsPage(): React.ReactNode {
  const [activeTab, setActiveTab] = useState<DashboardTab>('updates')
  const { t } = useTranslation('dashboards')

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="border-b border-border px-6">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <div className="mt-2 flex gap-4">
          <TabButton label={t('tab.updates')} active={activeTab === 'updates'} onClick={() => setActiveTab('updates')} />
          <TabButton label={t('tab.software')} active={activeTab === 'software'} onClick={() => setActiveTab('software')} />
          <TabButton label={t('tab.replication')} active={activeTab === 'replication'} onClick={() => setActiveTab('replication')} />
        </div>
      </div>

      {/* Tab content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'updates' && <UpdatesTab />}
        {activeTab === 'software' && <SoftwareTab />}
        {activeTab === 'replication' && <ReplicationTab />}
      </div>
    </div>
  )
}
