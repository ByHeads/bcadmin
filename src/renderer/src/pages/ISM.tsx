import { useTranslation } from 'react-i18next'
import { ISMTab } from '@/components/deploy/tabs'

export function ISMPage(): React.ReactNode {
  const { t } = useTranslation('deploy')

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="px-6">
        <h1 className="text-xl font-bold text-foreground">{t('tab.ism')}</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ISMTab />
      </div>
    </div>
  )
}
