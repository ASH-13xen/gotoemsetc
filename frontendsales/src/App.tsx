import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AuthProvider } from '@/context/AuthContext'
import { RequireAuth } from '@/components/auth/RequireAuth'
import LoginPage from '@/pages/LoginPage'
import ClientsPage from '@/pages/ClientsPage'
import ClientDetailPage from '@/pages/ClientDetailPage'
import QuotationTemplatesPage from '@/pages/QuotationTemplatesPage'
import QuotationTemplateMapperPage from '@/pages/QuotationTemplateMapperPage'
import PublicQuotationPage from '@/pages/PublicQuotationPage'

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

export default function App({ basename }: AppProps = {}) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter basename={basename}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              {/* Public, share-token-gated signing link sent to clients — no login required. */}
              <Route path="/quotation/:token" element={<PublicQuotationPage />} />
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
                path="/quotation-templates"
                element={
                  <RequireAuth>
                    <QuotationTemplatesPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/quotation-templates/:id"
                element={
                  <RequireAuth>
                    <QuotationTemplateMapperPage />
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
