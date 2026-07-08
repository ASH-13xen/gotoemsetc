import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AuthProvider } from '@/context/AuthContext'
import { RequireAuth } from '@/components/auth/RequireAuth'
import LoginPage from '@/pages/LoginPage'
import ClientsPage from '@/pages/ClientsPage'
import ClientDetailPage from '@/pages/ClientDetailPage'
import TeamsPage from '@/pages/TeamsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

interface AppProps {
  // Set when mounted inside frontendall's shell (e.g. "/followups") so this
  // app's internal routes resolve under that prefix instead of the domain root.
  basename?: string
}

export default function App({ basename }: AppProps = {}) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter basename={basename}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Navigate to="/clients" replace />} />
              <Route
                path="/clients"
                element={
                  <RequireAuth>
                    <ClientsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/clients/:id"
                element={
                  <RequireAuth>
                    <ClientDetailPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/teams"
                element={
                  <RequireAuth>
                    <TeamsPage />
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
