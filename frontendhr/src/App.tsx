import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'

import { AuthProvider } from '@/context/AuthContext'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { RequireHrAccess } from '@/components/auth/RequireHrAccess'
import LoginPage from '@/pages/LoginPage'
import HrWorkPage from '@/pages/HrWorkPage'
import LeaveApplicationsPage from '@/pages/LeaveApplicationsPage'
import SalarySlipsBulkPage from '@/pages/SalarySlipsBulkPage'
import AttendanceOverviewPage from '@/pages/AttendanceOverviewPage'
import DocumentsOverviewPage from '@/pages/DocumentsOverviewPage'
import InventoryReportPage from '@/pages/InventoryReportPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

interface AppProps {
  // Set when mounted inside frontendall's shell (e.g. "/hr") so this app's
  // internal routes resolve under that prefix instead of the domain root.
  basename?: string
}

// Every route here is wrapped in RequireHrAccess, not just RequireAuth —
// unlike frontendems/frontendsales, this whole remote is admin/hr/ceo-only,
// there's no self-service surface to fall back to for anyone else.
export default function App({ basename }: AppProps = {}) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename={basename}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <RequireHrAccess>
                    <HrWorkPage />
                  </RequireHrAccess>
                </RequireAuth>
              }
            />
            <Route
              path="/leave-applications"
              element={
                <RequireAuth>
                  <RequireHrAccess>
                    <LeaveApplicationsPage />
                  </RequireHrAccess>
                </RequireAuth>
              }
            />
            <Route
              path="/salary-slips/bulk"
              element={
                <RequireAuth>
                  <RequireHrAccess>
                    <SalarySlipsBulkPage />
                  </RequireHrAccess>
                </RequireAuth>
              }
            />
            <Route
              path="/attendance/overview"
              element={
                <RequireAuth>
                  <RequireHrAccess>
                    <AttendanceOverviewPage />
                  </RequireHrAccess>
                </RequireAuth>
              }
            />
            <Route
              path="/documents/overview"
              element={
                <RequireAuth>
                  <RequireHrAccess>
                    <DocumentsOverviewPage />
                  </RequireHrAccess>
                </RequireAuth>
              }
            />
            <Route
              path="/inventory"
              element={
                <RequireAuth>
                  <RequireHrAccess>
                    <InventoryReportPage />
                  </RequireHrAccess>
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
