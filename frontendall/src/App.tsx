import { lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AuthProvider } from '@/context/AuthContext'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { RequireRole } from '@/components/auth/RequireRole'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import AuditLogPage from '@/pages/AuditLogPage'
import BirthdaysPage from '@/pages/BirthdaysPage'
import { ShellLayout } from '@/components/layout/ShellLayout'

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
                    <ShellLayout section="Dashboard">
                      <DashboardPage />
                    </ShellLayout>
                  </RequireAuth>
                }
              />
              <Route
                path="/birthdays"
                element={
                  <RequireAuth>
                    <ShellLayout section="Birthdays">
                      <BirthdaysPage />
                    </ShellLayout>
                  </RequireAuth>
                }
              />
              <Route
                path="/audit-log"
                element={
                  <RequireAuth>
                    <RequireRole role="admin">
                      <ShellLayout section="Audit Log">
                        <AuditLogPage />
                      </ShellLayout>
                    </RequireRole>
                  </RequireAuth>
                }
              />
              <Route
                path="/ems/*"
                element={
                  <RequireAuth>
                    <ShellLayout section="EMS">
                      <Suspense fallback={<RemoteFallback />}>
                        <RemoteEms basename="/ems" />
                      </Suspense>
                    </ShellLayout>
                  </RequireAuth>
                }
              />
              <Route
                path="/sales/*"
                element={
                  <RequireAuth>
                    <ShellLayout section="Sales">
                      <Suspense fallback={<RemoteFallback />}>
                        <RemoteSales basename="/sales" />
                      </Suspense>
                    </ShellLayout>
                  </RequireAuth>
                }
              />
              <Route
                path="/followups/*"
                element={
                  <RequireAuth>
                    <ShellLayout section="Followups">
                      <Suspense fallback={<RemoteFallback />}>
                        <RemoteFollowups basename="/followups" />
                      </Suspense>
                    </ShellLayout>
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
