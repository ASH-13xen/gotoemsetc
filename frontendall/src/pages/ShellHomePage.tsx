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
        <h1 className="text-3xl font-black tracking-tighter uppercase">Welcome, {user?.username}</h1>
        <div className="grid gap-4 md:grid-cols-3">
          {SECTIONS.map((s) => (
            <Link key={s.to} to={s.to}>
              <Card className="h-full transition-colors hover:bg-accent/50">
                <CardHeader>
                  <CardTitle className="uppercase tracking-widest">{s.title}</CardTitle>
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
