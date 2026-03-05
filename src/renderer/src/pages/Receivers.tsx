import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TabButton } from '@/components/ui/TabButton'
import { ReceiverDetailPanel } from '@/components/receivers/ReceiverDetailPanel'
import {
  ConnectedTab,
  AllTab,
  SoftwareTab,
  SystemInfoTab,
  ManualClientsTab,
  ReportTab
} from '@/components/receivers/tabs'

type Tab = 'connected' | 'all' | 'software' | 'systeminfo' | 'manualclients' | 'report'

export function ReceiversPage(): React.ReactNode {
  const [activeTab, setActiveTab] = useState<Tab>('connected')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedConnected, setSelectedConnected] = useState(true)
  const { t } = useTranslation('receivers')

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="border-b border-border px-6">
          <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
          <div className="mt-2 flex gap-4">
            <TabButton label={t('tab.connected')} active={activeTab === 'connected'} onClick={() => { setActiveTab('connected'); setSelectedId(null); setSelectedConnected(true) }} />
            <TabButton label={t('tab.all')} active={activeTab === 'all'} onClick={() => { setActiveTab('all'); setSelectedId(null) }} />
            <TabButton label={t('tab.software')} active={activeTab === 'software'} onClick={() => { setActiveTab('software'); setSelectedId(null) }} />
            <TabButton label={t('tab.systemInfo')} active={activeTab === 'systeminfo'} onClick={() => { setActiveTab('systeminfo'); setSelectedId(null) }} />
            <TabButton label={t('tab.manualClients')} active={activeTab === 'manualclients'} onClick={() => { setActiveTab('manualclients'); setSelectedId(null) }} />
            <TabButton label={t('tab.report')} active={activeTab === 'report'} onClick={() => { setActiveTab('report'); setSelectedId(null) }} />
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'connected' && <ConnectedTab selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setSelectedConnected(true) }} />}
          {activeTab === 'all' && <AllTab selectedId={selectedId} onSelect={setSelectedId} onSelectConnected={setSelectedConnected} />}
          {activeTab === 'software' && <SoftwareTab />}
          {activeTab === 'systeminfo' && <SystemInfoTab />}
          {activeTab === 'manualclients' && <ManualClientsTab />}
          {activeTab === 'report' && <ReportTab />}
        </div>
      </div>

      {/* Detail panel */}
      {selectedId && (
        <ReceiverDetailPanel
          workstationId={selectedId}
          isConnected={selectedConnected}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
