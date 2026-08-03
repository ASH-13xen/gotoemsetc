import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AuthProvider } from '@/context/AuthContext'
import { RequireAuth } from '@/components/auth/RequireAuth'
import LoginPage from '@/pages/LoginPage'
import TaskListPage from '@/pages/TaskListPage'
import ReviewTasksPage from '@/pages/ReviewTasksPage'
import TaskDetailPage from '@/pages/TaskDetailPage'
import WorkTeamsPage from '@/pages/WorkTeamsPage'
import TaskClientsPage from '@/pages/TaskClientsPage'
import TaskEventsPage from '@/pages/TaskEventsPage'

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
              <Route path="/" element={<Navigate to="/tasks" replace />} />

              <Route path="/tasks" element={<RequireAuth><TaskListPage /></RequireAuth>} />
              <Route path="/review" element={<RequireAuth><ReviewTasksPage /></RequireAuth>} />
              <Route path="/tasks/:id" element={<RequireAuth><TaskDetailPage /></RequireAuth>} />

              <Route path="/teams" element={<RequireAuth><WorkTeamsPage /></RequireAuth>} />
              <Route path="/clients" element={<RequireAuth><TaskClientsPage /></RequireAuth>} />
              <Route path="/events" element={<RequireAuth><TaskEventsPage /></RequireAuth>} />
            </Routes>
          </BrowserRouter>
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
