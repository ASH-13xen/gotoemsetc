import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, ExternalLink, FileText, FileUp, Loader2 } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { AssignDialog, DEVICES_KEY, DeviceFormDialog, HrCheckDialog, LostDialog, ReturnDialog } from '@/components/devices/DeviceDialogs'
import { STATUS_VARIANT } from '@/components/devices/DeviceRegister'
import { CheckView, RunbookCard } from '@/components/devices/DeviceQueues'
import {
  ACCOUNT_LABEL,
  GENUINE_PARTS,
  GRADE_LABEL,
  ISSUE_LABEL,
  KIND_LABEL,
  STATUS_LABEL,
  apiMessage,
  appLabel,
  deviceName,
  devicesApi,
  openBlob,
  partLabel,
  personName,
  securityLabel,
  type Assignment,
  type Device,
} from '@/api/devices.api'

const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const money = (n?: number) => (n != null ? `₹${n.toLocaleString('en-IN')}` : '—')
const CHECK_KIND_LABEL = { handover: 'Handover', return: 'Return', monthly: 'Monthly', adhoc: 'HR check' } as const

type DialogKey = 'edit' | 'assign' | 'return' | 'lost' | 'check' | 'issue' | null

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        {action}
      </div>
      {children}
    </Card>
  )
}

function Fact({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm">{value || '—'}</p>
    </div>
  )
}

function IssueDialog({ open, onOpenChange, device }: { open: boolean; onOpenChange: (v: boolean) => void; device: Device }) {
  const queryClient = useQueryClient()
  const [category, setCategory] = useState('storage')
  const [description, setDescription] = useState('')
  const save = useMutation({
    mutationFn: () => devicesApi.reportIssue(device._id, { category, description }),
    onSuccess: () => {
      toast.success('Logged')
      queryClient.invalidateQueries({ queryKey: DEVICES_KEY })
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiMessage(err, 'Could not log')),
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a problem with {device.code}</DialogTitle>
          <DialogDescription>It stays on the device's record, so repeat problems show.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ISSUE_LABEL).map(([k, l]) => (
                <SelectItem key={k} value={k}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is happening?" />
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            Log it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// The agreement / receipt: print it, then keep the signed copy.
function Paper({ assignment, which }: { assignment: Assignment; which: 'agreement' | 'receipt' }) {
  const queryClient = useQueryClient()
  const signed = which === 'agreement' ? assignment.signedAgreement : assignment.signedReceipt
  const upload = useMutation({
    mutationFn: (file: File) => devicesApi.uploadSigned(assignment._id, which, file),
    onSuccess: () => {
      toast.success('Signed copy kept')
      queryClient.invalidateQueries({ queryKey: DEVICES_KEY })
    },
    onError: (err) => toast.error(apiMessage(err, 'Could not upload')),
  })
  const label = which === 'agreement' ? 'Handover agreement' : 'Return receipt'
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-secondary/30 px-3 py-2 text-sm">
      <FileText className="size-4 text-muted-foreground" />
      <span className="font-medium">{label}</span>
      {signed ? <Badge variant="success">Signed copy on file</Badge> : <Badge variant="warning">Not signed yet</Badge>}
      <span className="ml-auto flex flex-wrap gap-1">
        <Button size="sm" variant="ghost" className="h-7" onClick={() => openBlob(() => devicesApi.document(assignment._id, which)).catch(() => toast.error('Could not open'))}>
          <ExternalLink className="size-3.5" /> Print
        </Button>
        {signed && (
          <Button size="sm" variant="ghost" className="h-7" onClick={() => openBlob(() => devicesApi.file(signed))}>
            Signed copy
          </Button>
        )}
        <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-medium hover:bg-secondary">
          {upload.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <FileUp className="size-3.5" />}
          {signed ? 'Replace' : 'Upload signed'}
          <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
        </label>
      </span>
    </div>
  )
}

function Recovery({ assignment }: { assignment: Assignment }) {
  const queryClient = useQueryClient()
  const waive = useMutation({
    mutationFn: (note: string) => devicesApi.waive(assignment._id, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEVICES_KEY }),
    onError: (err) => toast.error(apiMessage(err, 'Could not waive')),
  })
  if (!assignment.recoveryAmount) return null
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span>
        To recover: <b>{money(assignment.recoveryAmount)}</b>
        {assignment.recoveryNote ? ` — ${assignment.recoveryNote}` : ''}
      </span>
      {assignment.recoverySettledIn ? (
        <Badge variant="success">Recovered in their full & final</Badge>
      ) : assignment.recoveryWaivedAt ? (
        <Badge variant="outline">Waived {fmt(assignment.recoveryWaivedAt)}</Badge>
      ) : (
        <>
          <Badge variant="warning">Comes off their full & final</Badge>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => {
              const note = window.prompt('Waive this recovery? Why?')
              if (note !== null) waive.mutate(note)
            }}
          >
            Waive
          </Button>
        </>
      )}
    </div>
  )
}

export default function DeviceDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<DialogKey>(null)
  const [openCheck, setOpenCheck] = useState<string | null>(null)
  const { data, isLoading, error } = useQuery({ queryKey: [...DEVICES_KEY, 'detail', id], queryFn: () => devicesApi.detail(id), enabled: Boolean(id) })
  const refresh = () => queryClient.invalidateQueries({ queryKey: DEVICES_KEY })
  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: refresh,
    onError: (err) => toast.error(apiMessage(err, 'Could not do that')),
  })
  const step = useMutation({
    mutationFn: ({ assignmentId, key, done }: { assignmentId: string; key: string; done: boolean }) => devicesApi.setStep(assignmentId, key, done),
    onSuccess: refresh,
  })

  if (isLoading) return <Skeleton className="mx-auto mt-8 h-96 max-w-6xl" />
  if (error || !data) return <p className="py-16 text-center text-sm text-muted-foreground">{apiMessage(error, 'Device not found')}</p>

  const { device, assignments, checks, issues, accounts, runbooks, footage, apps } = data
  const active = assignments.find((a) => a.status === 'active')
  const past = assignments.filter((a) => a.status !== 'active')
  const appState = new Map((device.apps ?? []).map((a) => [a.key, a]))
  const s = device.status

  const actions: ReactNode[] = []
  if (s === 'available') actions.push(<Button key="assign" onClick={() => setDialog('assign')}>Hand over</Button>)
  if (s === 'assigned')
    actions.push(
      <Button key="return" onClick={() => setDialog('return')}>
        Take back
      </Button>,
      <Button key="lost" variant="destructive" onClick={() => setDialog('lost')}>
        Mark lost
      </Button>
    )
  if (s === 'lost')
    actions.push(
      <Button key="found" onClick={() => window.confirm(`${device.code} is back with the company? Any unsettled recovery is waived.`) && act.mutate(() => devicesApi.found(device._id))}>
        Found it
      </Button>
    )
  if (s === 'available')
    actions.push(
      <Button key="repair" variant="outline" onClick={() => act.mutate(() => devicesApi.repair(device._id, false))}>
        Send to repair
      </Button>
    )
  if (s === 'repair')
    actions.push(
      <Button key="repaired" onClick={() => act.mutate(() => devicesApi.repair(device._id, true))}>
        Back from repair
      </Button>
    )
  if (s !== 'retired' && s !== 'lost')
    actions.push(
      <Button key="check" variant="outline" onClick={() => setDialog('check')}>
        Check now
      </Button>
    )
  if (s !== 'retired')
    actions.push(
      <Button key="issue" variant="outline" onClick={() => setDialog('issue')}>
        Log a problem
      </Button>
    )
  actions.push(
    <Button key="edit" variant="outline" onClick={() => setDialog('edit')}>
      Edit
    </Button>
  )
  // Never handed over, checked or logged against: added by mistake, so it
  // can go. Anything with a history is retired instead.
  const noHistory = !assignments.length && !checks.length && !issues.length && !runbooks.length && !footage.length
  if (noHistory)
    actions.push(
      <Button
        key="delete"
        variant="ghost"
        className="text-destructive"
        onClick={() =>
          window.confirm(`Delete ${device.code}? Use this only for a device added by mistake — it has no history, so nothing else is lost.`) &&
          act.mutate(() => devicesApi.remove(device._id).then(() => navigate('/devices')))
        }
      >
        Delete
      </Button>
    )
  if (!noHistory && (s === 'available' || s === 'repair' || s === 'lost'))
    actions.push(
      <Button key="retire" variant="ghost" className="text-destructive" onClick={() => window.confirm(`Retire ${device.code}? It leaves the register for good.`) && act.mutate(() => devicesApi.retire(device._id))}>
        Retire
      </Button>
    )

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 py-8">
      <Link to="/devices" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All devices
      </Link>
      <PageHeader eyebrow={`${KIND_LABEL[device.kind]} · ${device.code}`} title={deviceName(device)} actions={actions} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="The device">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_VARIANT[s]}>{STATUS_LABEL[s]}</Badge>
            {device.holder && <span className="text-sm">with {personName(device.holder)}</span>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Fact label="OS" value={[device.os === 'ios' ? 'iOS' : device.os === 'android' ? 'Android' : device.os, device.osVersion].filter(Boolean).join(' ')} />
            <Fact label="Colour" value={device.color} />
            <Fact label="IMEI" value={[device.imei1, device.imei2].filter(Boolean).join(' / ')} />
            <Fact label="Serial number" value={device.serialNumber} />
            {device.modelNumber && <Fact label="Model number" value={device.modelNumber} />}
            {device.meid && <Fact label="MEID" value={device.meid} />}
            {device.iccid && <Fact label="ICCID (SIM card)" value={device.iccid} />}
            {device.eid && <Fact label="EID (eSIM)" value={device.eid} />}
            <Fact label="Storage" value={device.storageGb ? `${device.storageGb} GB` : undefined} />
            <Fact label="SIM" value={[device.simProvider, device.simNumber].filter(Boolean).join(' · ')} />
            <Fact label="Bought" value={device.purchaseDate ? `${fmt(device.purchaseDate)}${device.vendor ? ` from ${device.vendor}` : ''}` : device.vendor} />
            <Fact label="Price / recovery if lost" value={`${money(device.purchasePrice)} / ${money(device.recoveryValue)}`} />
            <Fact label="Warranty until" value={device.warrantyUntil ? fmt(device.warrantyUntil) : undefined} />
          </div>
          {device.notes && <p className="text-xs text-muted-foreground">{device.notes}</p>}
        </Section>

        <Section title="Condition now">
          <div className="grid grid-cols-2 gap-3">
            <Fact label="Overall" value={device.condition?.grade ? GRADE_LABEL[device.condition.grade] : 'Not checked yet'} />
            <Fact label="Last checked" value={fmt(device.condition?.at)} />
            <Fact label="Storage free" value={device.condition?.storageFreePct != null ? `${device.condition.storageFreePct}%` : undefined} />
            <Fact label="Battery health" value={device.condition?.batteryHealth != null ? `${device.condition.batteryHealth}%` : undefined} />
          </div>
          {(device.condition?.damaged?.length ?? 0) > 0 && (
            <p className="text-xs text-destructive">Damaged or missing: {device.condition!.damaged!.map((k) => partLabel(device.kind, k)).join(', ')}</p>
          )}
          {(device.condition?.unknownParts?.length ?? 0) > 0 && (
            <p className="text-xs text-destructive">
              Not genuine ("Unknown part"): {device.condition!.unknownParts!.map((k) => GENUINE_PARTS.find((p) => p.key === k)?.label ?? k).join(', ')}
            </p>
          )}
          {(device.condition?.securityOff?.length ?? 0) > 0 && <p className="text-xs text-destructive">Security off: {device.condition!.securityOff!.map(securityLabel).join(', ')}</p>}
          {(device.condition?.appsMissing?.length ?? 0) > 0 && (
            <p className="text-xs text-amber-700">Not installed or signed in: {device.condition!.appsMissing!.map((k) => appLabel(apps, k)).join(', ')}</p>
          )}
        </Section>

        <Section title="Accounts on it">
          {!accounts.length ? (
            <p className="text-xs text-muted-foreground">None recorded — add its Apple ID / Gmail under Devices → Accounts.</p>
          ) : (
            <div className="grid grid-cols-1 gap-1.5">
              {accounts.map((a) => (
                <div key={a._id} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/30 px-3 py-1.5 text-sm">
                  <span className="min-w-0 truncate">
                    {a.identifier}
                    <span className="ml-1 text-[11px] text-muted-foreground">{ACCOUNT_LABEL[a.kind] ?? a.kind}</span>
                  </span>
                  {a.twoFactorOn ? <Badge variant="success">2-step on</Badge> : <Badge variant="destructive">2-step off</Badge>}
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {active && (
        <Section title={`With ${personName(active.employee)} since ${fmt(active.assignedAt)}`}>
          <p className="text-xs text-muted-foreground">
            Handed over by {active.assignedBy?.username ?? '—'} ·{' '}
            {active.acceptedAt ? `accepted by them on ${fmt(active.acceptedAt)}` : 'they have not accepted it on their dashboard yet'}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid content-start gap-1.5">
              <Label className="text-xs text-muted-foreground">Setting it up</Label>
              {active.setupSteps.map((st) => (
                <label key={st.key} className="flex items-start gap-2 rounded-lg bg-secondary/30 px-3 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-primary"
                    checked={Boolean(st.doneAt)}
                    onChange={(e) => step.mutate({ assignmentId: active._id, key: st.key, done: e.target.checked })}
                  />
                  <span className={cn(st.doneAt && 'text-muted-foreground line-through')}>{st.label}</span>
                </label>
              ))}
            </div>
            <div className="grid content-start gap-1.5">
              <Label className="text-xs text-muted-foreground">Accessories with it</Label>
              {!active.accessories.length ? (
                <p className="text-xs text-muted-foreground">None.</p>
              ) : (
                active.accessories.map((a) => (
                  <p key={a.accessory} className="rounded-lg bg-secondary/30 px-3 py-1.5 text-sm">
                    {a.label} × {a.qty}
                  </p>
                ))
              )}
              <Label className="mt-2 text-xs text-muted-foreground">Paperwork</Label>
              <Paper assignment={active} which="agreement" />
            </div>
          </div>
        </Section>
      )}

      {apps.length > 0 && (device.kind === 'phone' || device.kind === 'tablet') && (
        <Section title="Apps (from the last check)">
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => {
              const st = appState.get(app.key)
              const ok = st?.installed && st?.loggedIn
              return (
                <div key={app.key} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/30 px-3 py-1.5 text-sm">
                  <span>{app.label}</span>
                  {!st ? (
                    <span className="text-[11px] text-muted-foreground">not checked</span>
                  ) : ok ? (
                    <Badge variant="success">Signed in</Badge>
                  ) : st.installed ? (
                    <Badge variant="warning">Not signed in</Badge>
                  ) : (
                    <Badge variant={app.required ? 'destructive' : 'outline'}>Missing</Badge>
                  )}
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {runbooks.map((r) => (
        <RunbookCard key={r._id} runbook={r} />
      ))}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={`Checks (${checks.length})`}>
          {!checks.length ? (
            <p className="text-xs text-muted-foreground">No checks yet.</p>
          ) : (
            <div className="grid gap-1.5">
              {checks.map((c) => (
                <div key={c._id} className="rounded-lg border border-border">
                  <button type="button" className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-sm" onClick={() => setOpenCheck(openCheck === c._id ? null : c._id)}>
                    <span className="font-medium">{CHECK_KIND_LABEL[c.kind]}</span>
                    {c.month && <span className="text-xs text-muted-foreground">{c.month}</span>}
                    <span className="text-xs text-muted-foreground">
                      {fmt(c.createdAt)} · {c.byHolder ? personName(c.employee) : c.by?.username}
                    </span>
                    <span className="ml-auto flex gap-1">
                      {c.grade && <Badge variant="outline">{c.grade}</Badge>}
                      {c.status === 'submitted' ? <Badge variant="warning">To verify</Badge> : c.status === 'rejected' ? <Badge variant="destructive">Sent back</Badge> : <Badge variant="success">Verified</Badge>}
                    </span>
                  </button>
                  {openCheck === c._id && (
                    <div className="border-t border-border px-3 py-2">
                      <CheckView check={c} kind={device.kind} />
                      {c.reviewNote && <p className="mt-1 text-xs text-muted-foreground">HR: {c.reviewNote}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        <div className="grid content-start gap-4">
          <Section title={`Problems (${issues.length})`}>
            {!issues.length ? (
              <p className="text-xs text-muted-foreground">None logged.</p>
            ) : (
              <div className="grid gap-1.5">
                {issues.map((i) => (
                  <div key={i._id} className="rounded-lg bg-secondary/30 px-3 py-1.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{ISSUE_LABEL[i.category] ?? i.category}</span>
                      {i.status === 'open' ? <Badge variant="warning">Open</Badge> : <Badge variant="success">Resolved</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {fmt(i.createdAt)}
                      {i.employee ? ` · ${personName(i.employee)}` : ''}
                      {i.description ? ` — ${i.description}` : ''}
                    </p>
                    {i.resolution && <p className="text-xs">Fix: {i.resolution}</p>}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Shoot uploads from it">
            {!footage.length ? (
              <p className="text-xs text-muted-foreground">None logged.</p>
            ) : (
              <div className="grid grid-cols-1 gap-1.5">
                {footage.map((f) => (
                  <div key={f._id} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/30 px-3 py-1.5 text-sm">
                    <span className="min-w-0 truncate">
                      {fmt(f.shootDate)} · {f.client?.name ?? f.clientName ?? '—'}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {f.clearedFromPhone ? <Badge variant="success">Cleared</Badge> : <Badge variant="outline">Still on phone</Badge>}
                      <a href={f.driveLink} target="_blank" rel="noreferrer" className="text-primary">
                        <ExternalLink className="size-3.5" />
                      </a>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>

      <Section title="Who has had it">
        {!past.length ? (
          <p className="text-xs text-muted-foreground">{active ? 'Nobody before.' : 'Never handed over.'}</p>
        ) : (
          <div className="grid gap-2">
            {past.map((a) => (
              <div key={a._id} className="grid gap-1.5 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{personName(a.employee)}</span>
                  <span className="text-xs text-muted-foreground">
                    {fmt(a.assignedAt)} → {a.status === 'lost' ? `lost ${fmt(a.lostAt)}` : fmt(a.returnedAt)}
                  </span>
                  {a.status === 'lost' && <Badge variant="destructive">Lost with them</Badge>}
                </div>
                {a.accessories.some((x) => (x.returnedQty ?? 0) < x.qty) && (
                  <p className="text-xs text-destructive">
                    Not returned: {a.accessories.filter((x) => (x.returnedQty ?? 0) < x.qty).map((x) => `${x.label} × ${x.qty - (x.returnedQty ?? 0)}`).join(', ')}
                  </p>
                )}
                {a.returnNote && <p className="text-xs text-muted-foreground">“{a.returnNote}”</p>}
                <Recovery assignment={a} />
                <Paper assignment={a} which="agreement" />
                {a.status === 'returned' && <Paper assignment={a} which="receipt" />}
              </div>
            ))}
          </div>
        )}
      </Section>

      {dialog === 'edit' && <DeviceFormDialog open onOpenChange={(v) => !v && setDialog(null)} device={device} />}
      {dialog === 'assign' && <AssignDialog open onOpenChange={(v) => !v && setDialog(null)} device={device} />}
      {dialog === 'return' && <ReturnDialog open onOpenChange={(v) => !v && setDialog(null)} device={device} assignment={active} />}
      {dialog === 'lost' && <LostDialog open onOpenChange={(v) => !v && setDialog(null)} device={device} />}
      {dialog === 'check' && <HrCheckDialog open onOpenChange={(v) => !v && setDialog(null)} device={device} />}
      {dialog === 'issue' && <IssueDialog open onOpenChange={(v) => !v && setDialog(null)} device={device} />}
    </div>
  )
}
