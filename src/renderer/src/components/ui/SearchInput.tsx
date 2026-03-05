import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  debounceMs?: number
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  debounceMs = 400
}: SearchInputProps): React.ReactNode {
  const [local, setLocal] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    setLocal(value)
  }, [value])

  function handleChange(next: string): void {
    setLocal(next)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onChange(next), debounceMs)
  }

  function handleClear(): void {
    setLocal('')
    clearTimeout(timerRef.current)
    onChange('')
  }

  useEffect(() => {
    return () => clearTimeout(timerRef.current)
  }, [])

  return (
    <div className="relative">
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="text"
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-48 rounded-md border border-border bg-background pl-8 pr-7 text-xs text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
      />
      {local && (
        <button
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}
