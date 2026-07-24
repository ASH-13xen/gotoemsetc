import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'

import { AuthProvider } from '@/context/AuthContext'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { RequireOwnEmployee } from '@/components/auth/RequireOwnEmployee'
import { RequireOwnAttendance } from '@/components/auth/RequireOwnAttendance'
import { RequirePermission } from '@/components/auth/RequirePermission'
import { RequireAdmin } from '@/components/auth/RequireAdmin'
import { useAuth } from '@/hooks/useAuth'
import { hasAnyPermission } from '@/lib/permissions'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import EmployeeDetailPage from '@/pages/EmployeeDetailPage'
import EmployeeWizardPage from '@/pages/EmployeeWizardPage'
import PublicUploadPage from '@/pages/PublicUploadPage'
import ApplicantsPage from '@/pages/ApplicantsPage'
import ApplicantDetailPage from '@/pages/ApplicantDetailPage'
import AttendancePage from '@/pages/AttendancePage'
import UploadDocumentsPage from '@/pages/UploadDocumentsPage'

// A worker with no granted permissions has no use for the admin dashboard
// (it's an all-employees browser) — send them straight to their own
// employee record instead. Admins, and anyone holding at least one
// permission (they need directory access to use it), see the dashboard.
function Home() {
  const { user, isReady } = useAuth()
  if (!isReady) return null
  if (hasAnyPermission(user)) return <DashboardPage />
  if (user?.employeeLink) return <Navigate to={`/employees/${user.employeeLink}`} replace />
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-center text-muted-foreground">
      No employee record is linked to this account. Contact an admin.
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

interface AppProps {
  // Set when mounted inside frontendall's shell (e.g. "/ems") so this app's
  // internal routes resolve under that prefix instead of the domain root.
  basename?: string
}

export default function App({ basename }: AppProps = {}) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename={basename}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            {/* Public, token-gated link sent to applicants — no login required. */}
            <Route path="/upload/:token" element={<PublicUploadPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Home />
                </RequireAuth>
              }
            />
            <Route
              path="/employees/:id"
              element={
                <RequireAuth>
                  <RequireOwnEmployee>
                    <EmployeeDetailPage />
                  </RequireOwnEmployee>
                </RequireAuth>
              }
            />
            <Route
              path="/employees/:id/wizard"
              element={
                <RequireAuth>
                  <RequirePermission permission="generate_documents">
                    <EmployeeWizardPage />
                  </RequirePermission>
                </RequireAuth>
              }
            />
            <Route
              path="/applicants"
              element={
                <RequireAuth>
                  <RequirePermission permission="view_applicants">
                    <ApplicantsPage />
                  </RequirePermission>
                </RequireAuth>
              }
            />
            <Route
              path="/applicants/:id"
              element={
                <RequireAuth>
                  <RequirePermission permission="view_applicants">
                    <ApplicantDetailPage />
                  </RequirePermission>
                </RequireAuth>
              }
            />
            <Route
              path="/attendance"
              element={
                <RequireAuth>
                  <RequireOwnAttendance>
                    <AttendancePage />
                  </RequireOwnAttendance>
                </RequireAuth>
              }
            />
            <Route
              path="/attendance/:employeeId"
              element={
                <RequireAuth>
                  <RequireOwnAttendance>
                    <AttendancePage />
                  </RequireOwnAttendance>
                </RequireAuth>
              }
            />
            <Route
              path="/upload-documents"
              element={
                <RequireAuth>
                  <RequireAdmin>
                    <UploadDocumentsPage />
                  </RequireAdmin>
                </RequireAuth>
              }
            />
          </Routes>
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  )
}
