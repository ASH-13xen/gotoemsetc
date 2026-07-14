import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { NavBar } from '@/components/layout/NavBar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useContentCalendar } from '@/hooks/useTaskDashboard'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}
function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

export default function ContentCalendarPage() {
  const navigate = useNavigate()
  const [month, setMonth] = useState(() => new Date())
  const from = startOfMonth(month)
  const to = endOfMonth(month)

  const { data, isLoading } = useContentCalendar(from.toISOString(), to.toISOString())
  const tasks = data?.tasks ?? []

  const byDay = useMemo(() => {
    const map = new Map<string, { label: string; clientName: string; taskId: string; clientId: string }[]>()
    for (const task of tasks) {
      const clientId = typeof task.client === 'string' ? task.client : task.client._id
      const clientName = typeof task.client === 'string' ? '' : task.client.clientName
      for (const step of task.steps) {
        if (!step.dueDate) continue
        const key = step.dueDate.slice(0, 10)
        const list = map.get(key) ?? []
        list.push({ label: `${task.itemLabel} — ${step.label}`, clientName, taskId: task._id, clientId })
        map.set(key, list)
      }
    }
    return map
  }, [tasks])

  const startOffset = from.getDay()
  const daysInMonth = to.getDate()
  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-5xl space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black tracking-tighter uppercase">Content Calendar</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="w-36 text-center text-sm font-semibold">
              {month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </span>
            <Button variant="outline" size="icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-[600px] w-full" />
        ) : (
          <div className="grid gap-1">
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted-foreground">
              {WEEKDAYS.map((d, i) => (
                <div key={i}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (day === null) return <div key={i} className="min-h-24 rounded-lg" />
                const key = new Date(month.getFullYear(), month.getMonth(), day).toISOString().slice(0, 10)
                const entries = byDay.get(key) ?? []
                return (
                  <div key={i} className="min-h-24 rounded-lg border border-border bg-card p-1.5">
                    <span className="text-xs text-muted-foreground">{day}</span>
                    <div className="mt-1 grid gap-1">
                      {entries.slice(0, 3).map((e, idx) => (
                        <button
                          key={idx}
                          onClick={() => navigate(`/clients/${e.clientId}`)}
                          className="truncate rounded bg-primary/10 px-1.5 py-0.5 text-left text-[10px] font-medium text-primary hover:bg-primary/20"
                          title={`${e.clientName}: ${e.label}`}
                        >
                          {e.label}
                        </button>
                      ))}
                      {entries.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{entries.length - 3} more</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
