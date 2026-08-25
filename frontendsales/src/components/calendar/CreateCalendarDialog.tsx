import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateCalendar } from '@/hooks/useCms'
import type { Calendar, Client } from '@/api/cms.api'
import { MONTH_NAMES, istToday } from '@/lib/istDate'

export function CreateCalendarDialog({
  open,
  onOpenChange,
  client,
  existing,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: Client
  existing: Calendar[]
}) {
  const navigate = useNavigate()
  const today = istToday()
  const createCalendar = useCreateCalendar(client._id)

  const [month, setMonth] = useState(String(today.month))
  const [year, setYear] = useState(String(today.year))
  const [generateDailyStories, setGenerateDailyStories] = useState(true)

  const years = [today.year - 1, today.year, today.year + 1]
  const taken = new Set(existing.map((c) => `${c.year}-${c.month}`))
  const alreadyExists = taken.has(`${year}-${Number(month)}`)

  const blockers: string[] = []
  if (!client.currentPlan) blockers.push('Pick a plan for this client first.')
  if (!client.defaultTeam) blockers.push('Assign a team to this client first.')

  function submit() {
    createCalendar.mutate(
      {
        client: client._id,
        year: Number(year),
        month: Number(month),
        generateDailyStories,
      },
      {
        onSuccess: (calendar) => {
          onOpenChange(false)
          navigate(`/calendars/${calendar._id}`)
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New content calendar</DialogTitle>
          <DialogDescription>
            The plan and team are recorded on the calendar as they stand today, and stay fixed for
            that month.
          </DialogDescription>
        </DialogHeader>

        {blockers.length > 0 ? (
          <ul className="space-y-1 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Month</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, i) => (
                      <SelectItem key={name} value={String(i + 1)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-border/40 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={generateDailyStories}
                onChange={(e) => setGenerateDailyStories(e.target.checked)}
              />
              <span>
                <span className="font-medium">Generate daily stories</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Creates one story task per day of the month for the team's social media manager.
                  The plan's per-day count ({client.currentPlan}) is what each day covers.
                </span>
              </span>
            </label>

            <div className="rounded-xl bg-secondary/60 p-3 text-xs text-muted-foreground">
              Plan <span className="font-medium uppercase">{client.currentPlan}</span> · Team{' '}
              <span className="font-medium">{client.defaultTeam?.name}</span>
              {!(client.defaultTeam?.memberRoles ?? []).some((r) => r.roles.includes('social_media_manager')) && (
                <span className="mt-1 block text-amber-600 dark:text-amber-400">
                  This team has nobody tagged Social Media Manager — daily stories will go to Team
                  Main instead.
                </span>
              )}
            </div>

            {alreadyExists && (
              <p className="text-sm text-destructive">
                A calendar for {MONTH_NAMES[Number(month) - 1]} {year} already exists.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={blockers.length > 0 || alreadyExists || createCalendar.isPending}
          >
            {createCalendar.isPending ? 'Creating…' : 'Create calendar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
