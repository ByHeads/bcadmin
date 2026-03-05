import { useTranslation } from 'react-i18next'
import { InstallTokenTab } from '@/components/deploy/tabs'

export function InstallTokenPage(): React.ReactNode {
  const { t } = useTranslation('deploy')

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="px-6">
        <h1 className="text-xl font-bold text-foreground">{t('installToken.title')}</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        <InstallTokenTab />
      </div>
    </div>
  )
}
