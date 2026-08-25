import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck2, CalendarClock, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePlanNextDay } from '@/hooks/useEmployeeTasks'
import type { UpcomingEmployeeTask } from '@/api/employeeTasks.api'

const TASK_TYPE_LABEL: Record<string, string> = {
  personal: 'Personal',
  team: 'Team',
  client: 'Client',
  event: 'Event',
}

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dismissKey() {
  return `plan-next-day-dismissed-${todayKey()}`
}

function TaskRow({ task }: { task: UpcomingEmployeeTask }) {
  const isOverdue = new Date(task.endAt) < new Date()
  const subtitle = task.client?.name ?? task.event?.name ?? task.team?.name
  return (
    <Link
      to="/followups"
      className="flex items-center justify-between gap-3 rounded-xl bg-secondary/30 p-3 hover:bg-secondary/50"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{task.title}</p>
        <p className="text-xs text-muted-foreground">
          {TASK_TYPE_LABEL[task.type]}
          {subtitle && ` · ${subtitle}`}
        </p>
      </div>
      <span
        className={`flex shrink-0 items-center gap-1 text-xs font-bold ${isOverdue ? 'text-destructive' : 'text-primary'}`}
      >
        <CalendarClock className="size-3" />
        {new Date(task.endAt).toLocaleDateString()}
      </span>
    </Link>
  )
}

function Bucket({ label, tasks }: { label: string; tasks: UpcomingEmployeeTask[] }) {
  if (tasks.length === 0) return null
  return (
    <div className="grid gap-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      {tasks.map((task) => (
        <TaskRow key={task._id} task={task} />
      ))}
    </div>
  )
}

// A 6:30pm-IST-and-later planning nudge — "what's overdue, what's due
// tomorrow" — for the employee themselves and, for a Team Main/Team Leader,
// every team they're responsible for. Dismissible for the rest of the day
// via localStorage; reappears fresh the next evening. Renders nothing before
// the gate time or once the board is genuinely clear, per
// planNextDay.service.js#getDigest.
export function PlanNextDayCard() {
  const { data } = usePlanNextDay()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(dismissKey()) === '1')

  const digest = data?.digest
  if (!digest || dismissed) return null

  return (
    <Card className="rounded-xl border border-primary/30 bg-primary/5 p-6">
      <CardContent className="p-0">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <CalendarCheck2 className="size-4 text-primary" />
            Plan tomorrow
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => {
              localStorage.setItem(dismissKey(), '1')
              setDismissed(true)
            }}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="mt-4 grid gap-4">
          <Bucket label="Overdue" tasks={digest.mine.overdue} />
          <Bucket label="Due tomorrow" tasks={digest.mine.tomorrow} />
          {digest.teams.map((teamDigest) => (
            <div key={teamDigest.team._id} className="grid gap-2 rounded-xl border border-border/60 p-3">
              <p className="text-xs font-bold text-foreground">{teamDigest.team.name}</p>
              <Bucket label="Overdue" tasks={teamDigest.overdue} />
              <Bucket label="Due tomorrow" tasks={teamDigest.tomorrow} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
