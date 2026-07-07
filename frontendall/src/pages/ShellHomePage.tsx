import { Link } from 'react-router-dom'
import { ShellNav } from '@/components/layout/ShellNav'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'

const SECTIONS = [
  { to: '/ems', title: 'EMS', description: 'Employee management, attendance, applicants.' },
  { to: '/sales', title: 'Sales', description: 'Clients, quotations, contracts.' },
  { to: '/followups', title: 'Followups', description: 'Client pipeline, tasks, teams, meetings.' },
]

export default function ShellHomePage() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-background">
      <ShellNav />
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Welcome, {user?.username}</h1>
        <div className="grid gap-6 md:grid-cols-3">
          {SECTIONS.map((s) => (
            <Link key={s.to} to={s.to}>
              <Card className="h-full transition-all duration-300 hover:bg-card hover:shadow-md hover:-translate-y-0.5 border border-border">
                <CardHeader>
                  <CardTitle className="tracking-wide text-primary font-bold text-lg">{s.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{s.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
