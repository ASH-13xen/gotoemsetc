import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Laptop, Package, Smartphone, Tablet, TriangleAlert } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { getHeldDevices, type HeldDevice } from '@/api/devices.api'

const ICON = { phone: Smartphone, laptop: Laptop, tablet: Tablet, other: Package }
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '—')
const CHECK: Record<string, { text: string; cls: string }> = {
  verified: { text: 'Checked this month', cls: 'bg-emerald-500/12 text-emerald-700' },
  submitted: { text: 'Check sent — waiting for HR', cls: 'bg-sky-500/12 text-sky-700' },
  rejected: { text: 'Check sent back — redo it', cls: 'bg-red-500/12 text-red-600' },
}

// The company devices this person holds (HR Work → Devices). The employee
// sees their own; HR also gets a link to each device in HR Work. Serials,
// IMEI, SIM ids, accounts and values are never shown here.
export function EmployeeDevices({ employeeId, isOwnRecord }: { employeeId: string; isOwnRecord: boolean }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['held-devices', employeeId], queryFn: () => getHeldDevices(employeeId), retry: false })
  if (isLoading) return <Skeleton className="h-16 w-full" />
  if (error || !data) return <p className="text-sm text-muted-foreground">Devices couldn't be loaded.</p>
  if (data.devices.length === 0) return <p className="text-sm text-muted-foreground">{isOwnRecord ? 'You have no company devices.' : 'No company devices with them.'}</p>
  return (
    <div className="grid gap-3">
      {data.devices.map((d: HeldDevice) => {
        const Icon = ICON[d.kind] || Package
        const check = d.monthCheck ? CHECK[d.monthCheck.status] : null
        return (
          <div key={d._id} className="flex flex-wrap items-start gap-3 rounded-xl border border-border bg-secondary/20 p-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {[d.brand, d.model].filter(Boolean).join(' ') || d.kind}
                <span className="ml-2 font-mono text-xs text-muted-foreground">{d.code}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                With {isOwnRecord ? 'you' : 'them'} since {fmt(d.assignedAt)}
                {d.color ? ` · ${d.color}` : ''}
                {d.accessories.length ? ` · ${d.accessories.join(', ')}` : ''}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {check ? (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${check.cls}`}>{check.text}</span>
                ) : (
                  <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Monthly check not sent yet</span>
                )}
                {d.openIssues > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                    <TriangleAlert className="size-3" />
                    {d.openIssues} open problem{d.openIssues === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </div>
            {data.canManage ? (
              <a href={`/hr/devices/${d._id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                Open in HR Work <ExternalLink className="size-3" />
              </a>
            ) : (
              isOwnRecord && (
                <a href="/my-devices" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                  Checks & uploads <ExternalLink className="size-3" />
                </a>
              )
            )}
          </div>
        )
      })}
    </div>
  )
}
