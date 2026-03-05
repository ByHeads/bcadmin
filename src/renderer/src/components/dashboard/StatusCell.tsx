export type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'muted'

const variantClasses: Record<StatusVariant, string> = {
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  error: 'bg-error/15 text-error',
  info: 'bg-accent/15 text-accent',
  muted: 'bg-hover text-muted'
}

interface StatusCellProps {
  label: string
  variant: StatusVariant
}

export function StatusCell({ label, variant }: StatusCellProps): React.ReactNode {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]}`}
    >
      {label}
    </span>
  )
}
