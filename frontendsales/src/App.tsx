import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AuthProvider } from '@/context/AuthContext'
import { RequireAuth } from '@/components/auth/RequireAuth'
import LoginPage from '@/pages/LoginPage'
import ClientsPage from '@/pages/ClientsPage'
import ClientDetailPage from '@/pages/ClientDetailPage'
import CalendarPage from '@/pages/CalendarPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

interface AppProps {
  // Set when mounted inside frontendall's shell (e.g. "/sales") so this app's
  // internal routes resolve under that prefix instead of the domain root.
  basename?: string
}

// No role gate on the routes themselves: every logged-in employee may reach
// Client Management, and what they can see and do is narrowed per-client and
// per-team server-side (see backend utils/cmsAccess.js). A role check here
// couldn't express "your own team's clients only".
export default function App({ basename }: AppProps = {}) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter basename={basename}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/"
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
                path="/calendars/:id"
                element={
                  <RequireAuth>
                    <CalendarPage />
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
