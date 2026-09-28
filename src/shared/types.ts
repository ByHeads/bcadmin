export interface SavedConnection {
  id: string
  name: string
  url: string
  lastConnected: string | null
  color: string | null
}

/** Where to resume after the app restarts as administrator */
export interface LaunchIntent {
  connectionId: string
  route: string
}
