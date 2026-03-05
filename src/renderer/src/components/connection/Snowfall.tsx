import { useMemo } from 'react'

const FLAKE_CHARS = ['❄', '❅', '❆', '✻', '✼', '❊']

/** CSS-animated snowfall with unicode snowflake characters — gentle vertical fall with sway and rotation */
export function Snowfall({ count = 50 }: { count?: number }): React.ReactNode {
  const flakes = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 10,
      fallDuration: 10 + Math.random() * 16,
      swayDuration: 3 + Math.random() * 4,
      swayAmount: 15 + Math.random() * 25,
      size: 8 + Math.random() * 14,
      opacity: 0.25 + Math.random() * 0.45,
      char: FLAKE_CHARS[Math.floor(Math.random() * FLAKE_CHARS.length)],
      spinDuration: 4 + Math.random() * 16,
    })),
    [count]
  )

  return (
    <div className="pointer-events-none absolute inset-0 z-[4] overflow-hidden">
      {flakes.map((f) => (
        <div
          key={f.id}
          className="absolute select-none text-blue-400/50 dark:text-white/50"
          style={{
            left: `${f.left}%`,
            top: '-20px',
            fontSize: f.size,
            opacity: f.opacity,
            animation: `snowfall-down ${f.fallDuration}s linear ${f.delay}s infinite, snowfall-sway ${f.swayDuration}s ease-in-out ${f.delay}s infinite, snowspin ${f.spinDuration}s linear infinite`,
            '--sway-amount': `${f.swayAmount}px`,
          } as React.CSSProperties}
        >
          {f.char}
        </div>
      ))}
    </div>
  )
}
