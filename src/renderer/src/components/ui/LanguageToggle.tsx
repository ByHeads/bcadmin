import { useTranslation } from 'react-i18next'

function SwedenFlag({ size = 22 }: { size?: number }): JSX.Element {
  const h = Math.round(size * 0.7)
  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 22 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0.5" y="0.5" width="21" height="14" rx="3" fill="#1A6BC4" stroke="#1A6BC4" strokeWidth="0.5" />
      <rect x="7" y="0" width="2.5" height="15" rx="0.3" fill="#FCD34D" />
      <rect x="0" y="6" width="22" height="2.5" rx="0.3" fill="#FCD34D" />
      <rect x="0.5" y="0.5" width="21" height="14" rx="3" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="0.5" />
    </svg>
  )
}

function UKFlag({ size = 22 }: { size?: number }): JSX.Element {
  const h = Math.round(size * 0.7)
  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 22 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id="uk-clip">
          <rect width="22" height="15" rx="3" />
        </clipPath>
      </defs>
      <g clipPath="url(#uk-clip)">
        <rect width="22" height="15" fill="#2D3A8C" />
        {/* Diagonal white stripes */}
        <path d="M0,0 L22,15" stroke="#fff" strokeWidth="3" />
        <path d="M22,0 L0,15" stroke="#fff" strokeWidth="3" />
        {/* Diagonal red stripes */}
        <path d="M0,0 L22,15" stroke="#E8403A" strokeWidth="1" />
        <path d="M22,0 L0,15" stroke="#E8403A" strokeWidth="1" />
        {/* White cross */}
        <rect x="9" y="0" width="4" height="15" fill="#fff" />
        <rect x="0" y="5.5" width="22" height="4" fill="#fff" />
        {/* Red cross */}
        <rect x="9.75" y="0" width="2.5" height="15" rx="0.3" fill="#E8403A" />
        <rect x="0" y="6.25" width="22" height="2.5" rx="0.3" fill="#E8403A" />
      </g>
      <rect x="0.5" y="0.5" width="21" height="14" rx="3" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="0.5" />
    </svg>
  )
}

export function LanguageToggle({ className }: { className?: string }): JSX.Element {
  const { i18n } = useTranslation()

  const toggle = (): void => {
    const next = i18n.language === 'en' ? 'sv' : 'en'
    i18n.changeLanguage(next)
    localStorage.setItem('bcadmin-lang', next)
  }

  const isSv = i18n.language === 'sv'

  return (
    <button
      onClick={toggle}
      className={`rounded-md p-1.5 translate-y-px opacity-70 transition-all hover:opacity-100 hover:scale-110 active:scale-95 ${className ?? ''}`}

    >
      {isSv ? <UKFlag /> : <SwedenFlag />}
    </button>
  )
}
