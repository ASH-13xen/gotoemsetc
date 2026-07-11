import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/api/client'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { motion } from 'framer-motion'

interface DashboardStats {
  totalEmployees: number
  pendingUploadRequests: number
  documentsGeneratedThisMonth: number
  activeEmployees: number
  offboardedEmployees: number
}

async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await apiClient.get('/dashboard/stats')
  return data
}

async function getApplicantsCount(status?: string): Promise<number> {
  const params = status ? { status, limit: 1 } : { limit: 1 }
  const { data } = await apiClient.get('/applicants', { params })
  return data.total
}

function StatCard({ label, value }: { label: string; value: number | undefined }) {
  return (
    <Card className="bg-card/90 backdrop-blur-md p-6 rounded-2xl border border-border/10 shadow-diffuse hover:-translate-y-0.5 transition-all duration-300">
      <CardContent className="flex flex-col justify-between p-0">
        <div className="flex flex-col">
          {value === undefined ? (
            <Skeleton className="h-16 w-20 bg-secondary/40 rounded-xl" />
          ) : (
            <p className="text-6xl font-extrabold leading-none tracking-tighter text-foreground">
              {value}
            </p>
          )}
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()

  const { data: stats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: getDashboardStats,
  })

  const { data: totalApplicants } = useQuery({
    queryKey: ['applicantsCount', 'all'],
    queryFn: () => getApplicantsCount(),
  })

  const { data: upcomingMeetings } = useQuery({
    queryKey: ['applicantsCount', 'interview_scheduled'],
    queryFn: () => getApplicantsCount('interview_scheduled'),
  })

  return (
    <div className="space-y-8 py-4">
      <div>
        <h1 className="text-3xl font-light tracking-tight text-foreground/90">
          Welcome, <span className="font-semibold text-primary">{user?.username}</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Here is a quick snapshot of the telemetry metrics, summary reports, and active recruitment pipelines.
        </p>
      </div>

      {/* STATS PANEL */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="grid gap-6 grid-cols-2 md:grid-cols-4"
      >
        <StatCard label="Total applicants" value={totalApplicants} />
        <StatCard label="Upcoming meetings" value={upcomingMeetings} />
        <StatCard label="Active employees" value={stats?.activeEmployees} />
        <StatCard label="Offboarded employees" value={stats?.offboardedEmployees} />
      </motion.div>

      {/* Placeholder container for future widgets */}
      <div className="min-h-[300px] rounded-2xl border border-dashed border-border/60 bg-secondary/15 flex items-center justify-center p-8">
        <span className="text-sm text-muted-foreground font-medium uppercase tracking-widest">
          Widget Workspace Placeholder
        </span>
      </div>
    </div>
  )
}
