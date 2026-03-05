import { create } from 'zustand'

type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  toggle: () => void
  setTheme: (theme: Theme) => void
}

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem('bcadmin-theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage unavailable
  }
  return getSystemTheme()
}

function applyTheme(theme: Theme, persist = true): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  if (persist) {
    try {
      localStorage.setItem('bcadmin-theme', theme)
    } catch {
      // best-effort
    }
  }
}

// Apply on load
applyTheme(getInitialTheme(), false)

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),
  toggle: () => {
    const next = get().theme === 'light' ? 'dark' : 'light'
    applyTheme(next)
    set({ theme: next })
  },
  setTheme: (theme: Theme) => {
    applyTheme(theme)
    set({ theme })
  }
}))

// Follow system changes if user hasn't manually chosen yet
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  const hasStored = localStorage.getItem('bcadmin-theme') !== null
  if (!hasStored) {
    const theme = e.matches ? 'dark' : 'light'
    applyTheme(theme, false)
    useThemeStore.setState({ theme })
  }
})
