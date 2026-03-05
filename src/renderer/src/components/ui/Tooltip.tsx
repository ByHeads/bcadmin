import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

const DELAY = 150

export function GlobalTooltip(): React.ReactNode {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(null)
  const activeEl = useRef<Element | null>(null)
  const savedTitle = useRef('')

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (activeEl.current && savedTitle.current) {
      activeEl.current.setAttribute('title', savedTitle.current)
    }
    activeEl.current = null
    savedTitle.current = ''
    setTip(null)
  }, [])

  useEffect(() => {
    function onEnter(e: MouseEvent): void {
      const target = e.target as Element
      const el = target.closest?.('[title]')
      if (!el) return
      const text = el.getAttribute('title')
      if (!text) return

      // If moving to a new titled element, clean up the previous one
      if (activeEl.current && activeEl.current !== el) hide()

      // Strip native title to prevent double tooltip
      el.removeAttribute('title')
      activeEl.current = el
      savedTitle.current = text

      const rect = el.getBoundingClientRect()
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        setTip({ text, x: rect.left + rect.width / 2, y: rect.top })
      }, DELAY)
    }

    function onLeave(e: MouseEvent): void {
      if (!activeEl.current) return
      const related = e.relatedTarget as Element | null
      // Only hide if we actually left the active element (not moving to a child)
      if (related && activeEl.current.contains(related)) return
      hide()
    }

    document.addEventListener('mouseover', onEnter, true)
    document.addEventListener('mouseout', onLeave, true)
    document.addEventListener('scroll', hide, true)
    return () => {
      document.removeEventListener('mouseover', onEnter, true)
      document.removeEventListener('mouseout', onLeave, true)
      document.removeEventListener('scroll', hide, true)
      if (timer.current) clearTimeout(timer.current)
      if (activeEl.current && savedTitle.current) {
        activeEl.current.setAttribute('title', savedTitle.current)
      }
    }
  }, [hide])

  if (!tip) return null

  return createPortal(
    <div
      className="pointer-events-none fixed z-[9999] rounded bg-foreground px-2 py-1 text-[11px] leading-tight text-background shadow"
      style={{ left: tip.x, top: tip.y - 6, transform: 'translate(-50%, -100%)' }}
    >
      {tip.text}
    </div>,
    document.body
  )
}
