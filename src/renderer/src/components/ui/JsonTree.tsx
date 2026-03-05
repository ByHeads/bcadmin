import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'

const SECRET_PATTERNS = /password|secret|token|key|credential/i

interface JsonTreeProps {
  data: unknown
  maskSecrets?: boolean
}

export function JsonTree({ data, maskSecrets = false }: JsonTreeProps): React.ReactNode {
  if (data === null || data === undefined) {
    return <span className="font-mono text-xs text-muted">null</span>
  }

  if (typeof data !== 'object') {
    return <span className="font-mono text-xs text-foreground">{String(data)}</span>
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="font-mono text-xs text-muted">[]</span>
    return (
      <div className="space-y-0.5">
        {data.map((item, i) => (
          <TreeNode key={i} label={`[${i}]`} value={item} maskSecrets={maskSecrets} />
        ))}
      </div>
    )
  }

  const entries = Object.entries(data)
  if (entries.length === 0) return <span className="font-mono text-xs text-muted">{'{}'}</span>

  return (
    <div className="space-y-0.5">
      {entries.map(([key, value]) => (
        <TreeNode key={key} label={key} value={value} maskSecrets={maskSecrets} />
      ))}
    </div>
  )
}

function TreeNode({
  label,
  value,
  maskSecrets
}: {
  label: string
  value: unknown
  maskSecrets: boolean
}): React.ReactNode {
  const [expanded, setExpanded] = useState(false)
  const masked = maskSecrets ? maskValue(label, value) : value
  const isExpandable = masked !== null && typeof masked === 'object'
  const isEmpty =
    isExpandable &&
    (Array.isArray(masked) ? masked.length === 0 : Object.keys(masked as object).length === 0)

  return (
    <div>
      <button
        onClick={() => isExpandable && !isEmpty && setExpanded(!expanded)}
        className={`flex items-center gap-1 py-0.5 text-left ${
          isExpandable && !isEmpty ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        {isExpandable && !isEmpty ? (
          expanded ? (
            <ChevronDown size={12} className="shrink-0 text-muted" />
          ) : (
            <ChevronRight size={12} className="shrink-0 text-muted" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="font-mono text-xs font-medium text-accent">{label}</span>
        {!isExpandable && (
          <>
            <span className="font-mono text-xs text-muted">:</span>
            <span className={`font-mono text-xs ${valueColor(masked)}`}>{formatValue(masked)}</span>
          </>
        )}
        {isExpandable && isEmpty && (
          <>
            <span className="font-mono text-xs text-muted">:</span>
            <span className="font-mono text-xs text-muted">
              {Array.isArray(masked) ? '[]' : '{}'}
            </span>
          </>
        )}
        {isExpandable && !isEmpty && !expanded && (
          <span className="font-mono text-xs text-muted">
            {Array.isArray(masked)
              ? `[${masked.length}]`
              : `{${Object.keys(masked as object).length}}`}
          </span>
        )}
      </button>
      {expanded && isExpandable && (
        <div className="ml-4 border-l border-border/50 pl-2">
          <JsonTree data={masked} maskSecrets={maskSecrets} />
        </div>
      )}
    </div>
  )
}

function maskValue(key: string, value: unknown): unknown {
  if (typeof value === 'string' && SECRET_PATTERNS.test(key) && value.length > 0) {
    return '••••••••'
  }
  return value
}

function valueColor(value: unknown): string {
  if (value === null || value === undefined) return 'text-muted'
  if (typeof value === 'boolean') return value ? 'text-success' : 'text-error'
  if (typeof value === 'number') return 'text-warning'
  return 'text-foreground'
}

function formatValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string')
    return value.length > 80 ? `"${value.slice(0, 80)}..."` : `"${value}"`
  return String(value)
}
