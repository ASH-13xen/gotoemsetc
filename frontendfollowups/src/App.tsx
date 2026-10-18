import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AuthProvider } from '@/context/AuthContext'
import { RequireAuth } from '@/components/auth/RequireAuth'
import LoginPage from '@/pages/LoginPage'
import TicketsBoardPage from '@/pages/TicketsBoardPage'
import TicketPage from '@/pages/TicketPage'
import SubmittedPage from '@/pages/SubmittedPage'
import AnalysisPage from '@/pages/AnalysisPage'
import { CalendarItemPage, StoriesPage } from '@/pages/CalendarTicketPages'

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

// Task Management — tickets (see backend services/ticket.service.js). The
// old personal/team/event task screens were replaced; their records are
// untouched in the database.
export default function App({ basename }: AppProps = {}) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter basename={basename}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Navigate to="/tickets" replace />} />

              <Route path="/tickets" element={<RequireAuth><TicketsBoardPage /></RequireAuth>} />
              <Route path="/tickets/:id" element={<RequireAuth><TicketPage /></RequireAuth>} />
              <Route path="/calendar/items/:id" element={<RequireAuth><CalendarItemPage /></RequireAuth>} />
              <Route path="/calendar/stories/:id" element={<RequireAuth><StoriesPage /></RequireAuth>} />
              <Route path="/submitted" element={<RequireAuth><SubmittedPage /></RequireAuth>} />
              <Route path="/analysis" element={<RequireAuth><AnalysisPage /></RequireAuth>} />
              {/* Old task links land on the board. */}
              <Route path="*" element={<Navigate to="/tickets" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
