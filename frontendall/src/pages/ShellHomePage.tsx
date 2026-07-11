import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'

const SECTIONS = [
  { to: '/ems', title: 'Employee Management (EMS)', description: 'Manage employee directories, tracks attendance, review profiles, and view incoming applicant files.' },
  { to: '/sales', title: 'Sales Operations', description: 'Monitor active clients, prepare quotations, and streamline contract approvals.' },
  { to: '/followups', title: 'Pipeline & Followups', description: 'Coordinate tasks, organize team meetings, and monitor client progression pipelines.' },
]

export default function ShellHomePage() {
  const { user } = useAuth()

  return (
    <div className="space-y-8 py-4">
      <div>
        <h1 className="text-3xl font-light tracking-tight text-foreground/90">
          Welcome back, <span className="font-semibold text-primary">{user?.username}</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Select a workspace module below to manage your operations.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link key={s.to} to={s.to} className="group">
            <Card className="h-full p-4 hover:shadow-glow hover:bg-card transition-all duration-300">
              <CardHeader className="p-0">
                <CardTitle className="text-lg font-bold tracking-wide text-foreground/80 group-hover:text-primary transition-colors">
                  {s.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 mt-3">
                <p className="text-sm text-muted-foreground/80 leading-relaxed">
                  {s.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
