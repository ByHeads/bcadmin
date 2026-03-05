import { Check, X } from 'lucide-react'
import type { Modules, ModuleInfo } from '@/api/types'

export type ReceiverKind = 'POS' | 'CSA' | 'BO' | '--'
export type PosFilter = 'all' | 'pos'

export function classifyKind(modules: Modules): ReceiverKind {
  if (modules?.PosServer?.IsInstalled) return 'POS'
  if (modules?.CustomerServiceApplication?.IsInstalled) return 'CSA'
  if (modules?.WpfClient?.IsInstalled) return 'BO'
  return '--'
}

export function getModuleVersion(modules: Modules, product: string): string {
  const mod = modules?.[product] as ModuleInfo | undefined
  return mod?.CurrentVersion ?? mod?.Version ?? '—'
}

export function getModuleInfo(modules: Modules, productKey: string): { version: string; running: RunningStatus } {
  const mod = modules?.[productKey] as ModuleInfo | undefined
  if (!mod || !mod.IsInstalled) return { version: '—', running: 'not-installed' }
  const version = mod.CurrentVersion ?? mod.Version ?? '—'
  const running = mod.IsRunning ? 'running' : 'stopped'
  return { version, running }
}

export type RunningStatus = 'running' | 'stopped' | 'not-installed'

export function BooleanCell({ value }: { value: boolean | undefined }): React.ReactNode {
  if (value === undefined) return <span className="text-muted">—</span>
  return value
    ? <Check size={14} className="inline text-success" />
    : <X size={14} className="inline text-error" />
}
