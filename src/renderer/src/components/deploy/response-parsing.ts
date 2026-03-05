import type { ApiResponse } from '@/api/client'

export const DEFAULT_OPERATION_TIMEOUT = 3600_000 // 1 hour

export interface WorkstationResult {
  workstationId: string
  success: boolean
  errors: string[]
}

export interface ExecutedScriptResult {
  ExecutedScript: {
    ExecutedBy: string
    ExecutedSuccessfully: boolean
    Errors: string[]
  }
}

export interface ManualLaunchResult {
  Launching: boolean
  ErrorMessage: string | null
  Workstations: string[]
}

export function parseExecutedScriptResponse(
  response: ApiResponse<ExecutedScriptResult>
): WorkstationResult[] {
  if (!response.Data || !Array.isArray(response.Data)) return []

  return response.Data.map((item) => {
    const script = item.ExecutedScript
    return {
      workstationId: script.ExecutedBy,
      success: script.ExecutedSuccessfully,
      errors: script.Errors ?? []
    }
  })
}

export function parseManualLaunchResponse(
  response: ApiResponse<ManualLaunchResult>
): WorkstationResult[] {
  if (!response.Data || !Array.isArray(response.Data)) return []

  return response.Data.flatMap((item) => {
    const workstations = item.Workstations ?? []
    return workstations.map((ws) => ({
      workstationId: ws,
      success: item.Launching,
      errors: item.ErrorMessage ? [item.ErrorMessage] : []
    }))
  })
}
