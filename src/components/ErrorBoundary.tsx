import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
    try {
      import('../lib/sentry').then(({ Sentry }) => {
        Sentry.captureException(error, { extra: { componentStack: info.componentStack } })
      })
    } catch { /* sentry not available */ }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground">
          <p className="text-lg font-medium">Ocorreu um erro inesperado.</p>
          <p className="text-sm text-muted-foreground">{this.state.error?.message}</p>
          <button
            className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm"
            onClick={() => {
              this.setState({ hasError: false })
              window.location.reload()
            }}
          >
            Tentar novamente
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
