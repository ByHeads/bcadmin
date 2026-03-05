import { useTranslation } from 'react-i18next'

export const COLLATION_OPTIONS = ['sv-SE', 'en-GB', 'nb-NO'] as const

const INVALID_LABEL_CHARS = /[.<>:"/\\|?*]/

/** Returns a translation key from the 'common' namespace (e.g. 'validation.labelRequired'), or null if valid. */
export function validateLabel(label: string): string | null {
  if (!label) return 'validation.labelRequired'
  if (label.includes('.')) return 'validation.labelNoDots'
  if (INVALID_LABEL_CHARS.test(label)) return 'validation.labelInvalidChars'
  return null
}

export function Toggle({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}): React.ReactNode {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border bg-surface text-accent focus:ring-accent focus:ring-offset-0"
      />
      <span className="text-sm text-foreground">{label}</span>
    </label>
  )
}

export function PosServerFields({
  createDump,
  setCreateDump,
  collation,
  setCollation,
  databaseImageSize,
  setDatabaseImageSize,
  databaseLogSize,
  setDatabaseLogSize
}: {
  createDump: boolean
  setCreateDump: (v: boolean) => void
  collation: string
  setCollation: (v: string) => void
  databaseImageSize: number
  setDatabaseImageSize: (v: number) => void
  databaseLogSize: number
  setDatabaseLogSize: (v: number) => void
}): React.ReactNode {
  const { t } = useTranslation('deploy')
  return (
    <div className="space-y-4 rounded-md border border-border p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">
        {t('shared.posServerOptions')}
      </div>

      <Toggle label={t('shared.createDump')} checked={createDump} onChange={setCreateDump} />

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">{t('shared.collation')}</label>
        <select
          value={collation}
          onChange={(e) => setCollation(e.target.value)}
          className="appearance-none rounded-md border border-border bg-surface py-1.5 pl-3 pr-8 text-sm text-foreground transition-colors hover:border-accent focus:border-accent focus:outline-none"
        >
          {COLLATION_OPTIONS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-muted">{t('shared.dbImageSize')}</label>
          <input
            type="number"
            value={databaseImageSize}
            onChange={(e) => setDatabaseImageSize(parseInt(e.target.value) || 0)}
            min={0}
            className="w-full rounded-md border border-border bg-surface py-1.5 px-3 text-sm text-foreground transition-colors focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-muted">{t('shared.dbLogSize')}</label>
          <input
            type="number"
            value={databaseLogSize}
            onChange={(e) => setDatabaseLogSize(parseInt(e.target.value) || 0)}
            min={0}
            className="w-full rounded-md border border-border bg-surface py-1.5 px-3 text-sm text-foreground transition-colors focus:border-accent focus:outline-none"
          />
        </div>
      </div>
    </div>
  )
}

export function WpfClientFields({
  usePosServer,
  setUsePosServer,
  useArchiveServer,
  setUseArchiveServer,
  isManualClient,
  setIsManualClient,
  manualBroadcasterUrl,
  setManualBroadcasterUrl,
  manualInstallToken,
  setManualInstallToken,
  manualLabel,
  setManualLabel,
  labelError
}: {
  usePosServer: boolean
  setUsePosServer: (v: boolean) => void
  useArchiveServer: boolean
  setUseArchiveServer: (v: boolean) => void
  isManualClient: boolean
  setIsManualClient: (v: boolean) => void
  manualBroadcasterUrl: string
  setManualBroadcasterUrl: (v: string) => void
  manualInstallToken: string
  setManualInstallToken: (v: string) => void
  manualLabel: string
  setManualLabel: (v: string) => void
  labelError: string | null
}): React.ReactNode {
  const { t } = useTranslation(['deploy', 'common'])
  return (
    <div className="space-y-4 rounded-md border border-border p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">
        {t('shared.wpfClientOptions')}
      </div>

      <Toggle label={t('shared.usePosServer')} checked={usePosServer} onChange={setUsePosServer} />
      <Toggle label={t('shared.useArchiveServer')} checked={useArchiveServer} onChange={setUseArchiveServer} />

      <div className="border-t border-border pt-4">
        <Toggle label={t('shared.manualClient')} checked={isManualClient} onChange={setIsManualClient} />
      </div>

      {isManualClient && (
        <div className="space-y-3 pl-4 border-l-2 border-accent/20">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">{t('shared.targetBroadcasterUrl')}</label>
            <input
              type="text"
              value={manualBroadcasterUrl}
              onChange={(e) => setManualBroadcasterUrl(e.target.value)}
              placeholder="https://broadcaster.example.com/api"
              className="w-full rounded-md border border-border bg-surface py-1.5 px-3 text-sm text-foreground placeholder:text-muted/50 transition-colors focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">{t('shared.installToken')}</label>
            <input
              type="password"
              value={manualInstallToken}
              onChange={(e) => setManualInstallToken(e.target.value)}
              className="w-full rounded-md border border-border bg-surface py-1.5 px-3 text-sm text-foreground transition-colors focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">{t('shared.label')}</label>
            <input
              type="text"
              value={manualLabel}
              onChange={(e) => setManualLabel(e.target.value)}
              placeholder={t('uninstall.labelPlaceholder')}
              className={`w-full rounded-md border bg-surface py-1.5 px-3 text-sm text-foreground placeholder:text-muted/50 transition-colors focus:outline-none ${
                labelError ? 'border-error focus:border-error' : 'border-border focus:border-accent'
              }`}
            />
            {labelError && (
              <div className="mt-1 text-xs text-error">{t(labelError, { ns: 'common' })}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
