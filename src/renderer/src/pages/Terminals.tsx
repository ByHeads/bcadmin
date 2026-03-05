import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useConnectionStore } from '@/stores/connection'
import { TerminalEmulator } from '@/components/terminal/TerminalEmulator'
import { Bug } from 'lucide-react'

const TABS = [
  { id: 'access-token', labelKey: 'tab.accessToken', resource: 'Broadcaster.Auth.AccessToken.Commands', debug: false },
  { id: 'replication-commands', labelKey: 'tab.replicationCommands', resource: 'Broadcaster.Replication.ReplicationCommands', debug: false },
  { id: 'shell', labelKey: 'tab.shell', resource: 'RESTable.Shell', debug: true }
] as const

type TabId = (typeof TABS)[number]['id']

export function TerminalsPage(): JSX.Element {
  const { activeConnection, hasAccess } = useConnectionStore()
  const [activeTab, setActiveTab] = useState<TabId>('access-token')
  const [apiKey, setApiKey] = useState<string | null>(null)
  const { t } = useTranslation('terminals')

  useEffect(() => {
    if (!activeConnection) return
    window.api.getCredential(activeConnection.id).then((key) => {
      setApiKey(key ?? null)
    })
  }, [activeConnection])

  const accessibleTabs = TABS.filter((tab) => {
    if (tab.id === 'shell') return hasAccess('RESTable.Shell', 'GET')
    if (tab.id === 'replication-commands') return hasAccess('Broadcaster.Replication.ReplicationCommands', 'GET')
    return true
  })

  // Reset to first accessible tab if current is inaccessible
  const currentTab = accessibleTabs.find((t) => t.id === activeTab) ?? accessibleTabs[0]
  const baseUrl = activeConnection?.url ?? ''

  if (!apiKey) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        <div className="text-sm">{t('loadingCredentials')}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 26px)' }}>
      {/* Tab bar */}
      <div className="border-b border-border px-6">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <div className="mt-2 flex gap-4">
          {accessibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 pb-2 text-sm font-medium transition-colors ${
                currentTab.id === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              {tab.debug && <Bug size={14} />}
              {t(tab.labelKey)}
              {tab.debug && (
                <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-warning">
                  {t('debug')}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal content — fill remaining height, no outer scroll */}
      <div className="min-h-0 flex-1 p-6">
        {currentTab && (
          <TerminalEmulator
            key={currentTab.id}
            baseUrl={baseUrl}
            apiKey={apiKey}
            resource={currentTab.resource}
          />
        )}
      </div>
    </div>
  )
}
