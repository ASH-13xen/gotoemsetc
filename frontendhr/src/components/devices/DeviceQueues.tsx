import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, ExternalLink, FileUp, Loader2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { DEVICES_KEY } from './DeviceDialogs'
import {
  FLAG_LABEL,
  GENUINE_LABEL,
  GENUINE_PARTS,
  GRADE_LABEL,
  ISSUE_LABEL,
  PARTS,
  apiMessage,
  deviceName,
  devicesApi,
  personName,
  securityItemsFor,
  type DeviceCheck,
  type DeviceKind,
  type Runbook,
} from '@/api/devices.api'

const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const fmtTime = (d?: string) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—')

// A photo kept with a check, loaded through the API (it needs the login).
export function Photo({ id }: { id: string }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    let alive = true
    let made: string | undefined
    devicesApi
      .file(id)
      .then((blob) => {
        made = URL.createObjectURL(blob)
        if (alive) setUrl(made)
      })
      .catch(() => {})
    return () => {
      alive = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [id])
  if (!url) return <div className="size-20 animate-pulse rounded-lg bg-secondary" />
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="" className="size-20 rounded-lg object-cover ring-1 ring-border" />
    </a>
  )
}

// Everything one check found.
export function CheckView({ check, kind }: { check: DeviceCheck; kind: DeviceKind }) {
  const parts = check.parts ?? {}
  const security = check.security ?? {}
  return (
    <div className="grid gap-2 text-sm">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span>
          <b>Condition:</b> {check.grade ? GRADE_LABEL[check.grade] : '—'}
        </span>
        <span>
          <b>Storage:</b> {check.storageFreeGb ?? '—'} GB free of {check.storageTotalGb ?? '—'} GB
        </span>
        <span>
          <b>Battery:</b> {check.batteryHealth != null ? `${check.batteryHealth}%` : '—'}
        </span>
        {check.galleryBackedUp != null && (
          <span>
            <b>Gallery backed up:</b> {check.galleryBackedUp ? 'yes' : 'no'}
          </span>
        )}
      </div>
      {(check.flags ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {check.flags!.map((f) => (
            <Badge key={f} variant="warning">
              {FLAG_LABEL[f] ?? f}
            </Badge>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        {PARTS[kind].map((p) =>
          parts[p.key] ? (
            <span
              key={p.key}
              className={cn(
                'rounded px-1.5 py-0.5 text-[11px]',
                parts[p.key] === 'ok' ? 'bg-emerald-500/10 text-emerald-700' : parts[p.key] === 'worn' ? 'bg-amber-500/10 text-amber-700' : 'bg-destructive/10 text-destructive'
              )}
            >
              {p.label}: {parts[p.key]}
            </span>
          ) : null
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {securityItemsFor(kind).map((s) =>
          security[s.key] === false ? (
            <span key={s.key} className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] text-destructive">
              OFF: {s.label}
            </span>
          ) : null
        )}
      </div>
      {Object.keys(check.genuine ?? {}).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {GENUINE_PARTS.map((p) =>
            check.genuine?.[p.key] ? (
              <span
                key={p.key}
                className={cn('rounded px-1.5 py-0.5 text-[11px]', check.genuine[p.key] === 'unknown' ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-muted-foreground')}
              >
                {p.label}: {GENUINE_LABEL[check.genuine[p.key]]}
              </span>
            ) : null
          )}
        </div>
      )}
      {check.remarks && <p className="text-xs text-muted-foreground">“{check.remarks}”</p>}
      {(check.photos ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {check.photos!.map((p) => (
            <Photo key={p} id={p} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- checks to verify

export function VerifyTab() {
  const queryClient = useQueryClient()
  const { data: checks, isLoading } = useQuery({ queryKey: [...DEVICES_KEY, 'checks', 'submitted'], queryFn: () => devicesApi.checks({ status: 'submitted' }) })
  const [notes, setNotes] = useState<Record<string, string>>({})
  const review = useMutation({
    mutationFn: ({ id, ok }: { id: string; ok: boolean }) => devicesApi.reviewCheck(id, ok, notes[id]),
    onSuccess: (_d, v) => {
      toast.success(v.ok ? 'Verified' : 'Sent back to them to do again')
      queryClient.invalidateQueries({ queryKey: DEVICES_KEY })
    },
    onError: (err) => toast.error(apiMessage(err, 'Could not save')),
  })
  if (isLoading) return <Skeleton className="h-40 w-full" />
  if (!checks?.length) return <p className="py-10 text-center text-sm text-muted-foreground">No monthly checks waiting — all caught up.</p>
  return (
    <div className="grid gap-3">
      {checks.map((c) => {
        const device = typeof c.device === 'string' ? null : c.device
        return (
          <Card key={c._id} className="gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">
                  {device ? (
                    <Link className="hover:underline" to={`/devices/${device._id}`}>
                      {device.code} · {deviceName(device)}
                    </Link>
                  ) : (
                    'Device'
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {personName(c.employee)}'s check for {c.month} · sent {fmtTime(c.createdAt)}
                </p>
              </div>
            </div>
            {device && <CheckView check={c} kind={device.kind} />}
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="h-8 max-w-sm"
                placeholder="Note (shown to them if sent back)"
                value={notes[c._id] ?? ''}
                onChange={(e) => setNotes((n) => ({ ...n, [c._id]: e.target.value }))}
              />
              <Button size="sm" onClick={() => review.mutate({ id: c._id, ok: true })} disabled={review.isPending}>
                <Check className="size-3.5" /> Verify
              </Button>
              <Button size="sm" variant="outline" onClick={() => review.mutate({ id: c._id, ok: false })} disabled={review.isPending}>
                <X className="size-3.5" /> Send back
              </Button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- issues

export function IssuesTab() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<'open' | 'resolved'>('open')
  const { data: issues, isLoading } = useQuery({ queryKey: [...DEVICES_KEY, 'issues', status], queryFn: () => devicesApi.issues(status) })
  const [text, setText] = useState<Record<string, string>>({})
  const resolve = useMutation({
    mutationFn: (id: string) => devicesApi.resolveIssue(id, text[id] ?? ''),
    onSuccess: () => {
      toast.success('Resolved — they have been told')
      queryClient.invalidateQueries({ queryKey: DEVICES_KEY })
    },
    onError: (err) => toast.error(apiMessage(err, 'Could not resolve')),
  })
  return (
    <div className="grid gap-3">
      <div className="flex gap-2">
        {(['open', 'resolved'] as const).map((s) => (
          <Button key={s} size="sm" variant={status === s ? 'default' : 'outline'} onClick={() => setStatus(s)}>
            {s === 'open' ? 'Open' : 'Resolved'}
          </Button>
        ))}
      </div>
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !issues?.length ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nothing {status === 'open' ? 'open' : 'resolved yet'}.</p>
      ) : (
        issues.map((i) => (
          <Card key={i._id} className="gap-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                <Link className="hover:underline" to={`/devices/${i.device._id}`}>
                  {i.device.code} · {deviceName(i.device)}
                </Link>{' '}
                — {ISSUE_LABEL[i.category] ?? i.category}
              </p>
              <span className="text-xs text-muted-foreground">
                {personName(i.employee)} · {fmt(i.createdAt)}
              </span>
            </div>
            {i.description && <p className="text-sm text-foreground/80">{i.description}</p>}
            {i.status === 'open' ? (
              <div className="flex flex-wrap gap-2">
                <Input className="h-8 max-w-md" placeholder="What was done (sent to them)" value={text[i._id] ?? ''} onChange={(e) => setText((t) => ({ ...t, [i._id]: e.target.value }))} />
                <Button size="sm" onClick={() => resolve.mutate(i._id)} disabled={resolve.isPending}>
                  Resolved
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Resolved by {i.resolvedBy?.username ?? '—'} on {fmt(i.resolvedAt)}
                {i.resolution ? ` — ${i.resolution}` : ''}
              </p>
            )}
          </Card>
        ))
      )}
    </div>
  )
}

// ---------------------------------------------------------------- runbooks

export function RunbookCard({ runbook }: { runbook: Runbook }) {
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const tick = useMutation({
    mutationFn: ({ stepId, done, file }: { stepId: string; done?: boolean; file?: File }) => devicesApi.tickStep(runbook._id, stepId, { done, note: notes[stepId] }, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEVICES_KEY }),
    onError: (err) => toast.error(apiMessage(err, 'Could not save')),
  })
  const done = runbook.steps.filter((s) => s.done).length
  return (
    <Card className="gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">
            {runbook.kind === 'lost' ? (
              <>
                Lost device:{' '}
                {runbook.device ? (
                  <Link className="hover:underline" to={`/devices/${runbook.device._id}`}>
                    {runbook.device.code} · {deviceName(runbook.device)}
                  </Link>
                ) : (
                  '—'
                )}
                {runbook.employee ? ` (was with ${personName(runbook.employee)})` : ''}
              </>
            ) : (
              <>Revoke access: {personName(runbook.employee)}</>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Started {fmtTime(runbook.createdAt)} by {runbook.startedBy?.username ?? '—'}
            {runbook.reason ? ` — ${runbook.reason}` : ''}
          </p>
        </div>
        <Badge variant={runbook.status === 'closed' ? 'success' : 'warning'}>
          {runbook.status === 'closed' ? 'All done' : `${done} of ${runbook.steps.length} done`}
        </Badge>
      </div>
      <div className="grid gap-1.5">
        {runbook.steps.map((s) => (
          <div key={s._id} className={cn('grid gap-1 rounded-lg px-3 py-2', s.done ? 'bg-emerald-500/5' : 'bg-secondary/30')}>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 accent-primary"
                checked={s.done}
                disabled={tick.isPending}
                onChange={(e) => tick.mutate({ stepId: s._id, done: e.target.checked })}
              />
              <span className={cn('min-w-0 flex-1', s.done && 'text-muted-foreground line-through')}>{s.label}</span>
              {s.done && (
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {s.doneBy?.username ?? ''} · {fmtTime(s.doneAt)}
                </span>
              )}
            </label>
            {s.detail && !s.done && <p className="pl-6 text-xs text-muted-foreground">{s.detail}</p>}
            {s.note && <p className="pl-6 text-xs">Note: {s.note}</p>}
            {!s.done && (
              <div className="flex flex-wrap items-center gap-2 pl-6">
                <Input className="h-7 max-w-xs text-xs" placeholder="Note" value={notes[s._id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [s._id]: e.target.value }))} />
                {s.key === 'police' && (
                  <label className="flex cursor-pointer items-center gap-1 text-xs text-primary">
                    <FileUp className="size-3.5" /> {s.file ? 'Replace complaint copy' : 'Upload complaint copy'}
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && tick.mutate({ stepId: s._id, file: e.target.files[0] })}
                    />
                  </label>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {tick.isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
    </Card>
  )
}

export function RunbooksTab() {
  const [status, setStatus] = useState<'open' | 'closed'>('open')
  const { data: runbooks, isLoading } = useQuery({ queryKey: [...DEVICES_KEY, 'runbooks', status], queryFn: () => devicesApi.runbooks(status) })
  return (
    <div className="grid gap-3">
      <div className="flex gap-2">
        {(['open', 'closed'] as const).map((s) => (
          <Button key={s} size="sm" variant={status === s ? 'default' : 'outline'} onClick={() => setStatus(s)}>
            {s === 'open' ? 'Open' : 'Done'}
          </Button>
        ))}
      </div>
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !runbooks?.length ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {status === 'open' ? 'Nothing open. A runbook starts when a device is marked lost, or someone’s access is revoked.' : 'None finished yet.'}
        </p>
      ) : (
        runbooks.map((r) => <RunbookCard key={r._id} runbook={r} />)
      )}
    </div>
  )
}

// ---------------------------------------------------------------- footage

export function FootageTab() {
  const queryClient = useQueryClient()
  const { data: uploads, isLoading } = useQuery({ queryKey: [...DEVICES_KEY, 'footage'], queryFn: devicesApi.footage })
  const cleared = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) => devicesApi.setFootageCleared(id, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...DEVICES_KEY, 'footage'] }),
  })
  if (isLoading) return <Skeleton className="h-32 w-full" />
  return (
    <Card className="gap-3 p-4">
      <p className="text-xs text-muted-foreground">
        Each shoot's footage goes straight from the phone to the company Google Drive (the Drive app, on Wi-Fi), and is logged here by whoever shot it — from
        "My devices" on their dashboard. Clear it from the phone only once it is here.
      </p>
      {!uploads?.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No uploads logged yet.</p>
      ) : (
        <div className="grid gap-1.5">
          {uploads.map((u) => (
            <div key={u._id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-secondary/30 px-3 py-2 text-sm">
              <span className="font-medium">{fmt(u.shootDate)}</span>
              <span>{u.client?.name ?? u.clientName ?? '—'}</span>
              <span className="text-muted-foreground">
                {personName(u.employee)}
                {u.device ? ` · ${u.device.code}` : ''}
              </span>
              <span className="text-muted-foreground">
                {u.files ? `${u.files} files` : ''}
                {u.sizeGb ? ` · ${u.sizeGb} GB` : ''}
              </span>
              <a className="flex items-center gap-1 text-primary hover:underline" href={u.driveLink} target="_blank" rel="noreferrer">
                Drive <ExternalLink className="size-3" />
              </a>
              <label className="ml-auto flex items-center gap-1 text-xs">
                <input type="checkbox" className="accent-primary" checked={Boolean(u.clearedFromPhone)} onChange={(e) => cleared.mutate({ id: u._id, value: e.target.checked })} />
                Cleared from the phone
              </label>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
