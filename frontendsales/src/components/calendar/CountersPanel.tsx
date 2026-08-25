import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CalendarView, ContentType } from '@/api/cms.api'

const TYPE_LABELS: Record<ContentType, string> = {
  post: 'Posts',
  reel: 'Reels',
  story: 'Daily stories',
  festive_story: 'Festive stories',
}

const STAGE_LEGEND: Array<[string, string]> = [
  ['Scheduled', '#f97316'],
  ['In progress', '#3b82f6'],
  ['Awaiting SMM', '#a855f7'],
  ['Awaiting lead', '#6366f1'],
  ['Awaiting client', '#eab308'],
  ['Client approved', '#22c55e'],
  ['Published', '#15803d'],
  ['Rejected', '#ef4444'],
  ['Overdue', '#6b7280'],
]

// Two numbers per type, not one. "Scheduled" and "delivered" answer different
// questions, and a month where everything is scheduled but nothing finished
// must not read as complete.
//
// Denominators are the plan's own strings ("6-8") shown verbatim — the range
// is what the client was actually promised. Numerators can exceed them, which
// is over-delivery rather than an error.
export function CountersPanel({ view }: { view: CalendarView }) {
  const { counters } = view

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pt-6">
          <CardTitle className="text-base">This month</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pb-6">
          {(Object.keys(TYPE_LABELS) as ContentType[]).map((type) => {
            const counter = counters[type]
            if (!counter) return null

            const over = counter.scheduled > Number(counter.denominator.split('-').pop())

            return (
              <div key={type} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{TYPE_LABELS[type]}</span>
                  {counter.perDayLabel && (
                    <span className="text-xs text-muted-foreground">
                      {counter.perDayLabel} / day
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-4 text-sm tabular-nums">
                  <span className={over ? 'text-amber-600 dark:text-amber-400' : ''}>
                    <span className="font-semibold">{counter.scheduled}</span>
                    <span className="text-muted-foreground">/{counter.denominator}</span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      {counter.unit === 'days' ? 'days covered' : 'scheduled'}
                    </span>
                  </span>
                  <span>
                    <span className="font-semibold">{counter.delivered}</span>
                    <span className="text-muted-foreground">/{counter.denominator}</span>
                    <span className="ml-1 text-xs text-muted-foreground">delivered</span>
                  </span>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pt-6">
          <CardTitle className="text-base">Colour key</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 pb-6">
          {STAGE_LEGEND.map(([label, color]) => (
            <div key={label} className="flex items-center gap-2 text-xs">
              <span className="size-3 shrink-0 rounded" style={{ backgroundColor: color }} />
              <span className="text-muted-foreground">{label}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
