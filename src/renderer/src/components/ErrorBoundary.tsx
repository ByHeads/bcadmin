import { Component, type ReactNode } from 'react'
import i18n from '@/i18n'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Uncaught error:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
          <div className="text-lg font-medium text-foreground">
            {i18n.t('errorBoundary.title', { ns: 'common' })}
          </div>
          <div className="max-w-md text-center text-sm text-muted">
            {this.state.error?.message ?? i18n.t('error.unexpected', { ns: 'common' })}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="rounded-md bg-accent px-4 pt-[7px] pb-[9px] text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
          >
            {i18n.t('errorBoundary.tryAgain', { ns: 'common' })}
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
