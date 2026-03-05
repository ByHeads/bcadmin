export function FilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }): React.ReactNode {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-accent/20 text-accent'
          : 'text-muted hover:text-foreground'
      }`}
    >
      {label}
    </button>
  )
}

export function ReportCard({ label, value }: { label: string; value: number }): React.ReactNode {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
    </div>
  )
}

export function formatDuration(lastActive: string): string {
  const now = Date.now()
  const active = new Date(lastActive).getTime()
  const diffMs = now - active
  if (isNaN(diffMs) || diffMs < 0) return '—'

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours < 24) return `${hours}h ${remainingMinutes}m`
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return `${days}d ${remainingHours}h`
}
