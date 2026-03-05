import { useEffect, useCallback } from 'react'
import { queryClient } from '@/lib/query-client'

interface KeyboardShortcutOptions {
  /** All navigable page IDs in sidebar order */
  pageIds: string[]
  /** Current active page */
  activePage: string
  /** Set the active page */
  setActivePage: (page: string) => void
  /** Check if a nav item is accessible */
  canAccess: (navId: string) => boolean
}

/**
 * Global keyboard shortcuts for the app shell.
 *
 * - Cmd/Ctrl+R: Refresh current view (invalidate all queries)
 * - Cmd/Ctrl+,: Go to Settings
 * - Cmd/Ctrl+1..9: Navigate to nth sidebar item (Overview=1)
 * - [ / ]: Previous/next sidebar section
 */
export function useKeyboardShortcuts({
  pageIds,
  activePage,
  setActivePage,
  canAccess
}: KeyboardShortcutOptions): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey

      // Don't intercept shortcuts when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if (mod && e.key === 'r') {
        e.preventDefault()
        queryClient.invalidateQueries()
        return
      }

      if (mod && e.key === ',') {
        e.preventDefault()
        if (canAccess('settings')) {
          setActivePage('settings')
        }
        return
      }

      // Cmd/Ctrl+1..9: jump to sidebar item by index
      if (mod && e.key >= '1' && e.key <= '9' && !isInput) {
        e.preventDefault()
        const index = parseInt(e.key, 10) - 1
        if (index < pageIds.length) {
          const targetPage = pageIds[index]
          if (targetPage === 'overview' || canAccess(targetPage)) {
            setActivePage(targetPage)
          }
        }
        return
      }

      // [ and ] to navigate prev/next accessible page
      if (!mod && !isInput && (e.key === '[' || e.key === ']')) {
        e.preventDefault()
        const currentIndex = pageIds.indexOf(activePage)
        if (currentIndex === -1) return

        const direction = e.key === ']' ? 1 : -1
        let nextIndex = currentIndex + direction

        // Find next accessible page in direction
        while (nextIndex >= 0 && nextIndex < pageIds.length) {
          const candidate = pageIds[nextIndex]
          if (candidate === 'overview' || canAccess(candidate)) {
            setActivePage(candidate)
            return
          }
          nextIndex += direction
        }
      }
    },
    [pageIds, activePage, setActivePage, canAccess]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
