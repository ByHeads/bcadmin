import { useTranslation } from 'react-i18next'
import { AppSettingsTab } from '@/components/settings'

export function ConfigurationPage(): React.ReactNode {
  const { t } = useTranslation('nav')

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="px-6">
        <h1 className="text-xl font-bold text-foreground">{t('configuration')}</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        <AppSettingsTab />
      </div>
    </div>
  )
}
