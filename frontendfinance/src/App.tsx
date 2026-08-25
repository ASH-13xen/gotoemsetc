import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'

import { AuthProvider } from '@/context/AuthContext'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { RequireFinanceAccess } from '@/components/auth/RequireFinanceAccess'
import LoginPage from '@/pages/LoginPage'
import FinancePage from '@/pages/FinancePage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

interface AppProps {
  // Set when mounted inside frontendall's shell (e.g. "/finance") so this
  // app's internal routes resolve under that prefix instead of the domain root.
  basename?: string
}

// Every route here is wrapped in RequireFinanceAccess, not just RequireAuth
// — like frontendop, this whole remote is admin/ceo/account_manager-only,
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
                  <RequireFinanceAccess>
                    <FinancePage />
                  </RequireFinanceAccess>
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
