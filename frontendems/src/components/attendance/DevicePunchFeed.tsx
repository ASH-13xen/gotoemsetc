import { useMemo, useState } from 'react'
import { Fingerprint } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useDevicePunches } from '@/hooks/useDevicePunches'
import { cn } from '@/lib/utils'
import type { DevicePunch, ScanTimeCategory } from '@/api/devicePunches.api'

function todayDateInputValue() {
  return new Date().toISOString().slice(0, 10)
}

// Only the time chip is tinted, never the row — a normal scan keeps the
// plain grey chip.
const SCAN_CATEGORY_STYLE: Record<ScanTimeCategory, { label: string; chip: string; dot: string }> = {
  late: { label: 'Late', chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  short_leave: {
    label: 'Short Leave',
    chip: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
    dot: 'bg-orange-500',
  },
  half_day: { label: 'Half Day', chip: 'bg-red-500/15 text-red-700 dark:text-red-300', dot: 'bg-red-500' },
  absent: {
    label: 'Absent (after 2 PM)',
    chip: 'bg-rose-900/20 text-rose-900 dark:text-rose-300',
    dot: 'bg-rose-900',
  },
}

interface PunchGroup {
  key: string
  name: string
  matched: boolean
  punches: DevicePunch[]
}

// One row per person, not per scan — an employee who scanned in and out
// shows both timestamps together, instead of each scan landing in its own
// row wherever it falls in the flat chronological feed. Groups themselves
// stay ordered by that person's earliest scan of the day.
function groupByEmployee(punches: DevicePunch[]): PunchGroup[] {
  const groups = new Map<string, PunchGroup>()
  for (const punch of punches) {
    const key = punch.employee?._id ?? `unmatched:${punch.employeeCode}`
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        name: punch.employee
          ? `${punch.employee.firstName} ${punch.employee.lastName ?? ''}`.trim()
          : `Unmatched device ID "${punch.employeeCode}"`,
        matched: Boolean(punch.employee),
        punches: [],
      }
      groups.set(key, group)
    }
    group.punches.push(punch)
  }
  for (const group of groups.values()) {
    group.punches.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }
  return [...groups.values()].sort(
    (a, b) => new Date(a.punches[0].timestamp).getTime() - new Date(b.punches[0].timestamp).getTime()
  )
}

// Company-wide scan browser — pick a day, see every scan (matched or not)
// from that day only, across all employees. Not wired into the daily
// attendance mark/status; this is just "show me what the device sent".
export function DevicePunchFeed() {
  const [date, setDate] = useState(todayDateInputValue)
  const { data, isLoading } = useDevicePunches({ date })
  const punches = data?.punches ?? []
  const groups = useMemo(() => groupByEmployee(punches), [punches])

  return (
    <Card className="p-6">
      <CardHeader className="px-0 pt-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Fingerprint className="size-4 text-primary" />
            <CardTitle>Biometric device scans</CardTitle>
          </div>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 w-auto"
          />
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : punches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scans on this day.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {Object.values(SCAN_CATEGORY_STYLE).map((style) => (
                <span key={style.label} className="flex items-center gap-1.5">
                  <span className={cn('size-2 rounded-full', style.dot)} />
                  {style.label}
                </span>
              ))}
            </div>
            <div className="divide-y divide-border/10">
              {groups.map((group) => (
                <div key={group.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2.5 text-sm">
                  <span className={group.matched ? 'font-semibold text-foreground' : 'font-semibold text-muted-foreground'}>
                    {group.name}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {group.punches.map((punch) => (
                      <span
                        key={punch._id}
                        title={punch.timeCategory ? SCAN_CATEGORY_STYLE[punch.timeCategory].label : undefined}
                        className={cn(
                          'w-20 shrink-0 rounded-md py-0.5 text-center text-xs tabular-nums',
                          punch.timeCategory
                            ? cn('font-medium', SCAN_CATEGORY_STYLE[punch.timeCategory].chip)
                            : 'bg-secondary text-muted-foreground'
                        )}
                      >
                        {new Date(punch.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
