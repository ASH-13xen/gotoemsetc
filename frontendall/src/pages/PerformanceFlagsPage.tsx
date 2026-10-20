import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Flag, Loader2, Search, Trophy } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/hooks/useAuth'
import { can } from '@/lib/access'
import { cn } from '@/lib/utils'
import { useFlagHistory, useFlagPeople, useFlagsGiven, useGiveFlag } from '@/hooks/useEmployees'
import type { FlagColor, FlagHistoryEntry } from '@/api/employees.api'

// Performance flags. The CEO and admin see every flag ever recorded (with
// who gave it); coordinators — marked on the Organisation chart — and every
// team's Content Manager can give a flag to anyone and see the ones they gave. Whoever receives a flag sees it
// as an announcement (colour and note only). Milestone notifications (3 red;
// 3/6/10 green) fire server-side — employee.service.js#notifyFlagMilestone.
export default function PerformanceFlagsPage() {
  const { user } = useAuth()
  const seesAll = can(user, 'performance_flags')
  const history = useFlagHistory(seesAll)
  const given = useFlagsGiven(!seesAll)
  const { data, isLoading } = seesAll ? history : given
  const entries = data?.entries ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance Flags"
        description={
          seesAll
            ? 'Give a red or green flag, and the history of every flag across every employee.'
            : 'You can give a red or green flag to anyone. The person sees it as an announcement — not who gave it.'
        }
      />
      <GiveFlagCard />
      {seesAll ? <FullHistory entries={entries} isLoading={isLoading} /> : <GivenList entries={entries} isLoading={isLoading} />}
    </div>
  )
}

function GiveFlagCard() {
  const { data } = useFlagPeople()
  const give = useGiveFlag()
  const [query, setQuery] = useState('')
  const [person, setPerson] = useState<string | null>(null)
  const [color, setColor] = useState<FlagColor>('green')
  const [note, setNote] = useState('')
  const people = (data?.people ?? []).filter((p) => !query.trim() || `${p.name} ${p.designation} ${p.employeeCode}`.toLowerCase().includes(query.trim().toLowerCase()))
  const chosen = data?.people.find((p) => p._id === person)

  const submit = () => {
    if (!person) return toast.error('Pick who the flag is for')
    if (!note.trim()) return toast.error('Write why — they will see this note')
    give.mutate(
      { employeeId: person, color, note: note.trim() },
      {
        onSuccess: () => {
          toast.success(`${color === 'green' ? 'Green' : 'Red'} flag given to ${chosen?.name ?? 'them'} — they'll see it as an announcement`)
          setNote('')
          setPerson(null)
          setQuery('')
        },
        onError: (err) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not give the flag'),
      }
    )
  }

  return (
    <Card className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="grid content-start gap-2">
        <p className="text-sm font-bold text-foreground">Give a flag</p>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people…"
            aria-label="Search people"
            className="h-9 w-full rounded-xl border border-border bg-background pr-3 pl-8 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="max-h-56 overflow-y-auto rounded-xl border border-border p-1">
          {people.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">No one matches.</p>
          ) : (
            people.map((p) => (
              <button
                key={p._id}
                type="button"
                onClick={() => setPerson(p._id)}
                className={cn('flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm', person === p._id ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-secondary')}
              >
                <span className="truncate capitalize">{p.name.toLowerCase()}</span>
                <span className="shrink-0 truncate text-[11px] text-muted-foreground">{p.designation}</span>
              </button>
            ))
          )}
        </div>
      </div>
      <div className="grid content-start gap-3">
        <p className="text-sm text-muted-foreground">
          {chosen ? (
            <>
              For <b className="text-foreground capitalize">{chosen.name.toLowerCase()}</b>
            </>
          ) : (
            'Pick someone on the left.'
          )}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(['green', 'red'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-bold transition-colors',
                color === c
                  ? c === 'green'
                    ? 'border-emerald-500 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                    : 'border-red-500 bg-red-500/12 text-red-700 dark:text-red-300'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {c === 'green' ? <Trophy className="size-4" /> : <Flag className="size-4" />}
              {c === 'green' ? 'Green flag' : 'Red flag'}
            </button>
          ))}
        </div>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Why? (they will see this note)" aria-label="Note" />
        <Button onClick={submit} disabled={give.isPending} className="justify-self-end">
          {give.isPending && <Loader2 className="size-4 animate-spin" />}
          Give {color} flag
        </Button>
      </div>
    </Card>
  )
}

function ColorBadge({ color }: { color: FlagColor }) {
  return color === 'green' ? <Badge variant="success">Green</Badge> : <Badge variant="destructive">Red</Badge>
}

function GivenList({ entries, isLoading }: { entries: FlagHistoryEntry[]; isLoading: boolean }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-foreground">Flags you gave</p>
      <div className="overflow-hidden rounded-xl border border-border">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">You haven't given any flags yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry._id}>
                  <TableCell>{new Date(entry.date).toLocaleDateString('en-IN')}</TableCell>
                  <TableCell className="font-semibold capitalize">{entry.employeeName.toLowerCase()}</TableCell>
                  <TableCell>
                    <ColorBadge color={entry.color} />
                  </TableCell>
                  <TableCell className="whitespace-normal">{entry.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

function FullHistory({ entries, isLoading }: { entries: FlagHistoryEntry[]; isLoading: boolean }) {
  const [employeeId, setEmployeeId] = useState<string>('all')
  const [color, setColor] = useState<FlagColor | 'all'>('all')

  const employees = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of entries) map.set(e.employeeId, e.employeeName)
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [entries])

  const tallies = useMemo(() => {
    const map = new Map<string, { employeeName: string; green: number; red: number }>()
    for (const e of entries) {
      const bucket = map.get(e.employeeId) || { employeeName: e.employeeName, green: 0, red: 0 }
      if (e.color === 'green') bucket.green += 1
      else bucket.red += 1
      map.set(e.employeeId, bucket)
    }
    return [...map.values()].sort((a, b) => b.red - a.red || b.green - a.green)
  }, [entries])

  const filtered = entries.filter((e) => (employeeId === 'all' || e.employeeId === employeeId) && (color === 'all' || e.color === color))

  return (
    <>
      {tallies.length > 0 && (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Green</TableHead>
                <TableHead>Red</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tallies.map((t) => (
                <TableRow key={t.employeeName}>
                  <TableCell className="font-semibold">{t.employeeName}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <Trophy className="size-3.5 fill-current" />
                      {t.green}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-red-600">
                      <Flag className="size-3.5 fill-current" />
                      {t.red}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Select value={employeeId} onValueChange={setEmployeeId}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All employees</SelectItem>
            {employees.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={color} onValueChange={(v) => setColor(v as FlagColor | 'all')}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All colors</SelectItem>
            <SelectItem value="green">Green</SelectItem>
            <SelectItem value="red">Red</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">No flags recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Given by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry) => (
                <TableRow key={entry._id}>
                  <TableCell>{new Date(entry.date).toLocaleDateString('en-IN')}</TableCell>
                  <TableCell className="font-semibold">{entry.employeeName}</TableCell>
                  <TableCell>
                    <ColorBadge color={entry.color} />
                  </TableCell>
                  <TableCell className="whitespace-normal">{entry.note}</TableCell>
                  <TableCell className="text-muted-foreground capitalize">{entry.addedByName?.toLowerCase() ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  )
}
