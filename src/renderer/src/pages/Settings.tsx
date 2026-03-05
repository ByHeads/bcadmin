import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useConnectionStore } from '@/stores/connection'
import { TabButton } from '@/components/ui/TabButton'
import { ConfigTab, UpdateTab, RestartTab, DependenciesTab } from '@/components/settings'
import { ConnectionCheckTab } from '@/components/replication/ConnectionCheckTab'

type SettingsTab = 'config' | 'update' | 'restart' | 'dependencies' | 'retail-connection'

export function SettingsPage(): React.ReactNode {
  const [activeTab, setActiveTab] = useState<SettingsTab>('config')
  const { hasAccess } = useConnectionStore()
  const { t } = useTranslation('settings')

  const canAccessUpdate = hasAccess('Broadcaster.Admin.BroadcasterUpdate', 'GET')
  const canAccessRestart = hasAccess('Broadcaster.Admin.BroadcasterRestart', 'PATCH')
  const canAccessDeps = hasAccess('Broadcaster.Admin.DependencyStatus', 'GET')
  const canAccessRetailConn = hasAccess('Broadcaster.Replication.CheckRetailConnection', 'GET')

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border px-6">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <div className="mt-2 flex gap-4">
          <TabButton label={t('tab.config')} active={activeTab === 'config'} onClick={() => setActiveTab('config')} />
          {canAccessUpdate && (
            <TabButton label={t('tab.update')} active={activeTab === 'update'} onClick={() => setActiveTab('update')} />
          )}
          {canAccessRestart && (
            <TabButton label={t('tab.restart')} active={activeTab === 'restart'} onClick={() => setActiveTab('restart')} />
          )}
          {canAccessDeps && (
            <TabButton label={t('tab.dependencies')} active={activeTab === 'dependencies'} onClick={() => setActiveTab('dependencies')} />
          )}
          {canAccessRetailConn && (
            <TabButton label={t('tab.retailConnection')} active={activeTab === 'retail-connection'} onClick={() => setActiveTab('retail-connection')} />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'config' && <ConfigTab />}
        {activeTab === 'update' && <UpdateTab />}
        {activeTab === 'restart' && <RestartTab />}
        {activeTab === 'dependencies' && <DependenciesTab />}
        {activeTab === 'retail-connection' && <ConnectionCheckTab />}
      </div>
    </div>
  )
}
