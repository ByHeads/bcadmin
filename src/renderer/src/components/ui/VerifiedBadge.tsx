import { Monitor } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/** Simple monitor icon indicating local broadcaster */
export function VerifiedBadge({ size = 15, tooltip }: { size?: number; tooltip?: string }): React.ReactNode {
  const { t } = useTranslation('connection')
  const label = tooltip ?? t('runningOnThisComputer')

  return (
    <Monitor size={size} className="inline shrink-0 text-current" title={label} />
  )
}
