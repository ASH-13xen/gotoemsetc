import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'

import { AuthProvider } from '@/context/AuthContext'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { RequireOperationsAccess } from '@/components/auth/RequireOperationsAccess'
import LoginPage from '@/pages/LoginPage'
import OperationsPage from '@/pages/OperationsPage'
import ComplaintsPage from '@/pages/ComplaintsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

interface AppProps {
  // Set when mounted inside frontendall's shell (e.g. "/operations") so this
  // app's internal routes resolve under that prefix instead of the domain root.
  basename?: string
}

// Every route here is wrapped in RequireOperationsAccess, not just
// RequireAuth — unlike frontendems/frontendsales, this whole remote is
// admin/ceo/operations_manager-only, there's no self-service surface to
// fall back to for anyone else (HR included).
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
                  <RequireOperationsAccess>
                    <OperationsPage />
                  </RequireOperationsAccess>
                </RequireAuth>
              }
            />
            <Route
              path="/complaints"
              element={
                <RequireAuth>
                  <RequireOperationsAccess>
                    <ComplaintsPage />
                  </RequireOperationsAccess>
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
