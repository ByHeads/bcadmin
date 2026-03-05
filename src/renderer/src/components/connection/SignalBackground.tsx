import { useEffect, useRef } from 'react'

interface Signal {
  x: number
  y: number
  speed: number
  radius: number
  color: string
  opacity: number
  trail: { x: number; y: number }[]
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  maxRadius: number
  color: string
  opacity: number
  life: number
  maxLife: number
  fadeIn: boolean
}

interface PendingSpawn {
  signal: Signal
  delay: number
}

const COLORS = [
  '#3b8fc2', // blue (accent)
  '#5bb8e8', // light blue
  '#16a34a', // green
  '#d97706', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316'  // orange
]

export function SignalBackground(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const signalsRef = useRef<Signal[]>([])
  const particlesRef = useRef<Particle[]>([])
  const pendingRef = useRef<PendingSpawn[]>([])
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize(): void {
      canvas!.width = canvas!.offsetWidth * window.devicePixelRatio
      canvas!.height = canvas!.offsetHeight * window.devicePixelRatio
      ctx!.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    window.addEventListener('resize', resize)

    const w = () => canvas!.offsetWidth
    const h = () => canvas!.offsetHeight

    function createSignal(): Signal {
      const goingRight = Math.random() > 0.25 // 75% left-to-right
      return {
        x: goingRight ? -20 : w() + 20,
        y: 40 + Math.random() * (h() - 80),
        speed: (2 + Math.random() * 3) * (goingRight ? 1 : -1),
        radius: 2 + Math.random() * 3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        opacity: 0.3 + Math.random() * 0.4,
        trail: []
      }
    }

    function spawnImpact(x: number, y: number, color: string, opacity: number, fromRight: boolean): void {
      const count = 3 + Math.floor(Math.random() * 4)
      for (let i = 0; i < count; i++) {
        const angle = (fromRight ? Math.PI * 0.5 : -Math.PI * 0.5) + (Math.random() - 0.5) * Math.PI * 0.8
        const speed = 1 + Math.random() * 2.5
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 0,
          maxRadius: 1 + Math.random() * 1.5,
          color,
          opacity: opacity * 0.8,
          life: 1,
          maxLife: 1,
          fadeIn: false
        })
      }
    }

    function spawnChargeGlow(x: number, y: number, color: string, opacity: number): void {
      // Colored glow that fades in
      particlesRef.current.push({
        x,
        y,
        vx: 0,
        vy: 0,
        radius: 0,
        maxRadius: 12 + Math.random() * 5,
        color,
        opacity: opacity * 0.5,
        life: 1.8,
        maxLife: 1.8,
        fadeIn: true
      })
      // White core that fades in
      particlesRef.current.push({
        x,
        y,
        vx: 0,
        vy: 0,
        radius: 0,
        maxRadius: 6 + Math.random() * 3,
        color: '#ffffff',
        opacity: opacity * 0.6,
        life: 1.4,
        maxLife: 1.4,
        fadeIn: true
      })
    }

    // Seed initial signals spread across the screen
    signalsRef.current = []
    for (let i = 0; i < 12; i++) {
      const s = createSignal()
      s.x = Math.random() * w()
      signalsRef.current.push(s)
    }

    // ~20 frames of charge-up before signal launches
    const CHARGE_FRAMES = 20

    function draw(): void {
      const signals = signalsRef.current
      const particles = particlesRef.current
      const pending = pendingRef.current
      ctx!.clearRect(0, 0, w(), h())

      // Tick pending spawns
      for (let i = pending.length - 1; i >= 0; i--) {
        pending[i].delay--
        if (pending[i].delay <= 0) {
          signals.push(pending[i].signal)
          pending.splice(i, 1)
        }
      }

      // Spawn new signals — occasionally in bursts of 2–5
      if (Math.random() < 0.02 && signals.length + pending.length < 25) {
        const count = Math.random() < 0.35 ? 2 + Math.floor(Math.random() * 4) : 1
        const baseY = 40 + Math.random() * (h() - 80)
        let glowFired = false
        for (let b = 0; b < count && signals.length + pending.length < 25; b++) {
          const s = createSignal()
          s.y = baseY + (b - (count - 1) / 2) * (8 + Math.random() * 12)
          pending.push({ signal: s, delay: CHARGE_FRAMES })
          if (!glowFired) {
            const edgeX = s.speed > 0 ? 0 : w()
            spawnChargeGlow(edgeX, s.y, s.color, s.opacity)
            glowFired = true
          }
        }
      }

      for (let i = signals.length - 1; i >= 0; i--) {
        const s = signals[i]

        // Record trail position
        s.trail.push({ x: s.x, y: s.y })
        if (s.trail.length > 40) s.trail.shift()

        // Draw trail
        for (let t = 0; t < s.trail.length; t++) {
          const trailOpacity = (t / s.trail.length) * s.opacity * 0.5
          ctx!.beginPath()
          ctx!.arc(s.trail[t].x, s.trail[t].y, s.radius * 0.6, 0, Math.PI * 2)
          ctx!.fillStyle = s.color + Math.round(trailOpacity * 255).toString(16).padStart(2, '0')
          ctx!.fill()
        }

        // Soft glow
        ctx!.beginPath()
        ctx!.arc(s.x, s.y, s.radius * 3, 0, Math.PI * 2)
        ctx!.fillStyle = s.color + Math.round(s.opacity * 0.15 * 255).toString(16).padStart(2, '0')
        ctx!.fill()

        // Draw main dot
        ctx!.beginPath()
        ctx!.arc(s.x, s.y, s.radius, 0, Math.PI * 2)
        ctx!.fillStyle = s.color + Math.round(s.opacity * 255).toString(16).padStart(2, '0')
        ctx!.fill()

        // White core
        ctx!.beginPath()
        ctx!.arc(s.x, s.y, s.radius * 0.45, 0, Math.PI * 2)
        ctx!.fillStyle = '#ffffff' + Math.round(s.opacity * 0.9 * 255).toString(16).padStart(2, '0')
        ctx!.fill()

        // Move
        s.x += s.speed

        // Remove if off screen — spawn impact at edge
        if (s.speed > 0 && s.x > w() + 10) {
          spawnImpact(w(), s.y, s.color, s.opacity, true)
          signals.splice(i, 1)
        } else if (s.speed < 0 && s.x < -10) {
          spawnImpact(0, s.y, s.color, s.opacity, false)
          signals.splice(i, 1)
        }
      }

      // Draw and update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.96
        p.vy *= 0.96
        p.life -= 0.03

        if (p.life <= 0) {
          particles.splice(i, 1)
          continue
        }

        const t = p.life / p.maxLife // 1 = fresh, 0 = dead
        let alpha: number
        let r: number
        if (p.fadeIn) {
          // Fade in during first 40%, then fade out
          const fadeInT = 0.4
          const progress = 1 - t // 0 = fresh, 1 = dead
          if (progress < fadeInT) {
            const ramp = progress / fadeInT
            alpha = p.opacity * ramp
            r = p.maxRadius * ramp
          } else {
            const fadeOut = (1 - progress) / (1 - fadeInT)
            alpha = p.opacity * fadeOut
            r = p.maxRadius * (0.8 + 0.2 * fadeOut)
          }
        } else {
          alpha = p.opacity * t
          r = (p.maxRadius || p.radius) * t
        }

        ctx!.beginPath()
        ctx!.arc(p.x, p.y, Math.max(r, 0.5), 0, Math.PI * 2)
        ctx!.fillStyle = p.color + Math.round(Math.min(alpha, 1) * 255).toString(16).padStart(2, '0')
        ctx!.fill()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[4] h-full w-full"
    />
  )
}
