import { useMemo, useState } from 'react'
import { Flag, Trophy } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useFlagHistory } from '@/hooks/useEmployees'
import type { FlagColor } from '@/api/employees.api'

// Read-only history of every red/green performance flag ever recorded
// (flags themselves are still added/removed from an employee's profile in
// EMS — see frontendems/src/components/employees/EmployeeFlags.tsx). Milestone
// notifications (3 red; 3/6/10 green) fire server-side the moment a flag is
// added — see backend/src/services/employee.service.js#notifyFlagMilestone.
export default function PerformanceFlagsPage() {
  const { data, isLoading } = useFlagHistory()
  const entries = data?.entries ?? []
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

  const filtered = entries.filter(
    (e) => (employeeId === 'all' || e.employeeId === employeeId) && (color === 'all' || e.color === color)
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance Flags"
        description="History of every red/green performance marker, across every employee."
      />

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry) => (
                <TableRow key={entry._id}>
                  <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                  <TableCell className="font-semibold">{entry.employeeName}</TableCell>
                  <TableCell>
                    {entry.color === 'green' ? (
                      <Badge variant="success">Green</Badge>
                    ) : (
                      <Badge variant="destructive">Red</Badge>
                    )}
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
