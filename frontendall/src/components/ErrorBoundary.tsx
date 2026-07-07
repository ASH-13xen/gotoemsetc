import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'

interface ErrorBoundaryState {
  error: Error | null
}

// Without this, an uncaught render error unmounts the whole tree and Vite's
// HMR can patch the source but can't resurrect an already-crashed component —
// only a full reload would recover. Catching here means a stray bug in one
// section shows a recoverable message instead of a blank page.
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
          <div className="flex max-w-md flex-col items-center gap-4 border-2 border-destructive p-8 text-center">
            <h1 className="text-xl font-black tracking-widest text-destructive uppercase">Something Broke</h1>
            <p className="text-sm font-bold tracking-wide text-neutral-400 uppercase">
              {this.state.error.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 border-2 border-white px-6 py-3 text-sm font-bold tracking-widest text-white uppercase hover:bg-white hover:text-black"
            >
              <RefreshCw className="size-4" />
              Reload Page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
