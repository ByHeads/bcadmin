import { useState, useEffect, useCallback, useRef } from 'react'
import {
  AlertTriangle, Plus, ChevronRight, CornerDownLeft, Loader2,
  MoreHorizontal, ArrowUp, ArrowDown, Trash2, LayoutGrid, List, Search, X, Pencil
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useConnectionStore, normalizeUrl, testConnectionReachable, type ConnectionError } from '@/stores/connection'
import { useThemeStore } from '@/stores/theme'
import headsLogo from '@/assets/heads.svg'
import { SignalBackground } from './SignalBackground'
import { Snowfall } from './Snowfall'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'
import type { SavedConnection } from '@shared/types'

const isMac = window.api.platform === 'darwin'

/** Extract a display name from a broadcaster URL */
function inferNameFromUrl(raw: string): string | null {
  try {
    const url = normalizeUrl(raw)
    const hostname = new URL(url).hostname
    // broadcaster.<name>[-test].heads-api.com → capitalized name
    const match = hostname.match(/^broadcaster\.([^.]+)\.heads-api\.com$/i)
    if (match) {
      return match[1]
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    }
    // Fall back to hostname with first letter capitalized
    const label = hostname.split('.')[0]
    if (label && label !== 'localhost') {
      return label.charAt(0).toUpperCase() + label.slice(1)
    }
    return null
  } catch {
    return null
  }
}

/** Add protocol prefix to a raw URL string */
function autoCompleteUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed
  if (/:\d+/.test(trimmed)) return `http://${trimmed}`
  return `https://${trimmed}`
}

const LOCAL_BROADCASTER_ID = 'local-broadcaster'

/** Continuously monitor for a local Broadcaster process and sync as a saved connection */
function useAutoSetupLocalBroadcaster(
  connections: SavedConnection[],
  addConnection: (connection: SavedConnection, apiKey: string) => Promise<void>,
  removeConnection: (id: string) => Promise<void>,
  loadConnections: () => Promise<void>
): string | null {
  const connectionsRef = useRef(connections)
  connectionsRef.current = connections
  const [localAppDir, setLocalAppDir] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function poll(): Promise<void> {
      if (!active) return
      try {
        const result = await window.api.detectLocalBroadcaster()
        if (!active) return
        const conns = connectionsRef.current
        const existing = conns.find((c) => c.id === LOCAL_BROADCASTER_ID)

        if (result) {
          const { url, apiKey, appDir, hostName } = result
          setLocalAppDir(appDir)
          if (existing) {
            await window.api.setCredential(LOCAL_BROADCASTER_ID, apiKey)
            const needsUpdate = existing.url !== url || existing.name !== hostName
            if (needsUpdate) {
              await window.api.saveConnection({ ...existing, url, name: hostName })
              await loadConnections()
            }
          } else {
            const connection: SavedConnection = {
              id: LOCAL_BROADCASTER_ID,
              name: hostName,
              url,
              lastConnected: null,
              color: null
            }
            await addConnection(connection, apiKey)
          }
        } else if (existing) {
          // Broadcaster stopped — remove the local connection
          await removeConnection(LOCAL_BROADCASTER_ID)
          setLocalAppDir(null)
        }
      } catch (err) {
        console.error('[bcadmin] Local broadcaster detection failed:', err)
      }
    }

    poll()
    const interval = setInterval(poll, 5000)
    return () => { active = false; clearInterval(interval) }
  }, [addConnection, removeConnection, loadConnections])

  return localAppDir
}

/** Highlight matching substring with a subtle mark */
function HighlightMatch({ text, query }: { text: string; query: string }): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-accent/20 text-inherit">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

/** Shows truncated path/URL with tooltip (2s hover delay) only when text is actually truncated */
function TruncatedSubtitle({ text, query }: { text: string; query: string }): React.ReactNode {
  const ref = useRef<HTMLDivElement>(null)
  const [isTruncated, setIsTruncated] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const el = ref.current
    if (el) setIsTruncated(el.scrollWidth > el.clientWidth)
  }, [text])

  const onEnter = (): void => {
    if (!isTruncated) return
    timerRef.current = setTimeout(() => setShowTooltip(true), 2000)
  }
  const onLeave = (): void => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setShowTooltip(false)
  }

  return (
    <div ref={ref} className="group/sub relative mt-0.5 truncate font-mono text-xs text-muted" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <HighlightMatch text={text} query={query} />
      {showTooltip && (
        <div className="absolute bottom-full left-0 z-50 mb-1 max-w-[400px] break-all rounded-md bg-foreground px-2.5 py-1 text-[10px] text-background shadow-lg">
          {text}
        </div>
      )}
    </div>
  )
}


/** Lottie-animated Santa's sleigh for Christmas season */
function SantaSleigh({ mirrored, isDark }: { mirrored?: boolean; isDark?: boolean }): React.ReactNode {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    let anim: ReturnType<typeof import('lottie-web').default.loadAnimation> | null = null
    Promise.all([
      import('lottie-web'),
      import('@/assets/santa-sleigh.json'),
    ]).then(([lottie, animationData]) => {
      if (!containerRef.current) return
      const data = { ...animationData.default, op: 28 }
      anim = lottie.default.loadAnimation({
        container: containerRef.current,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: data,
      })
    })
    return () => { anim?.destroy() }
  }, [])

  return (
    <div style={{ position: 'relative', display: 'inline-block', transform: mirrored ? 'scaleX(-1) rotate(19deg)' : 'rotate(18deg)' }}>
      <div
        ref={containerRef}
        style={{
          width: 304,
          height: 228,
          opacity: isDark ? 0.25 : 0.12,
          filter: isDark ? 'invert(1) brightness(2)' : undefined,
        }}
      />
    </div>
  )
}

function PlaneWithBanner({ id, lightColor, isDark, bannerText, mirrored, pitch = 0 }: { id: string; lightColor: 'green' | 'red'; isDark: boolean; bannerText: string; mirrored?: boolean; pitch?: number }): React.ReactNode {
  const bannerFrames = [
    'M8,7 Q50,4 95,7 Q140,10 185,7 Q240,4 263,7 L263,35 Q240,32 185,35 Q140,38 95,35 Q50,32 8,35 L2,30.3 L8,25.7 L2,21 L8,16.3 L2,11.7 Z',
    'M8,4 Q50,7 95,10 Q140,7 185,4 Q240,7 263,7 L263,35 Q240,35 185,32 Q140,35 95,38 Q50,35 8,32 L2,27.3 L8,22.7 L2,18 L8,13.3 L2,8.7 Z',
    'M8,7 Q50,10 95,7 Q140,4 185,7 Q240,10 263,7 L263,35 Q240,38 185,35 Q140,32 95,35 Q50,38 8,35 L2,30.3 L8,25.7 L2,21 L8,16.3 L2,11.7 Z',
    'M8,10 Q50,7 95,4 Q140,7 185,10 Q240,7 263,7 L263,35 Q240,35 185,38 Q140,35 95,32 Q50,35 8,38 L2,33.3 L8,28.7 L2,24 L8,19.3 L2,14.7 Z',
  ]
  const textFrames = [
    'M15,24 Q55,21 100,24 Q145,27 190,24 Q248,21 258,24',
    'M15,21 Q55,24 100,27 Q145,24 190,21 Q248,24 258,24',
    'M15,24 Q55,27 100,24 Q145,21 190,24 Q248,27 258,24',
    'M15,27 Q55,24 100,21 Q145,24 190,27 Q248,24 258,24',
  ]
  // Mirrored text paths: x-coords mirrored (450-x), point order reversed so text flows left-to-right
  const mirroredTextFrames = [
    'M192,24 Q202,21 260,24 Q305,27 350,24 Q395,21 435,24',
    'M192,24 Q202,24 260,21 Q305,24 350,27 Q395,24 435,21',
    'M192,24 Q202,27 260,24 Q305,21 350,24 Q395,27 435,24',
    'M192,24 Q202,24 260,27 Q305,24 350,21 Q395,24 435,27',
  ]
  const bannerValues = [...bannerFrames, bannerFrames[0]].join(';\n')
  const activeTextFrames = mirrored ? mirroredTextFrames : textFrames
  const textValues = [...activeTextFrames, activeTextFrames[0]].join(';\n')
  const navLight = lightColor === 'green' ? '#22c55e' : '#ef4444'

  // Compute rotated rope endpoint — the plane end (363, 17) orbits around pivot (380, 67)
  const rad = (pitch * Math.PI) / 180
  const rpx = 363 - 380, rpy = 17 - 67
  const ropeEndX = 380 + rpx * Math.cos(rad) - rpy * Math.sin(rad)
  const ropeEndY = 67 + rpx * Math.sin(rad) + rpy * Math.cos(rad)
  // Y-junction: rope from plane to a fork point, then two lines to banner corners
  const forkX = 283, forkY = 21
  const ropeMidX = (forkX + ropeEndX) / 2
  const ropeMidY = (forkY + ropeEndY) / 2 - pitch * 0.6

  const hasBanner = bannerText.length > 0

  // Visual elements: banner, rope, plane, lights — mirrored via SVG transform when needed
  const visuals = (
    <>
      {/* Banner + rope — only shown when there's banner text */}
      {hasBanner && (
        <>
          <g transform={`rotate(${pitch * 0.25}, 263, 21)`} opacity="0.55">
            <path fill={isDark ? '#a09878' : '#c8a840'} fillOpacity="0.22" stroke={isDark ? '#a09878' : '#c8a840'} strokeWidth="0.7" strokeOpacity="0.6">
              <animate attributeName="d" dur="2.5s" repeatCount="indefinite" values={bannerValues} />
            </path>
          </g>
          <path d={`M${forkX},${forkY} Q${ropeMidX},${ropeMidY} ${ropeEndX},${ropeEndY}`} stroke="currentColor" className="text-foreground" strokeWidth="0.7" opacity="0.25" fill="none" />
          <line x1={forkX} y1={forkY} x2={263} y2={7} stroke="currentColor" className="text-foreground" strokeWidth="0.7" opacity="0.25" />
          <line x1={forkX} y1={forkY} x2={263} y2={35} stroke="currentColor" className="text-foreground" strokeWidth="0.7" opacity="0.25" />
        </>
      )}
      {/* Plane — rotated around a point below for arc-style banking */}
      <g transform={`rotate(${pitch}, 380, 67)`}>
          <g transform="translate(360, 3)" opacity={isDark ? 0.6 : 0.75}>
              <path d="M7 10 L3 2 L12 8" fill="#dc2626" />
              <path d="M5 10 L3 3 L7 10" fill="#b91c1c" />
              <ellipse cx="6" cy="16" rx="5" ry="1.8" fill="#ef4444" />
              <path d="M3 11 Q4 8 10 8 L30 8 Q35 8 35 14 Q35 20 30 20 L10 20 Q4 20 3 17 Z" fill="#dc2626" />
              <path d="M10 8 L30 8 Q33 8 33 10.5 L10 10.5 Q6 10.5 10 8" fill="#f97316" />
              <rect x="14" y="3" width="16" height="3.5" rx="1.8" fill="#ef4444" />
              <line x1="22" y1="6.5" x2="22" y2="8" stroke="#b91c1c" strokeWidth="0.8" />
              <path d="M26 8.5 Q30 8.5 31 11 L31 14 Q31 19 27 19.5 L26 19.5" fill="#60a5fa" opacity="0.6" />
              <path d="M26 8.5 Q30 8.5 31 11 L31 14 Q31 19 27 19.5" fill="none" stroke="#1e40af" strokeWidth="0.4" opacity="0.3" />
              <ellipse cx="36" cy="14" rx="3.5" ry="5.5" fill="#9ca3af" />
              <ellipse cx="37" cy="14" rx="2.5" ry="4.5" fill="#6b7280" />
              <ellipse cx="40" cy="14" rx="1" ry="9" fill="#94a3b8" opacity="0.1" />
              <line x1="40" y1="4" x2="40" y2="24" stroke="#4b5563" strokeWidth="2" strokeLinecap="round" opacity="0.4">
                <animateTransform attributeName="transform" type="rotate" from="0 40 14" to="360 40 14" dur="0.08s" repeatCount="indefinite" />
              </line>
              <circle cx="39" cy="14" r="2" fill="#4b5563" />
              <circle cx="39" cy="14" r="1" fill="#374151" />
              <line x1="24" y1="20" x2="24" y2="24" stroke="#4b5563" strokeWidth="1.2" />
              <circle cx="24" cy="25.5" r="2.5" fill="#4b5563" stroke="#374151" strokeWidth="0.5" />
              <circle cx="24" cy="25.5" r="1" fill="#6b7280" />
            </g>
            {isDark && (
              <>
                <defs>
                  <filter id={`glow-nav-${id}`}>
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <circle cx={360 + 5} cy={3 + 3} r="2.5" fill="white">
                  <animate attributeName="opacity" values="0.5;0.9;0.5" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx={360 + 22} cy={3 + 3} r="2.2" fill={navLight} filter={`url(#glow-nav-${id})`}>
                  <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" begin="1s" repeatCount="indefinite" />
                </circle>
                <circle cx={360 + 22} cy={3 + 3} r="1" fill="white">
                  <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" begin="1s" repeatCount="indefinite" />
                </circle>
                <circle cx={360 + 18} cy={3 + 9} r="1.5" fill="white">
                  <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.85;0.9;0.95;1" dur="1.5s" repeatCount="indefinite" />
                </circle>
              </>
            )}
      </g>
    </>
  )

  return (
    <svg width="450" height="42" viewBox="0 0 450 42" fill="none" className="shrink-0" style={{ overflow: 'visible' }}>
      {/* Visual elements — mirrored via SVG transform for return trip */}
      {mirrored ? <g transform="translate(450,0) scale(-1,1)">{visuals}</g> : visuals}
      {/* Text on computed path — only when banner is active */}
      {hasBanner && (
        <>
          <defs>
            <path id={`banner-curve-${id}`}>
              <animate attributeName="d" dur="2.5s" repeatCount="indefinite" values={textValues} />
            </path>
          </defs>
          <g transform={`rotate(${mirrored ? -pitch * 0.25 : pitch * 0.25}, ${mirrored ? 450 - 263 : 263}, 21)`}>
            <text className="text-foreground" fill="currentColor" fontSize="12" fontWeight="600" letterSpacing="0.5" opacity="0.45">
              <textPath href={`#banner-curve-${id}`} startOffset="50%" textAnchor="middle">
                {bannerText}
              </textPath>
            </text>
          </g>
        </>
      )}
    </svg>
  )
}

interface Flare {
  id: number
  x: number
  y: number
  dx: number
  dy: number
  angle: number
  color: string
}

let flareId = 0

/** Seasonal date checks — override with BCADMIN_SEASON env var (0=default, 1=christmas) */
function useSeasonal(): { isChristmas: boolean; showBanner: boolean } {
  const override = window.api.seasonOverride
  if (override === '1') return { isChristmas: true, showBanner: false }
  if (override === '0') return { isChristmas: false, showBanner: true }
  const now = new Date()
  const month = now.getMonth() // 0-indexed
  const day = now.getDate()
  const isChristmas = month === 11 && day >= 1 && day <= 25
  // Show the launch banner until August 1 2026
  const showBanner = now < new Date(2026, 7, 1) // month 7 = August
  return { isChristmas, showBanner }
}

function FlyingAirplane(): React.ReactNode {
  const isDark = useThemeStore((s) => s.theme) === 'dark'
  const { t } = useTranslation('connection')
  const { isChristmas, showBanner } = useSeasonal()
  const bannerTexts = t('bannerTexts', { returnObjects: true }) as string[]
  const [randomBannerIdx, setRandomBannerIdx] = useState(() => Math.floor(Math.random() * 5))
  const bannerText = isChristmas
    ? ''
    : showBanner
      ? t('bannerText')
      : Array.isArray(bannerTexts) ? bannerTexts[randomBannerIdx % bannerTexts.length] : ''
  const [flares, setFlares] = useState<Flare[]>([])
  const [fwdOffset, setFwdOffset] = useState(() => Math.round(Math.random() * 50 - 25))
  const [revOffset, setRevOffset] = useState(() => Math.round(Math.random() * 50 - 25))
  const fwdRef = useRef<HTMLDivElement>(null)
  const revRef = useRef<HTMLDivElement>(null)
  const [winH, setWinH] = useState(() => window.innerHeight)
  const [fwdPitch, setFwdPitch] = useState(0)
  const [revPitch, setRevPitch] = useState(0)
  const prevFwdTopRef = useRef<number | null>(null)
  const prevRevTopRef = useRef<number | null>(null)
  const fwdTargetRef = useRef(0)
  const revTargetRef = useRef(0)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const handler = (): void => setWinH(window.innerHeight)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Compute vertical positions — planes steer toward center on short windows
  const svgH = 42
  const centerY = winH / 2
  const fwdBaseTop = winH * (isChristmas ? 0.12 : 0.22) + 20 + fwdOffset
  const revBaseTop = winH - (winH * (isChristmas ? 0.10 : 0.18) - revOffset) - svgH
  // Blend toward center as window gets shorter (full blend at 400px, none at 800px+)
  const blend = 1 - Math.max(0, Math.min(1, (winH - 400) / 400))
  const fwdTop = fwdBaseTop + (centerY - svgH / 2 - fwdBaseTop) * blend * 0.5 - (isChristmas ? 15 : 0)
  const revTop = revBaseTop + (centerY - svgH / 2 - revBaseTop) * blend * 0.5 - (isChristmas ? 160 : 0)

  // Smooth pitch: set target from velocity, lerp actual pitch toward target (or 0 when idle)
  const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))
  useEffect(() => {
    if (prevFwdTopRef.current !== null) {
      const fwdDelta = fwdTop - prevFwdTopRef.current
      const revDelta = revTop - prevRevTopRef.current!
      fwdTargetRef.current = clamp(fwdDelta * 2.5, -30, 30)
      revTargetRef.current = clamp(revDelta * 2.5, -30, 30)
    }
    prevFwdTopRef.current = fwdTop
    prevRevTopRef.current = revTop
  }, [fwdTop, revTop])

  // Animation loop: smoothly lerp pitch toward target, decay target toward 0
  useEffect(() => {
    const lerp = 0.12 // how fast pitch follows the target
    const decay = 0.95 // how fast the target decays toward 0
    const tick = (): void => {
      fwdTargetRef.current *= decay
      revTargetRef.current *= decay
      setFwdPitch((p) => {
        const next = p + (fwdTargetRef.current - p) * lerp
        return Math.abs(next) < 0.2 ? 0 : next
      })
      setRevPitch((p) => {
        const next = p + (revTargetRef.current - p) * lerp
        return Math.abs(next) < 0.2 ? 0 : next
      })
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  const fireFlare = useCallback((x: number, y: number) => {
    const angle = Math.random() * Math.PI * 2
    const distance = 80 + Math.random() * 120
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899']
    const color = colors[Math.floor(Math.random() * colors.length)]
    const dx = Math.cos(angle) * distance
    const dy = Math.sin(angle) * distance + 50
    const flare: Flare = {
      id: ++flareId,
      x, y, dx, dy, angle,
      color,
      }
    setFlares((prev) => [...prev, flare])
    setTimeout(() => setFlares((prev) => prev.filter((f) => f.id !== flare.id)), 2000)
  }, [])

  // Use document-level click listener to detect clicks near the plane
  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      // Plane body spans x=360..400 in the 450px SVG, y=3..30
      // For mirrored: plane is at x=50..90 (mirrored from 360..400 in 450px SVG)
      for (const [ref, planeX] of [[fwdRef, 360], [revRef, 50]] as const) {
        const el = ref.current
        if (!el) continue
        const rect = el.getBoundingClientRect()
        const px = rect.left + planeX
        const py = rect.top + 15
        const dx = e.clientX - px
        const dy = e.clientY - py
        if (Math.abs(dx) < 40 && Math.abs(dy) < 25) {
          fireFlare(e.clientX, e.clientY)
          return
        }
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [fireFlare])

  return (
    <>
      {/* Left to right — above the connections panel */}
      <div
        className="pointer-events-none absolute inset-x-0 z-[5] overflow-hidden"
        style={{ top: `${fwdTop}px`, transition: 'top 0.6s ease-out' }}
      >
        <div
          ref={fwdRef}
          className="flex items-center whitespace-nowrap"
          style={{ animation: `fly-right ${isChristmas ? '45s' : '90s'} linear infinite` }}
          onAnimationIteration={() => { setFwdOffset(Math.round(Math.random() * 50 - 25)); setRandomBannerIdx((i) => i + 1) }}
        >
          {isChristmas ? <SantaSleigh isDark={isDark} /> : <PlaneWithBanner id="fwd" lightColor="green" isDark={isDark} bannerText={bannerText} pitch={fwdPitch} />}
        </div>
      </div>
      {/* Right to left — below the connections panel */}
      <div
        className="pointer-events-none absolute inset-x-0 z-[5] overflow-hidden"
        style={{ top: `${revTop}px`, transition: 'top 0.6s ease-out' }}
      >
        <div
          ref={revRef}
          className="flex items-center whitespace-nowrap"
          style={{ animation: `fly-left ${isChristmas ? '45s' : '90s'} linear infinite`, animationDelay: `${isChristmas ? '22.5s' : '45s'}`, animationFillMode: 'backwards' }}
          onAnimationIteration={() => setRevOffset(Math.round(Math.random() * 50 - 25))}
        >
          {isChristmas ? <SantaSleigh mirrored isDark={isDark} /> : <PlaneWithBanner id="rev" lightColor="red" isDark={isDark} bannerText={bannerText} mirrored pitch={revPitch} />}
        </div>
      </div>
      {/* Flares */}
      {flares.map((f) => (
        <div
          key={f.id}
          className="pointer-events-none fixed z-50"
          style={{
            left: f.x,
            top: f.y,
            '--f0x': '0px',
            '--f0y': '0px',
            '--f1x': `${f.dx}px`,
            '--f1y': `${f.dy}px`,
            animation: 'flare-shoot 1.8s ease-out forwards',
          } as React.CSSProperties}
        >
          {/* Tail */}
          <div
            className="absolute"
            style={{
              width: 4,
              height: 16,
              left: 0,
              top: -6,
              background: `linear-gradient(to bottom, transparent, ${f.color}, transparent)`,
              transform: `rotate(${f.angle * (180 / Math.PI) + 90}deg)`,
              filter: 'blur(1.5px)',
              opacity: 0.6,
            }}
          />
          {/* Head */}
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: `radial-gradient(circle, white 30%, ${f.color} 65%, transparent)`,
              boxShadow: `0 0 6px 3px white, 0 0 14px 6px ${f.color}, 0 0 28px 10px ${f.color}60`,
            }}
          />
        </div>
      ))}
    </>
  )
}

const AUTO_DISMISS_SECONDS = 20

/** Modal dialog shown when connecting to a saved connection fails */
function ConnectionErrorDialog({ error, onDismiss, onEdit }: { error: ConnectionError; onDismiss: () => void; onEdit?: () => void }): React.ReactNode {
  const { t } = useTranslation(['connection', 'common'])
  const [remaining, setRemaining] = useState(AUTO_DISMISS_SECONDS)

  // Countdown + auto-dismiss
  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { onDismiss(); return 0 }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [onDismiss])

  // Dismiss on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onDismiss])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onDismiss}>
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-error" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{t('connectError.title')}</h2>
            <p className="mt-1.5 text-sm text-muted [&_b]:font-semibold [&_b]:text-foreground"
              dangerouslySetInnerHTML={{ __html: t(`connectError.${error.code}`, { name: error.connectionName, interpolation: { escapeValue: true } }) }}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="rounded-md bg-accent px-4 pt-[7px] pb-[9px] text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
            >
              {t('button.editConnection')}
            </button>
          )}
          <button
            onClick={onDismiss}
            className="rounded-md border border-border px-4 pt-[7px] pb-[9px] text-sm text-muted transition-colors hover:text-foreground"
          >
            {t('button.ok', { ns: 'common' })} <span className="inline-block w-[3ch] text-left tabular-nums">({remaining})</span>
          </button>
        </div>
      </div>
    </div>
  )
}

type ViewMode = 'large' | 'small'

export function ConnectionScreen(): React.ReactNode {
  const { t } = useTranslation(['connection', 'common'])
  const { connections, status, error, clearError, connect, addConnection, removeConnection, reorderConnections, loadConnections } =
    useConnectionStore()
  const theme = useThemeStore((s) => s.theme)
  const { isChristmas } = useSeasonal()
  const [showForm, setShowForm] = useState(false)
  const [editingConnection, setEditingConnection] = useState<SavedConnection | null>(null)
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<SavedConnection | null>(null)
  const [encryptionAvailable, setEncryptionAvailable] = useState<boolean | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [connectingId, setConnectingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    connections.length >= 5 ? 'small' : 'large'
  )
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const borderRef = useRef<HTMLDivElement>(null)

  const localAppDir = useAutoSetupLocalBroadcaster(connections, addConnection, removeConnection, loadConnections)

  useEffect(() => {
    window.api.isEncryptionAvailable().then(setEncryptionAvailable)
  }, [])

  // Clear connecting indicator when status changes (but keep it while error modal is showing)
  useEffect(() => {
    if (status !== 'connecting' && status !== 'error') setConnectingId(null)
  }, [status])

  // Rotate the panel's gradient border
  useEffect(() => {
    let angle = 0
    let frame: number
    function tick(): void {
      angle = (angle + 0.15) % 360
      borderRef.current?.style.setProperty('--border-angle', `${angle}deg`)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  // Auto-switch to small when connections grow past threshold
  useEffect(() => {
    if (connections.length >= 5 && viewMode === 'large') {
      setViewMode('small')
    }
  }, [connections.length, viewMode])

  const onUrlBlur = (): void => {
    if (url.trim()) {
      const completed = autoCompleteUrl(url)
      if (completed !== url) setUrl(completed)
      if (!nameManuallyEdited) {
        const inferred = inferNameFromUrl(completed)
        if (inferred) setName(inferred)
      }
    }
    setSubmitted(false)
  }

  const handleRemovalKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!pendingRemoval) return
      if (e.key === 'Escape') {
        e.preventDefault()
        setPendingRemoval(null)
      }
    },
    [pendingRemoval]
  )

  useEffect(() => {
    if (!pendingRemoval) return
    window.addEventListener('keydown', handleRemovalKeyDown)
    return () => window.removeEventListener('keydown', handleRemovalKeyDown)
  }, [pendingRemoval, handleRemovalKeyDown])

  const openEditForm = (conn: SavedConnection): void => {
    setEditingConnection(conn)
    setUrl(conn.url.replace(/\/api\/?$/, ''))
    setName(conn.name)
    setNameManuallyEdited(true)
    setApiKey('')
    setFormError(null)
    setSubmitted(false)
    setShowForm(true)
  }

  const closeForm = (): void => {
    setShowForm(false)
    setEditingConnection(null)
    setUrl('')
    setName('')
    setNameManuallyEdited(false)
    setApiKey('')
    setFormError(null)
    setSubmitted(false)
  }

  const handleFormSubmit = async (): Promise<void> => {
    const trimmedUrl = url.trim()
    const trimmedName = name.trim()
    const trimmedKey = apiKey.trim()
    const isEditing = editingConnection !== null
    setSubmitted(true)
    if (!trimmedUrl || !trimmedName || (!isEditing && !trimmedKey)) {
      return
    }
    let normalizedUrl: string
    try {
      normalizedUrl = normalizeUrl(trimmedUrl)
    } catch {
      setFormError(t('testFailedNetwork'))
      return
    }

    // Determine if we need to test the connection
    const urlChanged = isEditing ? normalizedUrl !== editingConnection.url : true
    const keyChanged = trimmedKey.length > 0
    const needsTest = urlChanged || keyChanged || !isEditing

    if (needsTest) {
      // For edit without new key but with URL change, we need the stored key
      let testKey = trimmedKey
      if (isEditing && !keyChanged) {
        const storedKey = await window.api.getCredential(editingConnection.id)
        if (!storedKey) {
          setFormError(t('testFailedAuth'))
          return
        }
        testKey = storedKey
      }
      setTesting(true)
      setFormError(null)
      try {
        await testConnectionReachable(normalizedUrl, testKey)
      } catch (e) {
        const msg = e instanceof Error ? e.message : ''
        if (msg === 'auth') setFormError(t('testFailedAuth'))
        else if (msg === 'server') setFormError(t('testFailedServer'))
        else setFormError(t('testFailedNetwork'))
        setTesting(false)
        return
      }
      setTesting(false)
    }

    setSaving(true)
    setFormError(null)
    try {
      if (isEditing) {
        const updated: SavedConnection = {
          ...editingConnection,
          name: trimmedName,
          url: normalizedUrl
        }
        await window.api.saveConnection(updated)
        if (keyChanged) {
          await window.api.setCredential(editingConnection.id, trimmedKey)
        }
        await loadConnections()
        closeForm()
      } else {
        const connection: SavedConnection = {
          id: crypto.randomUUID(),
          name: trimmedName,
          url: normalizedUrl,
          lastConnected: null,
          color: null
        }
        await addConnection(connection, trimmedKey)
        closeForm()
        await connect(connection)
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t('testFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id: string): Promise<void> => {
    try {
      await removeConnection(id)
    } catch (e) {
      console.error('Failed to remove connection:', e)
    } finally {
      setPendingRemoval(null)
    }
  }

  const handleMove = async (index: number, direction: 'up' | 'down'): Promise<void> => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= connections.length) return
    const ids = connections.map((c) => c.id)
    ;[ids[index], ids[newIndex]] = [ids[newIndex], ids[index]]
    await reorderConnections(ids)
  }

  const isDisabled = status === 'connecting' || status === 'error' || saving || testing

  const filteredConnections = search.trim()
    ? connections.filter((c) => {
        const q = search.toLowerCase()
        return c.name.toLowerCase().includes(q) || c.url.toLowerCase().includes(q)
      })
    : connections

  const handleSearchKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && filteredConnections.length === 1 && !isDisabled) {
      e.preventDefault()
      const conn = filteredConnections[0]
      setConnectingId(conn.id)
      connect(conn)
    }
    if (e.key === 'Escape') {
      setSearch('')
      setSearchOpen(false)
    }
  }

  const hasConnections = connections.length > 0

  // Open search when user starts typing anywhere on the page
  useEffect(() => {
    if (!hasConnections || showForm) return
    const handler = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key.length !== 1) return
      setSearchOpen(true)
      setSearch(e.key)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [hasConnections, showForm])

  const isDark = theme === 'dark'
  const glassInner = isDark
    ? 'bg-white/10 backdrop-blur-md'
    : 'bg-white/35 backdrop-blur-md'
  const glassInput = 'bg-transparent'
  const glassBorder = isDark ? 'border-white/15' : 'border-black/15'
  const glassDivider = isDark ? 'border-white/15' : 'border-black/10'
  const glassHover = isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'

  return (
    <div className="relative flex h-screen select-none flex-col [&_input]:select-text [&_textarea]:select-text" style={{ backgroundColor: isDark ? undefined : isChristmas ? '#e8ecf0' : '#f5f7f9' }}>
      {/* Drag region + theme toggle */}
      {isMac && (
        <div
          className="absolute inset-x-0 top-0 z-20 h-[38px]"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        />
      )}
      <div
        className="absolute z-30 h-8 w-32 cursor-pointer opacity-80 hover:opacity-95"
        style={{
          left: '53px',
          top: '50px',
          WebkitAppRegion: 'no-drag',
          background: isDark ? '#9a8b7a' : '#5a5048',
          WebkitMaskImage: `url(${headsLogo})`,
          maskImage: `url(${headsLogo})`,
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
        } as React.CSSProperties}
        onClick={() => window.open('https://www.heads.com', '_blank')}
      />
      <div className="absolute right-3 top-[15px] z-30 flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <LanguageToggle />
        <ThemeToggle className="relative top-px" />
      </div>

      <SignalBackground />
      {isChristmas && <Snowfall count={120} />}
      <FlyingAirplane />

      {/* Title — fixed position */}
      <div className="relative z-10 pt-28 text-center">
        <h1 className="title-gradient mx-auto inline-block text-4xl font-bold">
          {t('title')}
        </h1>
      </div>

      {/* Scrollable content area — slightly above center */}
      <div className="relative z-10 flex flex-1 items-center justify-center overflow-y-auto pb-[18vh]">
        <div className="w-full space-y-5 px-8" style={{ maxWidth: '508px' }}>
          {encryptionAvailable === false && (
            <div className="flex items-start gap-2 rounded-md border border-warning/20 bg-warning/10 p-3 text-sm text-warning">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">{t('security.encryptionUnavailable')}</div>
                <div className="mt-0.5 text-xs text-warning/80">
                  {t('security.encryptionDetail')}{' '}
                  {navigator.platform?.includes('Mac')
                    ? 'This is expected in development. Production builds use the macOS Keychain.'
                    : <>Install <code className="rounded bg-warning/10 px-1">libsecret</code> (e.g.{' '}
                      <code className="rounded bg-warning/10 px-1">gnome-keyring</code>) and restart
                      the app for secure storage.</>}
                </div>
              </div>
            </div>
          )}

          {/* Glass panel */}
          <div className="relative">
          <div
            ref={borderRef}
            className="pointer-events-none absolute inset-0 rounded-xl"
            style={{
              background: `conic-gradient(from var(--border-angle, 0deg), #3b8fc240, #5bb8e840, #16a34a40, #d9770640, #8b5cf640, #ec489940, #06b6d440, #f9731640, #3b8fc240)`,
              padding: '2.5px',
              WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
              WebkitMaskComposite: 'xor',
              mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
              maskComposite: 'exclude',
            }}
          />
          <div className={`relative rounded-xl shadow-xl border ${glassBorder} ${glassInner}`}>
            {/* Header with view toggle, search, and edit mode — hidden when add form is open */}
            {hasConnections && !showForm && (
              <div className="px-5 pt-3 pb-3">
                <div className="flex items-center justify-between">
                  {searchOpen ? (
                    <div className="flex flex-1 items-center gap-1 mr-2">
                      <Search size={13} className="shrink-0 text-muted" />
                      <input
                        ref={searchRef}
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        onBlur={() => { if (!search.trim()) { setSearchOpen(false) } }}
                        placeholder={t('placeholder.filter')}
                        className="min-w-0 flex-1 border-none bg-transparent p-0 text-sm text-foreground placeholder:text-muted focus:outline-none"
                        autoFocus
                      />
                      {search && (
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { setSearch(''); searchRef.current?.focus() }}
                          className="shrink-0 rounded p-0.5 text-muted transition-colors hover:text-foreground"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs font-medium uppercase tracking-wider text-muted">
                      {t('section.connections')}
                    </span>
                  )}
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) { setSearch('') } }}
                      className={`rounded p-1 transition-colors ${searchOpen ? 'text-accent' : 'text-muted hover:text-foreground'}`}
                      title={t('button.filterConnections')}
                    >
                      <Search size={14} />
                    </button>
                    <button
                      onClick={() => setViewMode(viewMode === 'large' ? 'small' : 'large')}
                      className="rounded p-1 text-muted transition-colors hover:text-foreground"
                      title={viewMode === 'large' ? t('button.compactView') : t('button.expandedView')}
                    >
                      {viewMode === 'large' ? <List size={14} /> : <LayoutGrid size={14} />}
                    </button>
                    <button
                      onClick={() => setEditMode(!editMode)}
                      className={`rounded p-1 transition-colors ${editMode ? 'text-accent' : 'text-muted hover:text-foreground'}`}
                      title={editMode ? t('button.doneEditing') : t('button.editConnections')}
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Saved connections — scrollable, hidden when add form is open */}
            {hasConnections && !showForm && (
              <div className={`max-h-[45vh] overflow-y-auto ${hasConnections ? `border-t ${glassDivider}` : ''}`}>
                {filteredConnections.length === 0 && search.trim() && (
                  <div className="px-5 py-4 text-center text-sm text-muted">{t('noMatches')}</div>
                )}
                {filteredConnections.map((conn, i) => (
                  <div
                    key={conn.id}
                    className={`group relative overflow-hidden transition-colors ${glassHover} ${i > 0 ? `border-t ${glassDivider}` : ''}`}
                  >
                    {/* Connecting progress bar */}
                    {connectingId === conn.id && (
                      <div
                        className="absolute inset-0 bg-accent/10 animate-[fill-right_2s_ease-in-out_infinite]"
                      />
                    )}
                    <button
                      onClick={() => { setConnectingId(conn.id); connect(conn) }}
                      disabled={isDisabled}
                      className={`flex w-full items-center justify-between text-left disabled:opacity-50 ${
                        viewMode === 'large' ? 'p-5' : 'px-5 py-2.5'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className={`flex items-center font-medium text-foreground ${viewMode === 'small' ? 'text-sm' : ''}`}>
                          <HighlightMatch text={conn.name} query={search.trim()} />
                          {conn.id === LOCAL_BROADCASTER_ID && (
                            <span className="ml-2" style={{ position: 'relative', top: '-2px' }}><VerifiedBadge /></span>
                          )}
                        </div>
                        {viewMode === 'large' && (
                          <TruncatedSubtitle
                            text={conn.id === LOCAL_BROADCASTER_ID && localAppDir ? localAppDir : conn.url.replace(/\/api\/?$/, '')}
                            query={search.trim()}
                          />
                        )}
                      </div>
                      {!editMode && (
                        search.trim() && filteredConnections.length === 1
                          ? <CornerDownLeft size={viewMode === 'large' ? 16 : 14} className="shrink-0 text-accent" />
                          : <ChevronRight size={viewMode === 'large' ? 16 : 14} className="shrink-0 text-muted" />
                      )}
                    </button>
                    {/* Edit mode controls */}
                    {editMode && !search.trim() && (
                      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                        <button
                          onClick={() => openEditForm(conn)}
                          className="rounded p-1 text-muted transition-colors hover:text-foreground"
                          title={t('button.editConnection')}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleMove(i, 'up')}
                          disabled={i === 0}
                          className="rounded p-1 text-muted transition-colors hover:text-foreground disabled:opacity-25"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          onClick={() => handleMove(i, 'down')}
                          disabled={i === connections.length - 1}
                          className="rounded p-1 text-muted transition-colors hover:text-foreground disabled:opacity-25"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          onClick={() => setPendingRemoval(conn)}
                          className="rounded p-1 text-muted transition-colors hover:text-error"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add/edit connection form */}
            {!showForm ? (
              <button
                onClick={() => { setEditingConnection(null); setShowForm(true) }}
                className={`flex w-full items-center gap-2 px-5 pb-5 pt-4 text-base font-medium transition-colors ${glassHover} hover:text-foreground ${hasConnections ? `border-t ${glassDivider}` : ''} ${isDark ? 'text-muted-foreground' : 'text-foreground/60'}`}
              >
                <Plus size={16} />
                {t('button.newConnection')}
              </button>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleFormSubmit()
                }}
                className="space-y-3 p-5"
              >
                {editingConnection && (
                  <div className="text-xs font-medium uppercase tracking-wider text-muted">
                    {t('form.editTitle', { name: editingConnection.name })}
                  </div>
                )}

                {formError && (
                  <div className="rounded-md bg-error/10 p-2 text-xs text-error">{formError}</div>
                )}

                <fieldset className={`relative rounded-md border ${submitted && !url.trim() ? 'border-error' : glassBorder}`}>
                  <legend className={`ml-3 px-1 text-xs ${submitted && !url.trim() ? 'text-error' : 'text-muted'}`}>{t('form.url')}</legend>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => { setUrl(e.target.value); setSubmitted(false) }}
                    onBlur={onUrlBlur}
                    placeholder={submitted && !url.trim() ? t('required', { ns: 'common', keyPrefix: 'validation' }) : undefined}
                    className={`w-full rounded-md px-3 pb-2 pt-0.5 text-[13px] font-mono text-foreground placeholder:font-sans placeholder:text-error/50 focus:outline-none ${glassInput}`}
                    autoFocus
                  />
                </fieldset>

                <fieldset className={`relative rounded-md border ${submitted && !name.trim() ? 'border-error' : glassBorder}`}>
                  <legend className={`ml-3 px-1 text-xs ${submitted && !name.trim() ? 'text-error' : 'text-muted'}`}>{t('form.name')}</legend>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      setNameManuallyEdited(true)
                      setSubmitted(false)
                    }}
                    placeholder={submitted && !name.trim() ? t('required', { ns: 'common', keyPrefix: 'validation' }) : undefined}
                    className={`w-full rounded-md px-3 pb-2 pt-0.5 text-sm text-foreground placeholder:text-error/50 focus:outline-none ${glassInput}`}
                  />
                </fieldset>

                <fieldset className={`relative rounded-md border ${submitted && !editingConnection && !apiKey.trim() ? 'border-error' : glassBorder}`}>
                  <legend className={`ml-3 px-1 text-xs ${submitted && !editingConnection && !apiKey.trim() ? 'text-error' : 'text-muted'}`}>
                    {t('form.apiKey')}
                  </legend>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => { setApiKey(e.target.value); setSubmitted(false) }}
                    placeholder={submitted && !editingConnection && !apiKey.trim()
                      ? t('required', { ns: 'common', keyPrefix: 'validation' })
                      : editingConnection ? '••••••••' : undefined}
                    className={`w-full rounded-md px-3 pb-2 pt-0.5 font-mono text-[13px] text-foreground focus:outline-none ${glassInput} ${submitted && !editingConnection && !apiKey.trim() ? 'placeholder:font-sans placeholder:text-error/50' : 'placeholder:text-muted'}`}
                  />
                </fieldset>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={closeForm}
                    className={`flex-1 rounded-md border ${glassBorder} bg-transparent px-4 pt-[7px] pb-[9px] text-sm text-muted transition-colors hover:text-foreground ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/3'}`}
                  >
                    {t('button.cancel', { ns: 'common' })}
                  </button>
                  <button
                    type="submit"
                    disabled={isDisabled}
                    className="flex-1 rounded-md bg-accent px-4 pt-[7px] pb-[9px] text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50"
                  >
                    {testing
                      ? t('state.verifying', { ns: 'common' })
                      : saving
                        ? t('state.saving', { ns: 'common' })
                        : editingConnection
                          ? t('button.save', { ns: 'common' })
                          : status === 'connecting'
                            ? t('state.connecting', { ns: 'common' })
                            : t('button.connect', { ns: 'common' })}
                  </button>
                </div>
              </form>
            )}
          </div>
          </div>

        </div>
      </div>

      {pendingRemoval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-foreground">{t('dialog.removeTitle')}</h2>
            <p className="mt-2 text-sm text-muted">
              {t('dialog.removeMessage', { name: pendingRemoval.name })}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setPendingRemoval(null)}
                className="rounded-md border border-border px-4 pt-[7px] pb-[9px] text-sm text-muted transition-colors hover:text-foreground"
              >
                {t('button.cancel', { ns: 'common' })}
              </button>
              <button
                onClick={() => handleRemove(pendingRemoval.id)}
                className="rounded-md bg-error px-4 pt-[7px] pb-[9px] text-sm font-medium text-white transition-colors hover:bg-error/90"
              >
                {t('button.remove', { ns: 'common' })}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <ConnectionErrorDialog
        error={error}
        onDismiss={() => { clearError(); setConnectingId(null) }}
        onEdit={() => {
          const conn = connections.find((c) => c.name === error.connectionName)
          clearError()
          setConnectingId(null)
          if (conn) openEditForm(conn)
        }}
      />}
    </div>
  )
}
