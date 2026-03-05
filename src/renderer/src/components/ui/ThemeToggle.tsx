import { Sun, Moon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '@/stores/theme'

export function ThemeToggle({ className, disabled }: { className?: string; disabled?: boolean }): JSX.Element {
  const { theme, toggle } = useThemeStore()
  const { t } = useTranslation('common')
  return (
    <button
      onClick={toggle}
      disabled={disabled}
      className={`rounded-md p-1.5 text-muted transition-colors hover:text-foreground disabled:opacity-30 disabled:pointer-events-none select-none ${className ?? ''}`}

    >
      {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  )
}
