interface FilterOption<T extends string> {
  value: T
  label: string
}

interface FilterBarProps<T extends string> {
  options: FilterOption<T>[]
  value: T
  onChange: (value: T) => void
  label?: string
  children?: React.ReactNode
}

export function FilterBar<T extends string>({
  options,
  value,
  onChange,
  label = 'Filter',
  children
}: FilterBarProps<T>): React.ReactNode {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted">{label}:</span>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            value === option.value
              ? 'bg-accent/20 text-accent'
              : 'text-muted hover:text-foreground'
          }`}
        >
          {option.label}
        </button>
      ))}
      {children}
    </div>
  )
}
