import { useEffect, useMemo, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Bell, Lock, Info, ChevronLeft, Copy, Check, Server, BookOpen, ExternalLink, Wrench } from 'lucide-react'
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'
import { useConnectionStore } from '@/stores/connection'
import { ReAuthDialog } from '@/components/connection/ReAuthDialog'
import { ConnectionDropBanner } from '@/components/connection/ConnectionDropBanner'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import headsLogo from '@/assets/heads.svg'
import { OverviewPage } from '@/pages/Overview'
import { ReceiversPage } from '@/pages/Receivers'
import { NotificationsPage } from '@/pages/Notifications'
import { SettingsPage } from '@/pages/Settings'
import { DashboardUpdatesPage } from '@/pages/DashboardUpdates'
import { DashboardSoftwarePage } from '@/pages/DashboardSoftware'
import { DashboardReplicationPage } from '@/pages/DashboardReplication'
import { DeployPage } from '@/pages/Deploy'
import { ISMPage } from '@/pages/ISM'
import { InstallTokenPage } from '@/pages/InstallToken'
import { DeploymentPage } from '@/pages/Deployment'
import { ReplicationPage } from '@/pages/Replication'
import { TerminalsPage } from '@/pages/Terminals'
import { LogsPage } from '@/pages/Logs'
import { ConnectionsPage } from '@/pages/Connections'
import { DocumentationPage, docsUrl } from '@/pages/Documentation'
import { ConfigurationPage } from '@/pages/Configuration'

const isMac = window.api.platform === 'darwin'

/**
 * Resource requirements per nav item.
 * Each entry lists [resourceName, method] pairs — the user needs ALL of them to access the page.
 */
const NAV_ACCESS_REQUIREMENTS: Record<string, [string, string][]> = {
  receivers: [['Broadcaster.Admin.Receiver', 'GET']],
  'dashboards/updates': [['Broadcaster.Admin.ReceiverLog', 'GET']],
  'dashboards/software': [['Broadcaster.Admin.ReceiverLog', 'GET']],
  'dashboards/replication': [['Broadcaster.Admin.ReplicationState', 'GET']],
  notifications: [['Broadcaster.Admin.NotificationLog', 'GET']],
  deploy: [['Broadcaster.RemoteDeployment.RemoteInstall', 'POST']],
  ism: [['Broadcaster.Admin.InstallToken', 'GET']],
  'install-token': [['Broadcaster.Admin.InstallToken', 'GET']],
  deployment: [['Broadcaster.Deployment.RemoteFile', 'GET']],
  replication: [['Broadcaster.Replication.ReplicationFilter', 'GET']],
  terminals: [['Broadcaster.Auth.AccessToken', 'GET']],
  logs: [['Broadcaster.Admin.Log', 'GET']],
  settings: [['Broadcaster.Admin.Config', 'GET']]
}

const NAV_SECTIONS = [
  {
    labelKey: 'section.monitoring',
    items: [
      { id: 'receivers', labelKey: 'receivers' },
      { id: 'notifications', labelKey: 'notifications' }
    ]
  },
  {
    labelKey: 'section.dashboards',
    items: [
      { id: 'dashboards/updates', labelKey: 'dashboardUpdates' },
      { id: 'dashboards/software', labelKey: 'dashboardSoftware' },
      { id: 'dashboards/replication', labelKey: 'dashboardReplication' }
    ]
  },
  {
    labelKey: 'section.operations',
    items: [
      { id: 'deploy', labelKey: 'remote' },
      { id: 'ism', labelKey: 'ism' },
      { id: 'install-token', labelKey: 'installToken' },
      { id: 'deployment', labelKey: 'deployment' },
      { id: 'replication', labelKey: 'replication' }
    ]
  },
  {
    labelKey: 'section.tools',
    items: [
      { id: 'terminals', labelKey: 'terminals' },
      { id: 'logs', labelKey: 'logs' },
      { id: 'settings', labelKey: 'settings' }
    ]
  }
] as const

/** Map route path segments to page IDs (they are the same) */
const PAGE_IDS = ['overview', ...NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.id)), 'configuration', 'docs', 'connections']

/** Extract the current page ID from location pathname */
function pageIdFromPath(pathname: string): string {
  const path = pathname.replace(/^\//, '')
  if (!path) return 'overview'
  // Handle nested routes like dashboards/updates
  if (path.startsWith('dashboards/')) return path
  return path.split('/')[0]
}

export function AppShell(): JSX.Element {
  const { activeConnection, client, disconnect, hasAccess, connectionDropped } = useConnectionStore()
  const navigate = useNavigate()
  const location = useLocation()
  const activePage = pageIdFromPath(location.pathname)
  const { t, i18n } = useTranslation('nav')

  const isHttpConnection = activeConnection?.url.startsWith('http://') ?? false
  const [copied, setCopied] = useState(false)
  const [browserName, setBrowserName] = useState('')

  useEffect(() => {
    window.api.getDefaultBrowser().then((name) => setBrowserName(name))
  }, [])
  const { data: notificationCount } = useQuery({
    queryKey: ['notification-count', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) return 0
      return client.report('Broadcaster.Admin.NotificationLog', undefined, signal)
    },
    enabled: !!client && hasAccess('Broadcaster.Admin.NotificationLog', 'GET'),
    refetchInterval: 30_000
  })

  function canAccess(navId: string): boolean {
    const requirements = NAV_ACCESS_REQUIREMENTS[navId]
    if (!requirements) return true
    return requirements.every(([resource, method]) => hasAccess(resource, method))
  }

  const pageIds = useMemo(() => PAGE_IDS, [])

  const navigateTo = useMemo(
    () => (page: string) => navigate(`/${page === 'overview' ? '' : page}`),
    [navigate]
  )

  useKeyboardShortcuts({
    pageIds,
    activePage,
    setActivePage: navigateTo,
    canAccess
  })

  const isDocsPage = activePage === 'docs'

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar — hidden on docs page */}
      {!isDocsPage && (
      <aside className="flex w-[268px] flex-col border-r border-border bg-background">
        {/* macOS drag region for traffic lights */}
        {isMac && (
          <div className="h-[36px] shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />
        )}

        {/* Connection header — click name to go to Overview */}
        <div className="group/name border-b border-border px-7 pb-3 pt-2.5">
          <button
            onClick={disconnect}
            className="mb-1.5 -mt-1 flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
          >
            <ChevronLeft size={11} />
            {t('logout')}
          </button>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 shrink-0 rounded-full ${connectionDropped ? 'bg-error animate-pulse' : 'bg-success'}`} />
            <button
              onClick={() => navigateTo('overview')}
              className={`min-w-0 flex-1 truncate text-left text-[0.9rem] font-semibold transition-colors ${
                activePage === 'overview' ? 'text-foreground' : 'text-foreground hover:text-accent'
              }`}
              title={activeConnection?.name}
            >
              {activeConnection?.name ?? ''}
              {activeConnection?.id === 'local-broadcaster' && <span className="inline-flex align-middle" style={{ position: 'relative', top: '-2px', marginLeft: '8px' }}><VerifiedBadge /></span>}
            </button>
            <div className="ml-[7px] mt-[2px] flex shrink-0 items-center gap-1">
              {isHttpConnection && activeConnection?.id !== 'local-broadcaster' && (
                <span className="group relative -mt-[2px] text-warning">
                  <AlertTriangle size={14} />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                    {t('httpWarning')}
                  </span>
                </span>
              )}
              <span className="group relative">
                <button
                  className="rounded p-0.5 text-muted transition-colors hover:text-foreground"
                >
                  <Info size={14} />
                </button>
                <div className="pointer-events-none absolute left-0 top-full z-50 pt-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                <div className="min-w-72 max-w-96 rounded-md border border-border bg-surface p-3 text-xs shadow-lg">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1 break-all">
                      <span className="text-muted">URL: </span>
                      <span className="font-mono text-foreground">{activeConnection?.url.replace(/\/api\/?$/, '')}</span>
                    </div>
                    <span className="group/copy relative shrink-0">
                      <button
                        onClick={() => {
                          const url = activeConnection?.url.replace(/\/api\/?$/, '')
                          if (url) {
                            navigator.clipboard.writeText(url)
                            setCopied(true)
                            setTimeout(() => setCopied(false), 1500)
                          }
                        }}
                        className={`rounded p-1 transition-colors ${copied ? 'text-success' : 'text-muted hover:text-accent'}`}
                      >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background opacity-0 transition-opacity group-hover/copy:opacity-100">
                        {copied ? t('copiedUrl', { ns: 'common', defaultValue: 'Copied!' }) : t('copyUrl')}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 break-all">
                    <span className="text-muted">ID: </span>
                    <span className="font-mono text-foreground">{activeConnection?.id}</span>
                  </div>
                </div>
                </div>
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2">

          {NAV_SECTIONS.map((section) => (
            <div key={section.labelKey} className="mt-4">
              <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted">
                {t(section.labelKey)}
              </div>
              {section.items.map((item) => {
                const accessible = canAccess(item.id)
                return (
                  <button
                    key={item.id}
                    onClick={() => accessible && navigateTo(item.id)}
                    disabled={!accessible}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      !accessible
                        ? 'cursor-not-allowed text-muted/50'
                        : activePage === item.id
                          ? 'bg-accent/10 text-accent'
                          : 'text-foreground hover:bg-hover'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {t(item.labelKey)}
                      {item.id === 'notifications' && accessible && (notificationCount ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                          <Bell size={10} />
                          {notificationCount}
                        </span>
                      )}
                    </span>
                    {!accessible && <Lock size={14} className="text-muted/50" />}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="border-t border-border px-3 py-2 pb-4">
          {activeConnection?.id === 'local-broadcaster' && (
            <button
              onClick={() => navigateTo('configuration')}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                activePage === 'configuration'
                  ? 'bg-accent/10 text-accent'
                  : 'text-foreground hover:bg-hover'
              }`}
            >
              <Wrench size={14} />
              {t('configuration')}
            </button>
          )}
          <button
            onClick={() => navigateTo('docs')}
            className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
              activePage === 'docs'
                ? 'bg-accent/10 text-accent'
                : 'text-foreground hover:bg-hover'
            }`}
          >
            <BookOpen size={14} />
            {t('docs')}
          </button>
          <button
            onClick={() => navigateTo('connections')}
            className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
              activePage === 'connections'
                ? 'bg-accent/10 text-accent'
                : 'text-foreground hover:bg-hover'
            }`}
          >
            <Server size={14} />
            {t('connections')}
          </button>
        </div>
      </aside>
      )}

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <div className={`relative flex shrink-0 items-center justify-between pr-3 ${isDocsPage ? 'h-[64px] pt-2' : 'h-[54px] -mb-[22px] pt-2'}`} style={isMac ? { WebkitAppRegion: 'drag' } as React.CSSProperties : undefined}>
          {isDocsPage ? (
            <button
              onClick={() => navigate(-1)}
              className="ml-[26px] mt-[16px] flex items-center gap-1.5 text-base text-muted transition-colors hover:text-foreground"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              <ChevronLeft size={16} />
              {t('back')}
            </button>
          ) : <div />}
          {isDocsPage && (
            <button
              onClick={() => window.open(docsUrl(i18n.language), '_blank')}
              className="absolute left-1/2 -translate-x-1/2 mt-[-6px] flex items-center gap-2 rounded-md border border-border px-3.5 py-1.5 text-sm text-muted transition-colors hover:bg-hover hover:text-foreground"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              <ExternalLink size={14} />
              {t('openInBrowser')}{browserName ? ` (${browserName})` : ''}
            </button>
          )}
          <div className={`${isDocsPage ? 'mt-[-14px]' : '-mt-1'} flex items-center gap-0.5`} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <img src={headsLogo} alt="Heads" className="mr-[8px] h-5 cursor-pointer opacity-50 hover:opacity-70 dark:invert dark:opacity-40 dark:hover:opacity-60" onClick={() => window.open('https://www.heads.com', '_blank')} />
            <LanguageToggle />
            <ThemeToggle className="relative top-px" />
          </div>
        </div>

        <ConnectionDropBanner />

        <div className={`min-h-0 flex-1 overflow-y-auto ${isDocsPage ? '' : 'pt-1'}`}>
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/overview" element={<Navigate to="/" replace />} />
            <Route path="/receivers" element={<ReceiversPage />} />
            <Route path="/dashboards" element={<Navigate to="/dashboards/updates" replace />} />
            <Route path="/dashboards/updates" element={<DashboardUpdatesPage />} />
            <Route path="/dashboards/software" element={<DashboardSoftwarePage />} />
            <Route path="/dashboards/replication" element={<DashboardReplicationPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/deploy" element={<DeployPage />} />
            <Route path="/ism" element={<ISMPage />} />
            <Route path="/install-token" element={<InstallTokenPage />} />
            <Route path="/deployment" element={<DeploymentPage />} />
            <Route path="/replication" element={<ReplicationPage />} />
            <Route path="/terminals" element={<TerminalsPage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/configuration" element={<ConfigurationPage />} />
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/docs" element={<DocumentationPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>

      <ReAuthDialog />
    </div>
  )
}
