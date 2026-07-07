import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'

import { AuthProvider } from '@/context/AuthContext'
import { RequireAuth } from '@/components/auth/RequireAuth'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import EmployeeDetailPage from '@/pages/EmployeeDetailPage'
import EmployeeWizardPage from '@/pages/EmployeeWizardPage'
import PublicUploadPage from '@/pages/PublicUploadPage'
import ApplicantsPage from '@/pages/ApplicantsPage'
import ApplicantDetailPage from '@/pages/ApplicantDetailPage'
import AttendancePage from '@/pages/AttendancePage'

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
                  <DashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/employees/:id"
              element={
                <RequireAuth>
                  <EmployeeDetailPage />
                </RequireAuth>
              }
            />
            <Route
              path="/employees/:id/wizard"
              element={
                <RequireAuth>
                  <EmployeeWizardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/applicants"
              element={
                <RequireAuth>
                  <ApplicantsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/applicants/:id"
              element={
                <RequireAuth>
                  <ApplicantDetailPage />
                </RequireAuth>
              }
            />
            <Route
              path="/attendance"
              element={
                <RequireAuth>
                  <AttendancePage />
                </RequireAuth>
              }
            />
            <Route
              path="/attendance/:employeeId"
              element={
                <RequireAuth>
                  <AttendancePage />
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
