import { useState, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Search, CheckSquare, Square, ListChecks, Table2 } from 'lucide-react'
import { WorkstationPickerDialog } from './WorkstationPickerDialog'

interface TargetSelectorProps {
  workstations: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  disabled?: boolean
}

const SEPARATOR = /[\s,;]+/

export function TargetSelector({
  workstations,
  selected,
  onChange,
  disabled = false
}: TargetSelectorProps): React.ReactNode {
  const { t } = useTranslation('deploy')
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const isAllSelected = selected.length === workstations.length && workstations.length > 0

  // Bulk mode: the input holds a comma/whitespace separated list of workstation IDs
  const bulk = useMemo(() => {
    const tokens = Array.from(new Set(search.split(SEPARATOR).filter(Boolean)))
    if (tokens.length < 2) return null
    const byLower = new Map(workstations.map((ws) => [ws.toLowerCase(), ws]))
    const matched: string[] = []
    const unmatched: string[] = []
    for (const token of tokens) {
      const ws = byLower.get(token.toLowerCase())
      if (ws) matched.push(ws)
      else unmatched.push(token)
    }
    return { tokens, matched, unmatched }
  }, [search, workstations])

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

  function applyBulk(): void {
    if (!bulk || bulk.matched.length === 0) return
    const union = new Set([...selected, ...bulk.matched])
    onChange(Array.from(union))
    setSearch('')
    setIsOpen(false)
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>): void {
    const text = e.clipboardData.getData('text')
    const tokens = text.split(SEPARATOR).filter(Boolean)
    if (tokens.length > 1) {
      // Normalize multi-line/multi-token pastes so newlines are not lost by the input
      e.preventDefault()
      setSearch(tokens.join(', '))
      setIsOpen(true)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' && bulk) {
      e.preventDefault()
      applyBulk()
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

      {/* Search input + expand button */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            placeholder={t('target.search')}
            disabled={disabled}
            className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted/50 transition-colors focus:border-accent focus:outline-none disabled:opacity-50"
          />
        </div>
        <button
          onClick={() => setPickerOpen(true)}
          disabled={disabled}
          title={t('target.expand')}
          className="rounded-md border border-border p-2 text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          <Table2 size={16} />
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-surface shadow-lg">
          {bulk ? (
            /* Bulk list mode */
            <div className="p-2">
              <button
                onClick={applyBulk}
                disabled={bulk.matched.length === 0}
                className="flex w-full items-center gap-2 rounded-md bg-accent/10 px-3 py-2 text-left text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ListChecks size={14} />
                {t('target.bulkSelect', { matched: bulk.matched.length, total: bulk.tokens.length })}
              </button>
              {bulk.unmatched.length > 0 && (
                <div className="mt-2 px-1 text-xs text-warning">
                  {t('target.bulkNotFound', {
                    count: bulk.unmatched.length,
                    ids: bulk.unmatched.slice(0, 10).join(', ') + (bulk.unmatched.length > 10 ? ', …' : '')
                  })}
                </div>
              )}
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}

      <WorkstationPickerDialog
        open={pickerOpen}
        initialSelected={selected}
        onApply={(next) => {
          onChange(next)
          setPickerOpen(false)
        }}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  )
}
