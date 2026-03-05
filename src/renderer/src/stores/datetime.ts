import { create } from 'zustand'

interface DateTimeState {
  utc: boolean
  toggleUtc: () => void
}

function getInitial(): boolean {
  try {
    return localStorage.getItem('bcadmin-utc') !== 'false'
  } catch {
    return true
  }
}

export const useDateTimeStore = create<DateTimeState>((set, get) => ({
  utc: getInitial(),
  toggleUtc: () => {
    const next = !get().utc
    try {
      localStorage.setItem('bcadmin-utc', String(next))
    } catch {
      // best-effort
    }
    set({ utc: next })
  }
}))
