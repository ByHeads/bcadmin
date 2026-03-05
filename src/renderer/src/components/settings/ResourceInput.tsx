import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import bcResources from '@/assets/bc-resources.json'

const ALL_NAMES = [
  ...bcResources.wildcards,
  ...bcResources.resources.map((r) => r.name),
  '*',
]

/** Find the best matching completion for a partial input */
function findCompletion(input: string): string | null {
  if (!input) return null
  const lower = input.toLowerCase()
  return ALL_NAMES.find((n) => n.toLowerCase().startsWith(lower) && n.toLowerCase() !== lower) ?? null
}

/** Single resource input with ghost-text autocomplete */
function ResourceLine({ value, onChange, onRemove, onSubmit, inputRefCb }: {
  value: string
  onChange: (v: string) => void
  onRemove?: () => void
  onSubmit?: () => void
  inputRefCb?: (el: HTMLInputElement | null) => void
}): React.ReactNode {
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const completion = focused ? findCompletion(value) : null

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Tab' && completion) {
      e.preventDefault()
      onChange(completion)
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      onSubmit?.()
    }
    if (e.key === 'Backspace' && value === '' && onRemove) {
      e.preventDefault()
      onRemove()
    }
  }

  return (
    <div className="group/line flex items-center gap-1">
      <div className="relative flex-1">
        <input
          ref={(el) => { inputRef.current = el; inputRefCb?.(el) }}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs text-foreground focus:border-accent focus:outline-none"
          placeholder="Broadcaster.*"
          spellCheck={false}
        />
        {/* Ghost text completion */}
        {completion && value && (
          <div className="pointer-events-none absolute inset-0 flex items-center px-2 font-mono text-xs">
            <span className="invisible">{value}</span>
            <span className="text-muted/40">{completion.slice(value.length)}</span>
          </div>
        )}
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          type="button"
          className="shrink-0 rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-error group-hover/line:opacity-100"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}

/** Multi-line resource list with autocomplete — one resource per line */
export function ResourceListInput({ values, onChange }: {
  values: string[]
  onChange: (values: string[]) => void
}): React.ReactNode {
  const { t } = useTranslation('settings')
  const [focusIdx, setFocusIdx] = useState<number | null>(null)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (focusIdx !== null && refs.current[focusIdx]) {
      refs.current[focusIdx]?.focus()
      setFocusIdx(null)
    }
  }, [focusIdx, values.length])

  const updateAt = useCallback((idx: number, val: string) => {
    const next = [...values]
    next[idx] = val
    onChange(next)
  }, [values, onChange])

  const removeAt = useCallback((idx: number) => {
    onChange(values.filter((_, i) => i !== idx))
    // Focus the previous line, or the first if removing the first
    setFocusIdx(Math.max(0, idx - 1))
  }, [values, onChange])

  const addLine = useCallback(() => {
    onChange([...values, ''])
    setFocusIdx(values.length)
  }, [values, onChange])

  return (
    <div className="space-y-1">
      {values.map((v, i) => (
        <ResourceLine
          key={i}
          value={v}
          onChange={(val) => updateAt(i, val)}
          onRemove={values.length > 1 ? () => removeAt(i) : undefined}
          onSubmit={addLine}
          inputRefCb={(el) => { refs.current[i] = el }}
        />
      ))}
      <button
        onClick={addLine}
        type="button"
        className="flex items-center gap-1 rounded px-1 py-0.5 text-[11px] text-accent hover:text-accent/80"
      >
        <Plus size={11} />
        {t('appSettings.addResources')}
      </button>
    </div>
  )
}

/** Method selector — checkboxes grouped into Read/Write */
export function MethodSelector({ values, onChange }: {
  values: string[]
  onChange: (values: string[]) => void
}): React.ReactNode {
  const { t } = useTranslation('settings')
  const readMethods = ['GET']
  const writeMethods = ['POST', 'PATCH', 'PUT', 'DELETE']

  // Expand wildcard to all methods for display
  const expanded = values.length === 1 && values[0] === '*'
    ? [...readMethods, ...writeMethods]
    : values

  const toggleMethod = (method: string): void => {
    if (expanded.includes(method)) {
      const next = expanded.filter((m) => m !== method)
      onChange(next.length === 0 ? ['GET'] : next)
    } else {
      onChange([...expanded, method])
    }
  }

  const MethodCheckbox = ({ method }: { method: string }): React.ReactNode => (
    <label className="flex cursor-pointer items-center gap-1.5 text-xs">
      <input
        type="checkbox"
        checked={expanded.includes(method)}
        onChange={() => toggleMethod(method)}
        className="h-3 w-3 rounded border-border accent-accent"
      />
      <span className="font-mono text-muted">{method}</span>
    </label>
  )

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="w-10 text-[10px] font-medium text-muted">{t('appSettings.readMethods')}</span>
        <div className="flex flex-wrap items-center gap-x-3">
          {readMethods.map((m) => <MethodCheckbox key={m} method={m} />)}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-10 text-[10px] font-medium text-muted">{t('appSettings.writeMethods')}</span>
        <div className="flex flex-wrap items-center gap-x-3">
          {writeMethods.map((m) => <MethodCheckbox key={m} method={m} />)}
        </div>
      </div>
    </div>
  )
}
