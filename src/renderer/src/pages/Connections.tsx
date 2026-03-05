import { useTranslation } from 'react-i18next'
import { ConnectionsTab } from '@/components/settings'

export function ConnectionsPage(): React.ReactNode {
  const { t } = useTranslation('connection')

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="px-6">
        <h1 className="text-xl font-bold text-foreground">{t('section.connections')}</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ConnectionsTab />
      </div>
    </div>
  )
}
