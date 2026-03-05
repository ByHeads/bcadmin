import { useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  detail?: string
  confirmLabel?: string
  confirmVariant?: 'danger' | 'primary'
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  detail,
  confirmLabel,
  confirmVariant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps): React.ReactNode {
  const { t } = useTranslation('common')

  const resolvedConfirmLabel = confirmLabel ?? t('button.confirm')

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open || isLoading) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        onConfirm()
      }
    },
    [open, isLoading, onCancel, onConfirm]
  )

  useEffect(() => {
    if (!open) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  if (!open) return null

  const confirmClass =
    confirmVariant === 'danger'
      ? 'bg-error text-white hover:bg-error/90'
      : 'bg-accent text-white hover:bg-accent/90'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted">{message}</p>
        {detail && (
          <p className="mt-1 text-xs font-mono text-muted/70">{detail}</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-border px-4 pt-[7px] pb-[9px] text-sm text-muted transition-colors hover:text-foreground"
            disabled={isLoading}
          >
            {t('button.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-md px-4 pt-[7px] pb-[9px] text-sm font-medium transition-colors ${confirmClass}`}
            disabled={isLoading}
          >
            {isLoading ? t('state.executing') : resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
