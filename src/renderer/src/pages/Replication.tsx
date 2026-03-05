import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TabButton } from '@/components/ui/TabButton'
import { StatusTab, DetailsTab, FilterTab, GroupsTab } from '@/components/replication'

type Tab = 'status' | 'details' | 'filter' | 'groups'

export function ReplicationPage(): React.ReactNode {
  const [activeTab, setActiveTab] = useState<Tab>('status')
  const { t } = useTranslation('replication')

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="border-b border-border px-6">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <div className="mt-2 flex gap-4">
          <TabButton label={t('tab.status')} active={activeTab === 'status'} onClick={() => setActiveTab('status')} />
          <TabButton label={t('tab.details')} active={activeTab === 'details'} onClick={() => setActiveTab('details')} />
          <TabButton label={t('tab.filter')} active={activeTab === 'filter'} onClick={() => setActiveTab('filter')} />
          <TabButton label={t('tab.groups')} active={activeTab === 'groups'} onClick={() => setActiveTab('groups')} />
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'status' && <StatusTab />}
        {activeTab === 'details' && <DetailsTab />}
        {activeTab === 'filter' && <FilterTab />}
        {activeTab === 'groups' && <GroupsTab />}
      </div>
    </div>
  )
}
