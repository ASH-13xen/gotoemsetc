import { lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AuthProvider } from '@/context/AuthContext'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { RequireRole } from '@/components/auth/RequireRole'
import LoginPage from '@/pages/LoginPage'
import ShellHomePage from '@/pages/ShellHomePage'
import AuditLogPage from '@/pages/AuditLogPage'
import { RemoteShellBar } from '@/components/layout/RemoteShellBar'

const RemoteEms = lazy(() => import('frontendems/App'))
const RemoteSales = lazy(() => import('frontendsales/App'))
const RemoteFollowups = lazy(() => import('frontendfollowups/App'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

function RemoteFallback() {
  return <div className="p-10 text-sm text-muted-foreground">Loading…</div>
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <ShellHomePage />
                  </RequireAuth>
                }
              />
              <Route
                path="/audit-log"
                element={
                  <RequireAuth>
                    <RequireRole role="admin">
                      <AuditLogPage />
                    </RequireRole>
                  </RequireAuth>
                }
              />
              <Route
                path="/ems/*"
                element={
                  <RequireAuth>
                    <RemoteShellBar section="EMS" />
                    <Suspense fallback={<RemoteFallback />}>
                      <RemoteEms basename="/ems" />
                    </Suspense>
                  </RequireAuth>
                }
              />
              <Route
                path="/sales/*"
                element={
                  <RequireAuth>
                    <RemoteShellBar section="Sales" />
                    <Suspense fallback={<RemoteFallback />}>
                      <RemoteSales basename="/sales" />
                    </Suspense>
                  </RequireAuth>
                }
              />
              <Route
                path="/followups/*"
                element={
                  <RequireAuth>
                    <RemoteShellBar section="Followups" />
                    <Suspense fallback={<RemoteFallback />}>
                      <RemoteFollowups basename="/followups" />
                    </Suspense>
                  </RequireAuth>
                }
              />
            </Routes>
          </BrowserRouter>
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
