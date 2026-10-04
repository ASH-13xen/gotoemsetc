import { lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AuthProvider } from '@/context/AuthContext'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { RequireAccess, RequireFeature } from '@/components/auth/RequireRole'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import AuditLogPage from '@/pages/AuditLogPage'
import PerformanceFlagsPage from '@/pages/PerformanceFlagsPage'
import OrgChartPage from '@/pages/OrgChartPage'
import EventsPage from '@/pages/EventsPage'
import EventDetailPage from '@/pages/EventDetailPage'
import CompanyCalendarPage from '@/pages/CompanyCalendarPage'
import WeeklyCalendarPage from '@/pages/WeeklyCalendarPage'
import CalendarInvitePage from '@/pages/CalendarInvitePage'
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
              {/* From the Weekly Calendar invite email — no login needed. */}
              <Route path="/calendar-invite/:token" element={<CalendarInvitePage />} />
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
                    <ShellLayout section="Weekly Calendar" wide>
                      <WeeklyCalendarPage />
                    </ShellLayout>
                  </RequireAuth>
                }
              />
              {/* The month view of holidays, half days and who's out — opened
                  from the dashboard calendar's "View full calendar" link. */}
              <Route
                path="/company-calendar"
                element={
                  <RequireAuth>
                    <ShellLayout section="Company Calendar">
                      <CompanyCalendarPage />
                    </ShellLayout>
                  </RequireAuth>
                }
              />
              <Route
                path="/events"
                element={
                  <RequireAuth>
                    <RequireAccess access="events">
                      <ShellLayout section="Event Management">
                        <EventsPage />
                      </ShellLayout>
                    </RequireAccess>
                  </RequireAuth>
                }
              />
              <Route
                path="/events/:id"
                element={
                  <RequireAuth>
                    <RequireAccess access="events">
                      <ShellLayout section="Event Management">
                        <EventDetailPage />
                      </ShellLayout>
                    </RequireAccess>
                  </RequireAuth>
                }
              />
              <Route
                path="/audit-log"
                element={
                  <RequireAuth>
                    <RequireAccess access="audit_log">
                      <ShellLayout section="Audit Log">
                        <AuditLogPage />
                      </ShellLayout>
                    </RequireAccess>
                  </RequireAuth>
                }
              />
              <Route
                path="/organisation"
                element={
                  <RequireAuth>
                    <ShellLayout section="Organisation" fullBleed>
                      <OrgChartPage />
                    </ShellLayout>
                  </RequireAuth>
                }
              />
              <Route
                path="/performance-flags"
                element={
                  <RequireAuth>
                    <RequireAccess access="performance_flags">
                      <ShellLayout section="Performance Flags">
                        <PerformanceFlagsPage />
                      </ShellLayout>
                    </RequireAccess>
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
                    <RequireFeature feature="CLIENT_MANAGEMENT">
                      <ShellLayout section="Client Management">
                        <Suspense fallback={<RemoteFallback />}>
                          <RemoteSales basename="/sales" />
                        </Suspense>
                      </ShellLayout>
                    </RequireFeature>
                  </RequireAuth>
                }
              />
              <Route
                path="/followups/*"
                element={
                  <RequireAuth>
                    <RequireFeature feature="TASK_MANAGEMENT">
                      <ShellLayout section="Task Management">
                      <Suspense fallback={<RemoteFallback />}>
                        <RemoteFollowups basename="/followups" />
                      </Suspense>
                    </ShellLayout>
                    </RequireFeature>
                  </RequireAuth>
                }
              />
              <Route
                path="/hr/*"
                element={
                  <RequireAuth>
                    <RequireAccess access="hrms">
                      <ShellLayout section="HR Work">
                        <Suspense fallback={<RemoteFallback />}>
                          <RemoteHr basename="/hr" />
                        </Suspense>
                      </ShellLayout>
                    </RequireAccess>
                  </RequireAuth>
                }
              />
              <Route
                path="/operations/*"
                element={
                  <RequireAuth>
                    <RequireAccess access="operations">
                      <ShellLayout section="Operations">
                        <Suspense fallback={<RemoteFallback />}>
                          <RemoteOperations basename="/operations" />
                        </Suspense>
                      </ShellLayout>
                    </RequireAccess>
                  </RequireAuth>
                }
              />
              <Route
                path="/finance/*"
                element={
                  <RequireAuth>
                    <RequireAccess access="finance">
                      <ShellLayout section="Finance">
                        <Suspense fallback={<RemoteFallback />}>
                          <RemoteFinance basename="/finance" />
                        </Suspense>
                      </ShellLayout>
                    </RequireAccess>
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
