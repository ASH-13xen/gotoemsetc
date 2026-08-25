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
import PerformanceFlagsPage from '@/pages/PerformanceFlagsPage'
import EventsPage from '@/pages/EventsPage'
import EventDetailPage from '@/pages/EventDetailPage'
import CompanyCalendarPage from '@/pages/CompanyCalendarPage'
import { ShellLayout } from '@/components/layout/ShellLayout'
import { ensureRemoteStyles } from '@/lib/remoteStyles'

const RemoteEms = lazy(() => {
  ensureRemoteStyles('frontendems')
  return import('frontendems/App')
})
const RemoteSales = lazy(() => {
  ensureRemoteStyles('frontendsales')
  return import('frontendsales/App')
})
const RemoteFollowups = lazy(() => {
  ensureRemoteStyles('frontendfollowups')
  return import('frontendfollowups/App')
})
const RemoteHr = lazy(() => {
  ensureRemoteStyles('frontendhr')
  return import('frontendhr/App')
})
const RemoteOperations = lazy(() => {
  ensureRemoteStyles('frontendop')
  return import('frontendop/App')
})
const RemoteFinance = lazy(() => {
  ensureRemoteStyles('frontendfinance')
  return import('frontendfinance/App')
})

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
                path="/calendar"
                element={
                  <RequireAuth>
                    <ShellLayout section="Calendar">
                      <CompanyCalendarPage />
                    </ShellLayout>
                  </RequireAuth>
                }
              />
              <Route
                path="/events"
                element={
                  <RequireAuth>
                    <RequireRole role="admin">
                      <ShellLayout section="Event Management">
                        <EventsPage />
                      </ShellLayout>
                    </RequireRole>
                  </RequireAuth>
                }
              />
              <Route
                path="/events/:id"
                element={
                  <RequireAuth>
                    <RequireRole role="admin">
                      <ShellLayout section="Event Management">
                        <EventDetailPage />
                      </ShellLayout>
                    </RequireRole>
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
                path="/performance-flags"
                element={
                  <RequireAuth>
                    <RequireRole role="hr-work">
                      <ShellLayout section="Performance Flags">
                        <PerformanceFlagsPage />
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
                    <RequireRole role="cms">
                      <ShellLayout section="Client Management">
                        <Suspense fallback={<RemoteFallback />}>
                          <RemoteSales basename="/sales" />
                        </Suspense>
                      </ShellLayout>
                    </RequireRole>
                  </RequireAuth>
                }
              />
              <Route
                path="/followups/*"
                element={
                  <RequireAuth>
                    <ShellLayout section="Task Management">
                      <Suspense fallback={<RemoteFallback />}>
                        <RemoteFollowups basename="/followups" />
                      </Suspense>
                    </ShellLayout>
                  </RequireAuth>
                }
              />
              <Route
                path="/hr/*"
                element={
                  <RequireAuth>
                    <RequireRole role="hr-work">
                      <ShellLayout section="HR Work">
                        <Suspense fallback={<RemoteFallback />}>
                          <RemoteHr basename="/hr" />
                        </Suspense>
                      </ShellLayout>
                    </RequireRole>
                  </RequireAuth>
                }
              />
              <Route
                path="/operations/*"
                element={
                  <RequireAuth>
                    <RequireRole role="operations">
                      <ShellLayout section="Operations">
                        <Suspense fallback={<RemoteFallback />}>
                          <RemoteOperations basename="/operations" />
                        </Suspense>
                      </ShellLayout>
                    </RequireRole>
                  </RequireAuth>
                }
              />
              <Route
                path="/finance/*"
                element={
                  <RequireAuth>
                    <RequireRole role="finance">
                      <ShellLayout section="Finance">
                        <Suspense fallback={<RemoteFallback />}>
                          <RemoteFinance basename="/finance" />
                        </Suspense>
                      </ShellLayout>
                    </RequireRole>
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
