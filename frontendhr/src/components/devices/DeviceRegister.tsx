import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, BatteryLow, HardDrive, Plus, Search, ShieldOff, Smartphone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { DEVICES_KEY, DeviceFormDialog } from './DeviceDialogs'
import {
  KIND_LABEL,
  STATUS_LABEL,
  appLabel,
  deviceName,
  devicesApi,
  partLabel,
  personName,
  securityLabel,
  type Device,
  type DeviceStatus,
  type Settings,
  type Summary,
} from '@/api/devices.api'

export const STATUS_VARIANT: Record<DeviceStatus, 'success' | 'default' | 'warning' | 'destructive' | 'outline'> = {
  available: 'success',
  assigned: 'default',
  repair: 'warning',
  lost: 'destructive',
  retired: 'outline',
}

// What stands out on a device right now, as small icons (the thresholds and
// app names from the Settings tab, when given).
export function DeviceFlags({ device, settings }: { device: Device; settings?: Pick<Settings, 'apps' | 'lowStoragePct' | 'lowBatteryPct'> }) {
  const c = device.condition
  const lowStorage = settings?.lowStoragePct ?? 15
  const lowBattery = settings?.lowBatteryPct ?? 80
  const items: { icon: React.ReactNode; title: string }[] = []
  if (c?.damaged?.length) items.push({ icon: <AlertTriangle className="size-3.5 text-destructive" />, title: `Damaged: ${c.damaged.map((k) => partLabel(device.kind, k)).join(', ')}` })
  if (c?.securityOff?.length) items.push({ icon: <ShieldOff className="size-3.5 text-destructive" />, title: `Security off: ${c.securityOff.map(securityLabel).join(', ')}` })
  if (c?.storageFreePct != null && c.storageFreePct < lowStorage) items.push({ icon: <HardDrive className="size-3.5 text-amber-600" />, title: `${c.storageFreePct}% storage free` })
  if (c?.batteryHealth != null && c.batteryHealth < lowBattery) items.push({ icon: <BatteryLow className="size-3.5 text-amber-600" />, title: `Battery ${c.batteryHealth}%` })
  if (c?.appsMissing?.length)
    items.push({ icon: <Smartphone className="size-3.5 text-amber-600" />, title: `Not installed or signed in: ${c.appsMissing.map((k) => appLabel(settings?.apps, k)).join(', ')}` })
  if (!items.length) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span className="flex gap-1.5">
      {items.map((i) => (
        <span key={i.title} title={i.title}>
          {i.icon}
        </span>
      ))}
    </span>
  )
}

function Stat({ label, value, tone, onClick, active }: { label: string; value: number | string; tone?: string; onClick?: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('rounded-xl border bg-card p-3 text-left transition-colors hover:bg-secondary/40', active ? 'border-primary ring-1 ring-primary' : 'border-border')}
    >
      <p className={cn('text-2xl font-black tabular-nums', tone)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </button>
  )
}

export function SummaryStrip({ summary, status, onStatus }: { summary?: Summary; status: string; onStatus: (s: string) => void }) {
  if (!summary) return <Skeleton className="h-20 w-full rounded-xl" />
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <Stat label="All devices" value={summary.total} onClick={() => onStatus('')} active={!status} />
      <Stat label="Available now" value={summary.counts.available} tone="text-emerald-600" onClick={() => onStatus('available')} active={status === 'available'} />
      <Stat label="With someone" value={summary.counts.assigned} tone="text-primary" onClick={() => onStatus('assigned')} active={status === 'assigned'} />
      <Stat label="Under repair" value={summary.counts.repair} tone="text-amber-600" onClick={() => onStatus('repair')} active={status === 'repair'} />
      <Stat label="Lost" value={summary.counts.lost} tone="text-destructive" onClick={() => onStatus('lost')} active={status === 'lost'} />
      <Stat label="Monthly checks overdue" value={summary.checksOverdue} tone={summary.checksOverdue ? 'text-amber-600' : undefined} />
    </div>
  )
}

export function RegisterTab({ summary }: { summary?: Summary }) {
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [kind, setKind] = useState('')
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const { data: settings } = useQuery({ queryKey: [...DEVICES_KEY, 'settings'], queryFn: devicesApi.settings })
  const { data: devices, isLoading } = useQuery({ queryKey: [...DEVICES_KEY, 'list', status, kind, q], queryFn: () => devicesApi.list({ status: status || undefined, kind: kind || undefined, q: q || undefined }) })

  return (
    <div className="grid gap-4">
      <SummaryStrip summary={summary} status={status} onStatus={setStatus} />
      {summary && Object.keys(summary.kinds).length > 0 && (
        <p className="text-xs text-muted-foreground">
          {Object.entries(summary.kinds)
            .map(([k, v]) => `${KIND_LABEL[k as keyof typeof KIND_LABEL] ?? k}s: ${v.available} available of ${v.total}`)
            .join(' · ')}
          {summary.accessories.length > 0 && ` · ${summary.accessories.map((a) => `${a.name}: ${a.inStock} in stock`).join(' · ')}`}
        </p>
      )}
      <Card className="gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Code, model, IMEI, serial or SIM number" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={kind || 'all'} onValueChange={(v) => setKind(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Every kind</SelectItem>
              {Object.entries(KIND_LABEL).map(([k, l]) => (
                <SelectItem key={k} value={k}>
                  {l}s
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Add device
          </Button>
        </div>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !devices?.length ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No devices here yet — add the company's phones and laptops to start.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>With</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>This month's check</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((d) => (
                  <TableRow key={d._id} className="cursor-pointer" onClick={() => navigate(`/devices/${d._id}`)}>
                    <TableCell className="font-mono text-xs font-semibold">{d.code}</TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{deviceName(d)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {KIND_LABEL[d.kind]}
                        {d.imei1 ? ` · IMEI ${d.imei1}` : d.serialNumber ? ` · ${d.serialNumber}` : ''}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[d.status]}>{STATUS_LABEL[d.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{d.holder ? personName(d.holder) : '—'}</TableCell>
                    <TableCell className="text-sm">
                      {d.condition?.grade ?? '—'}
                      {d.condition?.storageFreePct != null && <span className="ml-1 text-[11px] text-muted-foreground">{d.condition.storageFreePct}% free</span>}
                    </TableCell>
                    <TableCell>
                      <DeviceFlags device={d} settings={settings} />
                    </TableCell>
                    <TableCell>
                      {d.status !== 'assigned' ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : d.monthCheck === 'verified' ? (
                        <Badge variant="success">Verified</Badge>
                      ) : d.monthCheck === 'submitted' ? (
                        <Badge variant="warning">To verify</Badge>
                      ) : d.checkOverdue ? (
                        <Badge variant="destructive">Overdue</Badge>
                      ) : (
                        <Badge variant="outline">Not yet</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
      {adding && <DeviceFormDialog open={adding} onOpenChange={setAdding} />}
    </div>
  )
}
