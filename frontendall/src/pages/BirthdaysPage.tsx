import { useMemo, useState } from 'react'
import { Cake, PartyPopper } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useBirthdays } from '@/hooks/useBirthdays'
import { BirthdayCalendar } from '@/components/birthdays/BirthdayCalendar'
import {
  daysUntil,
  formatMonthDay,
  groupByMonthDay,
  nextOccurrence,
  toBirthdayEntries,
} from '@/lib/birthdays'

export default function BirthdaysPage() {
  const { data, isLoading } = useBirthdays()
  const [month, setMonth] = useState(() => new Date())

  const entries = useMemo(() => toBirthdayEntries(data?.employees ?? []), [data])
  const byDay = useMemo(() => groupByMonthDay(entries), [entries])

  const upcoming = useMemo(() => {
    const today = new Date()
    return entries
      .map((e) => ({ ...e, next: nextOccurrence(e.dob, today) }))
      .sort((a, b) => a.next.getTime() - b.next.getTime())
      .slice(0, 10)
  }, [entries])

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Skeleton className="h-96 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <BirthdayCalendar month={month} onMonthChange={setMonth} birthdaysByDay={byDay} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PartyPopper className="size-4 text-amber-600" />
            Upcoming birthdays
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No birthdays on file yet.</p>
          ) : (
            upcoming.map((e) => {
              const days = daysUntil(e.next, new Date())
              return (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-secondary/30 p-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Cake className="size-4 shrink-0 text-amber-600" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{e.name}</p>
                      <p className="text-xs text-muted-foreground">{formatMonthDay(e.dob)}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-primary">
                    {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`}
                  </span>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
