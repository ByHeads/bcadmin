import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Info, AlertTriangle, Copy, Check, Key, Loader2 } from 'lucide-react'
import { useConnectionStore, normalizeUrl } from '@/stores/connection'
import { useThemeStore } from '@/stores/theme'
import type { DependencyStatus as DependencyStatusResult } from '@/api/types'
import { Toggle, PosServerFields, validateLabel } from './shared'

function isHostedBroadcaster(url: string): boolean {
  return url.includes('heads-api.com') || url.includes('heads-app.com')
}

export function ISMTab(): React.ReactNode {
  const { t } = useTranslation(['deploy', 'common'])
  const { client, hasAccess } = useConnectionStore()
  const theme = useThemeStore((s) => s.theme)
  const currentBaseUrl = client?.baseUrl ?? ''

  // Step 1: Target BC URL
  const [targetUrlInput, setTargetUrlInput] = useState(currentBaseUrl)
  const [targetUrlConfirmed, setTargetUrlConfirmed] = useState(false)
  const [urlVerifyError, setUrlVerifyError] = useState<string | null>(null)
  const [urlVerifying, setUrlVerifying] = useState(false)

  // Step 3: Install token
  const [installToken, setInstallToken] = useState('')
  const [tokenGenerating, setTokenGenerating] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [tokenExpiration, setTokenExpiration] = useState<string | null>(null)

  // Step 4-5: Uninstall options
  const [uninstallExisting, setUninstallExisting] = useState(false)
  const [legacyUninstall, setLegacyUninstall] = useState(false)

  // Step 6: Receiver
  const [installReceiver, setInstallReceiver] = useState(true)

  // Step 7: WpfClient
  const [installWpfClient, setInstallWpfClient] = useState(false)
  const [wpfUsePosServer, setWpfUsePosServer] = useState(false)
  const [wpfUseArchiveServer, setWpfUseArchiveServer] = useState(false)
  const [wpfManualClient, setWpfManualClient] = useState(false)
  const [wpfManualLabel, setWpfManualLabel] = useState('')
  const [wpfManualVersion, setWpfManualVersion] = useState('')

  // Step 8: CSA
  const [installCSA, setInstallCSA] = useState(false)

  // Step 9: PosServer
  const [installPosServer, setInstallPosServer] = useState(false)
  const [psCreateDump, setPsCreateDump] = useState(false)
  const [psCollation, setPsCollation] = useState<string>('sv-SE')
  const [psDatabaseImageSize, setPsDatabaseImageSize] = useState(1024)
  const [psDatabaseLogSize, setPsDatabaseLogSize] = useState(1024)

  // Generated script
  const [generatedScript, setGeneratedScript] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Compute resolved target URL
  const resolvedTargetUrl = useMemo(() => {
    const input = targetUrlInput.trim()
    if (!input) return currentBaseUrl
    try {
      return normalizeUrl(input)
    } catch {
      return input
    }
  }, [targetUrlInput, currentBaseUrl])

  const isTargetCurrent = resolvedTargetUrl === currentBaseUrl
  const canCheckDeps = isTargetCurrent && hasAccess('Broadcaster.Admin.DependencyStatus', 'GET')

  // Step 2: Dependency check (only when target = current)
  const { data: depStatus, isLoading: depLoading } = useQuery({
    queryKey: ['ism-dependency-check'],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      const result = await client.get<DependencyStatusResult>(
        'Broadcaster.Admin.DependencyStatus',
        undefined,
        undefined,
        signal
      )
      return result[0] ?? null
    },
    enabled: !!client && targetUrlConfirmed && canCheckDeps
  })

  const depWarning = useMemo(() => {
    if (!depStatus) return null
    if (depStatus.CurrentPolicy === 'Local') {
      const hasDeps = depStatus.HasPowerShell || depStatus.HasVcRedistx64 || depStatus.HasVcRedistx86 || depStatus.HasBcman
      if (!hasDeps) {
        return 'This Broadcaster uses "Local" dependency source policy but has no deployed dependencies. Deploy dependencies first via Settings \u2192 Dependencies.'
      }
    }
    return null
  }, [depStatus])

  // Confirm target URL with soft verification
  const handleConfirmUrl = useCallback(async () => {
    setUrlVerifyError(null)
    setUrlVerifying(true)
    try {
      // Soft verification — try to reach the target, warn but don't block
      const testUrl = resolvedTargetUrl.replace(/\/api\/?$/, '') + '/api/AvailableResource'
      try {
        const res = await fetch(testUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
        if (!res.ok && res.status !== 401 && res.status !== 403) {
          setUrlVerifyError(`Target responded with status ${res.status} — script may not work`)
        }
      } catch {
        setUrlVerifyError('Could not reach target Broadcaster — script may not work if URL is incorrect')
      }
      setTargetUrlConfirmed(true)
    } finally {
      setUrlVerifying(false)
    }
  }, [resolvedTargetUrl])

  // Generate install token
  const handleGenerateToken = useCallback(async () => {
    if (!client) return
    setTokenGenerating(true)
    setTokenError(null)
    try {
      const result = await client.get<{ Token?: string; Value?: string; Expiration?: string; ExpiresUtc?: string }>(
        'Broadcaster.Admin.InstallToken'
      )
      if (result.length > 0) {
        const token = result[0]
        const tokenValue = token.Token ?? token.Value ?? ''
        setInstallToken(tokenValue)
        setTokenExpiration(token.Expiration ?? token.ExpiresUtc ?? null)
      }
    } catch (e) {
      setTokenError(e instanceof Error ? e.message : 'Failed to generate token')
    } finally {
      setTokenGenerating(false)
    }
  }, [client])

  // WpfClient/CSA mutual exclusivity
  const handleSetInstallWpfClient = useCallback((v: boolean) => {
    setInstallWpfClient(v)
    if (v) setInstallCSA(false)
  }, [])

  const handleSetInstallCSA = useCallback((v: boolean) => {
    setInstallCSA(v)
    if (v) {
      setInstallWpfClient(false)
      setInstallPosServer(false)
    }
  }, [])

  // Label validation for manual client
  const wpfLabelError = wpfManualClient ? validateLabel(wpfManualLabel) : null

  // Generate the PowerShell one-liner (same format as bcman ISM)
  const handleGenerate = useCallback(() => {
    const hosted = isHostedBroadcaster(resolvedTargetUrl)
    const token = installToken
    // Strip /api suffix for the base URL — the one-liner adds '/api/' back
    const outUrl = resolvedTargetUrl.replace(/\/api\/?$/, '')

    // Build URI array entries (same as bcman)
    const uris: string[] = []

    if (uninstallExisting) {
      if (legacyUninstall) {
        uris.push("'uninstall.legacy'")
      }
      uris.push("'uninstall.all'")
    }

    if (installReceiver) {
      uris.push("'install/p=Receiver'")
    }

    if (installWpfClient) {
      let part = 'p=WpfClient'
      if (wpfManualClient && wpfManualLabel) {
        const installPath = encodeURIComponent(`C:\\ProgramData\\Heads\\${wpfManualLabel}`)
        const shortcutLabel = encodeURIComponent(`Heads Retail - ${wpfManualLabel}`)
        part += `&installPath=${installPath}&shortcutLabel=${shortcutLabel}`
      }
      part += `&usePosServer=${wpfUsePosServer}`
      part += `&useArchiveServer=${wpfUseArchiveServer}`
      uris.push(`'install/${part}'`)
    }

    if (installCSA) {
      uris.push("'install/p=CustomerServiceApplication'")
    }

    if (installPosServer) {
      let part = 'p=PosServer'
      part += `&createDump=${psCreateDump}`
      part += `&collation=${psCollation}`
      part += `&databaseImageSize=${psDatabaseImageSize}`
      part += `&databaseLogSize=${psDatabaseLogSize}`
      uris.push(`'install/${part}'`)
    }

    const arr = uris.join(',')
    const ip = hosted ? "+'@'+$(irm('icanhazip.com'))" : "+'|'"

    // Exact bcman one-liner format
    const script = `${arr}|%{try{\$u='${outUrl}'+'/api/'+\$_;irm(\$u)-He:@{Authorization='Bearer'+[char]0x0020+'${token}'}|iex}catch{throw(\$u+'|OS:'+\$PSVersionTable.OS+'|'+\$(hostname)${ip}+\$_)}};`

    setGeneratedScript(script)
    setCopied(false)
  }, [resolvedTargetUrl, installToken, uninstallExisting, legacyUninstall, installReceiver, installWpfClient, wpfUsePosServer, wpfUseArchiveServer, wpfManualClient, wpfManualLabel, installCSA, installPosServer, psCreateDump, psCollation, psDatabaseImageSize, psDatabaseLogSize])

  const handleCopy = useCallback(async () => {
    if (!generatedScript) return
    await navigator.clipboard.writeText(generatedScript)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [generatedScript])

  const hasProducts = installReceiver || installWpfClient || installCSA || installPosServer
  const canGenerate = targetUrlConfirmed && installToken.trim().length > 0 && !wpfLabelError && hasProducts

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* Step 1: Target Broadcaster URL */}
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">
          {t('ism.targetUrl')}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={targetUrlInput}
            onChange={(e) => { setTargetUrlInput(e.target.value); setTargetUrlConfirmed(false); setUrlVerifyError(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmUrl() }}
            placeholder={currentBaseUrl || 'Enter target URL or press Enter for current'}
            disabled={targetUrlConfirmed}
            className="flex-1 rounded-md border border-border bg-surface py-1.5 px-3 text-sm text-foreground placeholder:text-muted/50 transition-colors focus:border-accent focus:outline-none"
          />
          {!targetUrlConfirmed ? (
            <button
              onClick={handleConfirmUrl}
              disabled={urlVerifying}
              className="flex items-center gap-1.5 rounded-md bg-accent px-3 pt-[5px] pb-[7px] text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
            >
              {urlVerifying ? <Loader2 size={14} className="animate-spin" /> : null}
              {urlVerifying ? t('state.verifying', { ns: 'common' }) : t('button.confirm', { ns: 'common' })}
            </button>
          ) : (
            <button
              onClick={() => { setTargetUrlConfirmed(false); setUrlVerifyError(null) }}
              className="rounded-md border border-border px-3 pt-[5px] pb-[7px] text-sm font-medium text-foreground transition-colors hover:bg-hover"
            >
              {t('button.change', { ns: 'common' })}
            </button>
          )}
        </div>
        {targetUrlConfirmed && (
          <div className="text-xs text-muted">
            {t('ism.target')} <span className="font-mono text-foreground">{resolvedTargetUrl}</span>
            {isTargetCurrent && ` ${t('ism.currentConnection')}`}
          </div>
        )}
        {urlVerifyError && (
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            {urlVerifyError}
          </div>
        )}
      </div>

      {/* Step 2: Dependency check */}
      {targetUrlConfirmed && canCheckDeps && (
        <div className="space-y-2">
          {depLoading && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 size={14} className="animate-spin" /> {t('ism.checkingDeps')}
            </div>
          )}
          {depWarning && (
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {depWarning}
            </div>
          )}
          {depStatus && !depWarning && (
            <div className="flex items-center gap-2 text-xs text-success">
              <Check size={14} /> {t('ism.depsOk', { policy: depStatus.CurrentPolicy })}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Install Token */}
      {targetUrlConfirmed && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t('ism.installToken')}
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={installToken}
              onChange={(e) => setInstallToken(e.target.value)}
              placeholder={t('ism.enterToken')}
              className="flex-1 rounded-md border border-border bg-surface py-1.5 px-3 text-sm text-foreground placeholder:text-muted/50 transition-colors focus:border-accent focus:outline-none"
            />
            {isTargetCurrent && (
              <button
                onClick={handleGenerateToken}
                disabled={tokenGenerating}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 pt-[5px] pb-[7px] text-sm font-medium text-foreground transition-colors hover:bg-hover disabled:opacity-50"
              >
                <Key size={14} />
                {tokenGenerating ? t('state.generating', { ns: 'common' }) : t('button.generate', { ns: 'common' })}
              </button>
            )}
          </div>
          {tokenExpiration && (
            <div className="text-xs text-muted">{t('ism.expires', { date: tokenExpiration })}</div>
          )}
          {tokenError && (
            <div className="text-xs text-error">{tokenError}</div>
          )}
        </div>
      )}

      {/* Steps 4-5: Uninstall options */}
      {targetUrlConfirmed && (
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t('ism.preInstall')}
          </div>
          <Toggle label={t('ism.uninstallExisting')} checked={uninstallExisting} onChange={setUninstallExisting} />
          {uninstallExisting && (
            <div className="pl-6">
              <Toggle label={t('ism.legacyUninstall')} checked={legacyUninstall} onChange={setLegacyUninstall} />
            </div>
          )}
        </div>
      )}

      {/* Step 6: Software to install */}
      {targetUrlConfirmed && (
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t('ism.software')}
          </div>
          <Toggle label={t('ism.installReceiver')} checked={installReceiver} onChange={setInstallReceiver} />
        </div>
      )}

      {/* Step 7: WpfClient */}
      {targetUrlConfirmed && (
        <div className="space-y-3">
          <Toggle label={t('ism.installWpf')} checked={installWpfClient} onChange={handleSetInstallWpfClient} />
          {installWpfClient && (
            <div className="space-y-3 pl-6 border-l-2 border-accent/20">
              <Toggle label={t('ism.usePosServer')} checked={wpfUsePosServer} onChange={setWpfUsePosServer} />
              <Toggle label={t('ism.useArchiveServer')} checked={wpfUseArchiveServer} onChange={setWpfUseArchiveServer} />
              <Toggle label={t('ism.manualClient')} checked={wpfManualClient} onChange={setWpfManualClient} />
              {wpfManualClient && (
                <div className="space-y-3 pl-4 border-l-2 border-accent/10">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">{t('ism.label')}</label>
                    <input
                      type="text"
                      value={wpfManualLabel}
                      onChange={(e) => setWpfManualLabel(e.target.value)}
                      placeholder={t('uninstall.labelPlaceholder')}
                      className={`w-full rounded-md border bg-surface py-1.5 px-3 text-sm text-foreground placeholder:text-muted/50 transition-colors focus:outline-none ${
                        wpfLabelError ? 'border-error focus:border-error' : 'border-border focus:border-accent'
                      }`}
                    />
                    {wpfLabelError && (
                      <div className="mt-1 text-xs text-error">{t(wpfLabelError, { ns: 'common' })}</div>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">{t('ism.versionOptional')}</label>
                    <input
                      type="text"
                      value={wpfManualVersion}
                      onChange={(e) => setWpfManualVersion(e.target.value)}
                      placeholder={t('ism.versionPlaceholder')}
                      className="w-full rounded-md border border-border bg-surface py-1.5 px-3 text-sm text-foreground placeholder:text-muted/50 transition-colors focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 8: CSA (only if WpfClient not selected) */}
      {targetUrlConfirmed && !installWpfClient && (
        <div>
          <Toggle label={t('ism.installCsa')} checked={installCSA} onChange={handleSetInstallCSA} />
        </div>
      )}

      {/* Step 9: PosServer (only if CSA not selected) */}
      {targetUrlConfirmed && !installCSA && (
        <div className="space-y-3">
          <Toggle label={t('ism.installPosServer')} checked={installPosServer} onChange={setInstallPosServer} />
          {installPosServer && (
            <div className="pl-6 border-l-2 border-accent/20">
              <PosServerFields
                createDump={psCreateDump}
                setCreateDump={setPsCreateDump}
                collation={psCollation}
                setCollation={setPsCollation}
                databaseImageSize={psDatabaseImageSize}
                setDatabaseImageSize={setPsDatabaseImageSize}
                databaseLogSize={psDatabaseLogSize}
                setDatabaseLogSize={setPsDatabaseLogSize}
              />
            </div>
          )}
        </div>
      )}

      {/* Step 10: Generate */}
      {targetUrlConfirmed && (
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="rounded-md bg-accent px-4 pt-[7px] pb-[9px] text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('ism.generateScript')}
          </button>
          <button
            onClick={() => {
              setTargetUrlConfirmed(false)
              setUrlVerifyError(null)
              setInstallToken('')
              setTokenExpiration(null)
              setTokenError(null)
              setGeneratedScript(null)
              setUninstallExisting(false)
              setLegacyUninstall(false)
              setInstallReceiver(true)
              setInstallWpfClient(false)
              setInstallCSA(false)
              setInstallPosServer(false)
            }}
            className="rounded-md border border-border px-4 pt-[7px] pb-[9px] text-sm font-medium text-muted transition-colors hover:text-foreground hover:bg-hover"
          >
            {t('button.cancel', { ns: 'common' })}
          </button>
        </div>
      )}

      {/* Generated script output */}
      {generatedScript && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t('ism.oneLiner')}
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-hover"
            >
              {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              {copied ? t('button.copied', { ns: 'common' }) : t('button.copy', { ns: 'common' })}
            </button>
          </div>
          {isHostedBroadcaster(resolvedTargetUrl) && (
            <div className="flex items-start gap-2 rounded-md border border-info/30 bg-info/10 p-3 text-xs text-info">
              <Info size={14} className="mt-0.5 shrink-0" />
              {t('ism.hostedInfo')}
            </div>
          )}
          <div className={`max-h-[400px] overflow-auto rounded-lg border px-4 py-3 font-mono text-sm leading-relaxed whitespace-pre-wrap break-all ${
            theme === 'dark'
              ? 'border-[#222] bg-[#0d0d0d] text-[#d4d4d4]'
              : 'border-border bg-[#f5f7fa] text-foreground'
          }`}>
            {generatedScript}
          </div>
        </div>
      )}
    </div>
  )
}
