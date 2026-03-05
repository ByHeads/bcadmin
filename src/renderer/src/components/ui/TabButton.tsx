import React from 'react'

export function TabButton({
  label,
  active,
  onClick,
  disabled
}: {
  label: string
  active: boolean
  onClick?: () => void
  disabled?: boolean
}): React.ReactNode {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`whitespace-nowrap border-b-2 pb-2 text-sm font-medium transition-colors ${
        disabled
          ? 'cursor-not-allowed border-transparent text-muted/50'
          : active
            ? 'border-accent text-accent'
            : 'border-transparent text-muted hover:text-foreground'
      }`}
    >
      {label}
    </button>
  )
}
