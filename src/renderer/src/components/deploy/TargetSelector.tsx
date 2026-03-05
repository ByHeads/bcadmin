import { useState, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Search, CheckSquare, Square } from 'lucide-react'

interface TargetSelectorProps {
  workstations: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  disabled?: boolean
}

export function TargetSelector({
  workstations,
  selected,
  onChange,
  disabled = false
}: TargetSelectorProps): React.ReactNode {
  const { t } = useTranslation('deploy')
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const isAllSelected = selected.length === workstations.length && workstations.length > 0

  const filtered = useMemo(() => {
    if (!search) return workstations
    const lower = search.toLowerCase()
    return workstations.filter((ws) => ws.toLowerCase().includes(lower))
  }, [workstations, search])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function toggleWorkstation(ws: string): void {
    if (selected.includes(ws)) {
      onChange(selected.filter((s) => s !== ws))
    } else {
      onChange([...selected, ws])
    }
  }

  function toggleAll(): void {
    if (isAllSelected) {
      onChange([])
    } else {
      onChange([...workstations])
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-xs font-medium text-muted">
        {t('target.label')}
        {selected.length > 0 && (
          <span className="ml-1 text-foreground">
            ({isAllSelected ? t('target.all') : t('target.selected', { count: selected.length })})
          </span>
        )}
      </label>

      {/* Selected tags */}
      {selected.length > 0 && selected.length <= 8 && !isAllSelected && (
        <div className="mb-2 flex flex-wrap gap-1">
          {selected.map((ws) => (
            <span
              key={ws}
              className="inline-flex items-center gap-1 rounded bg-accent/15 px-2 py-0.5 text-xs font-mono text-accent"
            >
              {ws}
              {!disabled && (
                <button
                  onClick={() => toggleWorkstation(ws)}
                  className="text-accent/60 hover:text-accent"
                >
                  <X size={10} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={t('target.search')}
          disabled={disabled}
          className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted/50 transition-colors focus:border-accent focus:outline-none disabled:opacity-50"
        />
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-surface shadow-lg">
          {/* Select all */}
          <button
            onClick={toggleAll}
            className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-xs font-medium text-muted hover:bg-hover"
          >
            {isAllSelected ? <CheckSquare size={14} className="text-accent" /> : <Square size={14} />}
            {t('target.selectAll', { count: workstations.length })}
          </button>

          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted">
              {t('target.noMatch', { query: search })}
            </div>
          ) : (
            filtered.map((ws) => {
              const isSelected = selected.includes(ws)
              return (
                <button
                  key={ws}
                  onClick={() => toggleWorkstation(ws)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm font-mono transition-colors hover:bg-hover ${
                    isSelected ? 'text-accent' : 'text-foreground'
                  }`}
                >
                  {isSelected ? <CheckSquare size={14} className="text-accent" /> : <Square size={14} className="text-muted" />}
                  {ws}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
