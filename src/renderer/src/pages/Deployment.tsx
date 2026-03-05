import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DownloadLimiterPanel, FilesTab, DeployVersionsTab, LaunchScheduleTab, RetailVersionsTab } from '@/components/deployment'
import { TabButton } from '@/components/ui/TabButton'

type DeploymentTab = 'files' | 'deploy-versions' | 'launch-schedule' | 'retail-versions' | 'download-limiter'

export function DeploymentPage(): React.ReactNode {
  const [activeTab, setActiveTab] = useState<DeploymentTab>('files')
  const { t } = useTranslation('deployment')

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border px-6">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <div className="mt-2 flex gap-4">
          <TabButton label={t('tab.versions')} active={activeTab === 'files'} onClick={() => setActiveTab('files')} />
          <TabButton label={t('tab.deployVersions')} active={activeTab === 'deploy-versions'} onClick={() => setActiveTab('deploy-versions')} />
          <TabButton label={t('tab.launchSchedule')} active={activeTab === 'launch-schedule'} onClick={() => setActiveTab('launch-schedule')} />
          <TabButton label={t('tab.retailVersions')} active={activeTab === 'retail-versions'} onClick={() => setActiveTab('retail-versions')} />
          <TabButton label={t('tab.downloadLimiter')} active={activeTab === 'download-limiter'} onClick={() => setActiveTab('download-limiter')} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === 'files' && <FilesTab />}
        {activeTab === 'deploy-versions' && <DeployVersionsTab />}
        {activeTab === 'launch-schedule' && <LaunchScheduleTab />}
        {activeTab === 'retail-versions' && <RetailVersionsTab />}
        {activeTab === 'download-limiter' && <DownloadLimiterPanel />}
      </div>
    </div>
  )
}
