import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TabButton } from '@/components/ui/TabButton'
import {
  InstallTab,
  UninstallTab,
  ManualLaunchTab,
  ServiceControlTab,
  ResetTab,
  CloseDayJournalTab,
  DownloadFileTab
} from '@/components/deploy/tabs'

type DeployTab = 'install' | 'uninstall' | 'manual-launch' | 'service-control' | 'reset' | 'close-day-journal' | 'download-file'

export function DeployPage(): React.ReactNode {
  const [activeTab, setActiveTab] = useState<DeployTab>('install')
  const { t } = useTranslation('deploy')

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border px-6">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <div className="mt-2 flex gap-4 overflow-x-auto">
          <TabButton label={t('tab.install')} active={activeTab === 'install'} onClick={() => setActiveTab('install')} />
          <TabButton label={t('tab.uninstall')} active={activeTab === 'uninstall'} onClick={() => setActiveTab('uninstall')} />
          <TabButton label={t('tab.manualLaunch')} active={activeTab === 'manual-launch'} onClick={() => setActiveTab('manual-launch')} />
          <TabButton label={t('tab.serviceControl')} active={activeTab === 'service-control'} onClick={() => setActiveTab('service-control')} />
          <TabButton label={t('tab.reset')} active={activeTab === 'reset'} onClick={() => setActiveTab('reset')} />
          <TabButton label={t('tab.closeDayJournal')} active={activeTab === 'close-day-journal'} onClick={() => setActiveTab('close-day-journal')} />
          <TabButton label={t('tab.downloadFile')} active={activeTab === 'download-file'} onClick={() => setActiveTab('download-file')} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'install' && <InstallTab />}
        {activeTab === 'uninstall' && <UninstallTab />}
        {activeTab === 'manual-launch' && <ManualLaunchTab />}
        {activeTab === 'service-control' && <ServiceControlTab />}
        {activeTab === 'reset' && <ResetTab />}
        {activeTab === 'close-day-journal' && <CloseDayJournalTab />}
        {activeTab === 'download-file' && <DownloadFileTab />}
      </div>
    </div>
  )
}
