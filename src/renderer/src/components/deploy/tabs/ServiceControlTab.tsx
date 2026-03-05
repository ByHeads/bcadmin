import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Info } from 'lucide-react'
import { useConnectionStore } from '@/stores/connection'
import { useWorkstationIds } from '@/hooks/useWorkstationIds'
import {
  TargetSelector,
  OperationProgress,
  ConfirmDialog,
  parseExecutedScriptResponse,
  DEFAULT_OPERATION_TIMEOUT,
  type WorkstationResult,
  type ExecutedScriptResult
} from '@/components/deploy'

const SERVICE_PRODUCTS = ['Receiver', 'WpfClient', 'PosServer', 'CustomerServiceApplication'] as const
type ServiceProduct = (typeof SERVICE_PRODUCTS)[number]

type ServiceCommand = 'Start' | 'Stop' | 'Restart'
const SERVICE_COMMANDS: ServiceCommand[] = ['Start', 'Stop', 'Restart']

// Product-command restrictions from spec
const ALLOWED_COMMANDS: Record<ServiceProduct, Set<ServiceCommand>> = {
  Receiver: new Set(['Restart']),
  WpfClient: new Set(['Stop']),
  PosServer: new Set(['Start', 'Stop', 'Restart']),
  CustomerServiceApplication: new Set(['Start', 'Stop', 'Restart'])
}

export function ServiceControlTab(): React.ReactNode {
  const { t } = useTranslation(['deploy', 'common'])
  const { client } = useConnectionStore()

  const [product, setProduct] = useState<ServiceProduct>('PosServer')
  const [command, setCommand] = useState<ServiceCommand>('Restart')
  const [selectedWorkstations, setSelectedWorkstations] = useState<string[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [results, setResults] = useState<WorkstationResult[]>([])

  // Fetch workstations
  const { data: workstations = [] } = useWorkstationIds()

  const allowed = ALLOWED_COMMANDS[product]

  // When product changes, reset command to first allowed command
  function handleProductChange(p: ServiceProduct): void {
    setProduct(p)
    setResults([])
    const nextAllowed = ALLOWED_COMMANDS[p]
    if (!nextAllowed.has(command)) {
      setCommand([...nextAllowed][0]!)
    }
  }

  const controlMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('No client')
      const body = {
        Workstations: selectedWorkstations,
        Command: command.toLowerCase(),
        Product: product
      }
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_OPERATION_TIMEOUT)
      try {
        const response = await client.post<ExecutedScriptResult>(
          'Broadcaster.RemoteDeployment.RemoteControl',
          body,
          undefined,
          controller.signal
        )
        return parseExecutedScriptResponse(response)
      } finally {
        clearTimeout(timeoutId)
      }
    },
    onSuccess: (data) => {
      setResults(data)
      setShowConfirm(false)
    },
    onError: () => {
      setShowConfirm(false)
    }
  })

  const canSubmit = selectedWorkstations.length > 0 && allowed.has(command)

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* Target workstations */}
      <TargetSelector
        workstations={workstations}
        selected={selectedWorkstations}
        onChange={setSelectedWorkstations}
        disabled={controlMutation.isPending}
      />

      {/* Command selector */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">{t('serviceControl.command')}</label>
        <div className="flex gap-2">
          {SERVICE_COMMANDS.map((cmd) => (
            <button
              key={cmd}
              onClick={() => setCommand(cmd)}
              disabled={!allowed.has(cmd)}
              className={`rounded-md px-4 pt-[5px] pb-[7px] text-sm font-medium transition-colors ${
                command === cmd && allowed.has(cmd)
                  ? 'bg-accent text-white'
                  : allowed.has(cmd)
                    ? 'border border-border bg-surface text-foreground hover:border-accent'
                    : 'border border-border bg-surface text-muted/40 cursor-not-allowed'
              }`}
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>

      {/* Product selector */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">{t('label.product', { ns: 'common' })}</label>
        <select
          value={product}
          onChange={(e) => handleProductChange(e.target.value as ServiceProduct)}
          className="appearance-none rounded-md border border-border bg-surface py-1.5 pl-3 pr-8 text-sm text-foreground transition-colors hover:border-accent focus:border-accent focus:outline-none"
        >
          {SERVICE_PRODUCTS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Restriction info */}
      {product === 'Receiver' && (
        <div className="flex items-start gap-2 rounded-md bg-accent/10 p-3 text-xs text-accent">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>{t('serviceControl.receiverInfo')}</span>
        </div>
      )}
      {product === 'WpfClient' && (
        <div className="flex items-start gap-2 rounded-md bg-accent/10 p-3 text-xs text-accent">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>{t('serviceControl.wpfInfo')}</span>
        </div>
      )}

      {/* Execute button */}
      <button
        onClick={() => { setResults([]); setShowConfirm(true) }}
        disabled={!canSubmit || controlMutation.isPending}
        className="rounded-md bg-accent px-4 pt-[7px] pb-[9px] text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {command}
      </button>

      {/* Results */}
      <OperationProgress
        results={results}
        isExecuting={controlMutation.isPending}
        error={controlMutation.error?.message ?? null}
      />

      {/* Confirmation dialog */}
      <ConfirmDialog
        open={showConfirm}
        title={t('serviceControl.confirmTitle', { command, product })}
        message={t('serviceControl.confirmMessage', { command, product, count: selectedWorkstations.length })}
        confirmLabel={command}
        confirmVariant={command === 'Stop' ? 'danger' : 'primary'}
        isLoading={controlMutation.isPending}
        onConfirm={() => controlMutation.mutate()}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}
