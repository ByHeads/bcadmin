import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConnectionStore } from '@/stores/connection'
import { ConnectionScreen } from '@/components/connection/ConnectionScreen'
import { AppShell } from '@/components/layout/AppShell'

export default function App(): React.ReactNode {
  const { status, loadConnections, connectionDropped, authErrorConnection, activeConnection } = useConnectionStore()
  const navigate = useNavigate()
  const prevConnectionIdRef = useRef<string | null>(null)

  useEffect(() => {
    loadConnections()
  }, [loadConnections])

  // Reset to overview when switching to a different connection
  useEffect(() => {
    if (activeConnection && activeConnection.id !== prevConnectionIdRef.current) {
      if (prevConnectionIdRef.current !== null) {
        navigate('/', { replace: true })
      }
      prevConnectionIdRef.current = activeConnection.id
    }
    if (!activeConnection) {
      prevConnectionIdRef.current = null
    }
  }, [activeConnection, navigate])

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted">Loading...</div>
      </div>
    )
  }

  // Stay on AppShell during connection drops or auth errors (overlays handle recovery)
  if (status === 'connected' || connectionDropped || authErrorConnection) {
    return <AppShell />
  }

  return <ConnectionScreen />
}
