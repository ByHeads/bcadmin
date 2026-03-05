import { useTranslation } from 'react-i18next'

export function BoolBadge({ value }: { value: boolean }): React.ReactNode {
  const { t } = useTranslation('settings')
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        value ? 'bg-success/15 text-success' : 'bg-error/15 text-error'
      }`}
    >
      {value ? t('deps.installed') : t('deps.missing')}
    </span>
  )
}
