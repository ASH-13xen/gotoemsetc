import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Eye, Loader2, Pencil, Plus, ShieldX, Trash2, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { DEVICES_KEY } from './DeviceDialogs'
import { RunbookCard } from './DeviceQueues'
import {
  ACCESSORY_KIND_LABEL,
  ACCESS_DEVICE_LABEL,
  ACCESS_KIND_LABEL,
  ACCOUNT_LABEL,
  apiMessage,
  devicesApi,
  openBlob,
  personName,
  type Account,
  type AccessTemplate,
  type Settings,
} from '@/api/devices.api'

const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

// ---------------------------------------------------------------- accessories

export function AccessoriesTab() {
  const queryClient = useQueryClient()
  const { data: accessories, isLoading } = useQuery({ queryKey: [...DEVICES_KEY, 'accessories'], queryFn: devicesApi.accessories })
  const [form, setForm] = useState({ name: '', kind: 'charger', totalQty: '1', unitValue: '' })
  const refresh = () => queryClient.invalidateQueries({ queryKey: DEVICES_KEY })
  const add = useMutation({
    mutationFn: () => devicesApi.createAccessory({ name: form.name, kind: form.kind, totalQty: Number(form.totalQty) || 0, unitValue: Number(form.unitValue) || 0 }),
    onSuccess: () => {
      toast.success('Added')
      setForm({ name: '', kind: 'charger', totalQty: '1', unitValue: '' })
      refresh()
    },
    onError: (err) => toast.error(apiMessage(err, 'Could not add')),
  })
  const update = useMutation({
    mutationFn: ({ id, totalQty, unitValue }: { id: string; totalQty?: number; unitValue?: number }) => devicesApi.updateAccessory(id, { totalQty, unitValue }),
    onSuccess: refresh,
    onError: (err) => toast.error(apiMessage(err, 'Could not save')),
  })
  return (
    <Card className="gap-4 p-4">
      <p className="text-xs text-muted-foreground">
        Chargers, cables, covers, guards — how many the company owns. What is out is counted from the handovers; a piece not returned is recovered at its
        value.
      </p>
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Accessory</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Owned</TableHead>
              <TableHead>Handed out</TableHead>
              <TableHead>In stock</TableHead>
              <TableHead>Value each (₹)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(accessories ?? []).map((a) => (
              <TableRow key={a._id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell className="text-sm">{ACCESSORY_KIND_LABEL[a.kind] ?? a.kind}</TableCell>
                <TableCell>
                  <Input type="number" min={a.out} className="h-8 w-20" defaultValue={a.totalQty} onBlur={(e) => Number(e.target.value) !== a.totalQty && update.mutate({ id: a._id, totalQty: Number(e.target.value) })} />
                </TableCell>
                <TableCell className="tabular-nums">{a.out}</TableCell>
                <TableCell className={cn('font-semibold tabular-nums', a.inStock === 0 && 'text-destructive')}>{a.inStock}</TableCell>
                <TableCell>
                  <Input type="number" min="0" className="h-8 w-24" defaultValue={a.unitValue} onBlur={(e) => Number(e.target.value) !== a.unitValue && update.mutate({ id: a._id, unitValue: Number(e.target.value) })} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">Name</Label>
          <Input className="h-9 w-56" placeholder="e.g. 20W USB-C charger" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">Kind</Label>
          <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ACCESSORY_KIND_LABEL).map(([k, l]) => (
                <SelectItem key={k} value={k}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">How many</Label>
          <Input className="h-9 w-20" type="number" min="0" value={form.totalQty} onChange={(e) => setForm({ ...form, totalQty: e.target.value })} />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">Value each (₹)</Label>
          <Input className="h-9 w-24" type="number" min="0" value={form.unitValue} onChange={(e) => setForm({ ...form, unitValue: e.target.value })} />
        </div>
        <Button size="sm" onClick={() => add.mutate()} disabled={!form.name || add.isPending}>
          <Plus className="size-3.5" /> Add
        </Button>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------- accounts

function AccountDialog({ open, onOpenChange, account }: { open: boolean; onOpenChange: (v: boolean) => void; account?: Account }) {
  const queryClient = useQueryClient()
  const { data: devices = [] } = useQuery({ queryKey: [...DEVICES_KEY, 'list', 'all-for-accounts'], queryFn: () => devicesApi.list(), enabled: open })
  const [form, setForm] = useState({
    kind: account?.kind ?? 'apple_id',
    label: account?.label ?? '',
    identifier: account?.identifier ?? '',
    password: '',
    pin: '',
    recoveryEmail: account?.recoveryEmail ?? '',
    recoveryPhone: account?.recoveryPhone ?? '',
    twoFactorOn: account?.twoFactorOn ?? false,
    codesGoTo: account?.codesGoTo ?? '',
    notes: account?.notes ?? '',
    devices: (account?.devices ?? []).map((d) => d._id),
  })
  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { ...form }
      if (!form.password) delete body.password
      if (!form.pin) delete body.pin
      return account ? devicesApi.updateAccount(account._id, body) : devicesApi.createAccount(body)
    },
    onSuccess: () => {
      toast.success('Saved')
      queryClient.invalidateQueries({ queryKey: DEVICES_KEY })
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiMessage(err, 'Could not save')),
  })
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{account ? 'Edit account' : 'Add a company account'}</DialogTitle>
          <DialogDescription>The password and PIN are encrypted, and only shown on request — every reveal is logged.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Kind</Label>
            <Select value={form.kind} onValueChange={(v) => set('kind', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACCOUNT_LABEL).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Name (optional)</Label>
            <Input value={form.label} onChange={(e) => set('label', e.target.value)} placeholder="e.g. GoTo phone 3 Apple ID" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Email / number / handle</Label>
            <Input value={form.identifier} onChange={(e) => set('identifier', e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">{account?.hasPassword ? 'New password (leave empty to keep)' : 'Password'}</Label>
            <Input type="password" autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">{account?.hasPin ? 'New PIN (leave empty to keep)' : 'PIN (e.g. WhatsApp two-step)'}</Label>
            <Input type="password" autoComplete="new-password" value={form.pin} onChange={(e) => set('pin', e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">2-step codes go to (a company number)</Label>
            <Input value={form.codesGoTo} onChange={(e) => set('codesGoTo', e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Recovery email</Label>
            <Input value={form.recoveryEmail} onChange={(e) => set('recoveryEmail', e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Recovery phone</Label>
            <Input value={form.recoveryPhone} onChange={(e) => set('recoveryPhone', e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="accent-primary" checked={form.twoFactorOn} onChange={(e) => set('twoFactorOn', e.target.checked)} />
            2-step verification is on
          </label>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Signed in on</Label>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {devices
                .filter((d) => d.status !== 'retired')
                .map((d) => {
                  const on = form.devices.includes(d._id)
                  return (
                    <button
                      key={d._id}
                      type="button"
                      onClick={() => set('devices', on ? form.devices.filter((x) => x !== d._id) : [...form.devices, d._id])}
                      className={cn('rounded-md px-2 py-1 text-xs ring-1', on ? 'bg-primary/10 text-primary ring-primary/40' : 'text-muted-foreground ring-border')}
                    >
                      {d.code}
                    </button>
                  )
                })}
            </div>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!form.identifier || save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Reveal({ id }: { id: string }) {
  const [shown, setShown] = useState<{ password: string | null; pin: string | null } | null>(null)
  useEffect(() => {
    if (!shown) return
    const t = setTimeout(() => setShown(null), 30_000)
    return () => clearTimeout(t)
  }, [shown])
  const reveal = useMutation({ mutationFn: () => devicesApi.reveal(id), onSuccess: setShown, onError: (err) => toast.error(apiMessage(err, 'Could not reveal')) })
  if (shown)
    return (
      <span className="font-mono text-xs" title="Hidden again in 30 seconds">
        {shown.password ?? '—'}
        {shown.pin ? ` · PIN ${shown.pin}` : ''}
      </span>
    )
  return (
    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => reveal.mutate()} disabled={reveal.isPending}>
      <Eye className="size-3.5" /> Reveal
    </Button>
  )
}

export function AccountsTab() {
  const queryClient = useQueryClient()
  const { data: accounts, isLoading } = useQuery({ queryKey: [...DEVICES_KEY, 'accounts'], queryFn: devicesApi.accounts })
  const [editing, setEditing] = useState<Account | 'new' | null>(null)
  const remove = useMutation({
    mutationFn: (id: string) => devicesApi.deleteAccount(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEVICES_KEY }),
  })
  return (
    <Card className="gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Every company account that lives on a device — each phone's own Apple ID or Gmail, the WhatsApp Business numbers, the pages. 2-step codes should go to a
          company number, never a person's.
        </p>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus className="size-3.5" /> Add account
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : !accounts?.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No accounts yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>2-step</TableHead>
                <TableHead>On</TableHead>
                <TableHead>Password last changed</TableHead>
                <TableHead>Password / PIN</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a._id}>
                  <TableCell>
                    <p className="text-sm font-medium">{a.identifier}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {ACCOUNT_LABEL[a.kind] ?? a.kind}
                      {a.label ? ` · ${a.label}` : ''}
                      {a.employee ? ` · ${personName(a.employee)}` : ''}
                    </p>
                  </TableCell>
                  <TableCell>
                    {a.twoFactorOn ? <Badge variant="success">On{a.codesGoTo ? ` → ${a.codesGoTo}` : ''}</Badge> : <Badge variant="destructive">Off</Badge>}
                  </TableCell>
                  <TableCell className="text-xs">{a.devices.map((d) => d.code).join(', ') || '—'}</TableCell>
                  <TableCell className="text-xs">
                    {fmt(a.passwordChangedAt)}
                    {a.passwordChangedBy ? ` · ${a.passwordChangedBy.username}` : ''}
                  </TableCell>
                  <TableCell>{a.hasPassword || a.hasPin ? <Reveal id={a._id} /> : <span className="text-xs text-muted-foreground">none on file</span>}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(a)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-destructive"
                      onClick={() => window.confirm(`Remove ${a.identifier} from the register?`) && remove.mutate(a._id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {editing && <AccountDialog open onOpenChange={(v) => !v && setEditing(null)} account={editing === 'new' ? undefined : editing} />}
    </Card>
  )
}

// ---------------------------------------------------------------- access matrix + checklists + revoke

function MatrixEditor({ settings }: { settings: Settings }) {
  const queryClient = useQueryClient()
  const [rows, setRows] = useState<AccessTemplate[]>(settings.accessTemplates)
  const save = useMutation({
    mutationFn: () => devicesApi.saveSettings({ accessTemplates: rows }),
    onSuccess: () => {
      toast.success('Access matrix saved — checklists pick up new items when opened')
      queryClient.invalidateQueries({ queryKey: DEVICES_KEY })
    },
    onError: (err) => toast.error(apiMessage(err, 'Could not save')),
  })
  const setRow = (i: number, patch: Partial<AccessTemplate>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)))
  return (
    <Card className="gap-3 p-4">
      <div>
        <p className="text-sm font-semibold">Access matrix</p>
        <p className="text-xs text-muted-foreground">
          Per designation ("*" = everyone): what goes on each device — apps and logins, accounts, groups. Each person's checklist above is built from it; add a row per designation.
        </p>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid gap-2 rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input className="h-8 w-56" placeholder="Designation, or * for everyone" value={row.designation} onChange={(e) => setRow(i, { designation: e.target.value })} />
            <Select value={row.deviceType} onValueChange={(v) => setRow(i, { deviceType: v })}>
              <SelectTrigger className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACCESS_DEVICE_LABEL).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" className="ml-auto h-8 text-destructive" onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
          {row.items.map((item, k) => (
            <div key={k} className="flex flex-wrap items-center gap-2 pl-2">
              <Select value={item.kind} onValueChange={(v) => setRow(i, { items: row.items.map((it, m) => (m === k ? { ...it, kind: v } : it)) })}>
                <SelectTrigger className="h-8 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCESS_KIND_LABEL).map(([kk, l]) => (
                    <SelectItem key={kk} value={kk}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input className="h-8 min-w-48 flex-1" placeholder="e.g. Instagram — client pages" value={item.label} onChange={(e) => setRow(i, { items: row.items.map((it, m) => (m === k ? { ...it, label: e.target.value } : it)) })} />
              <Input className="h-8 min-w-40 flex-1" placeholder="Details (optional)" value={item.detail ?? ''} onChange={(e) => setRow(i, { items: row.items.map((it, m) => (m === k ? { ...it, detail: e.target.value } : it)) })} />
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setRow(i, { items: row.items.filter((_, m) => m !== k) })}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" className="w-fit" onClick={() => setRow(i, { items: [...row.items, { kind: 'app', label: '' }] })}>
            <Plus className="size-3.5" /> Item
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setRows((r) => [...r, { designation: '*', deviceType: 'company_phone', items: [] }])}>
          <Plus className="size-3.5" /> Row
        </Button>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="size-4 animate-spin" />}
          Save matrix
        </Button>
      </div>
    </Card>
  )
}

function PersonAccess({ employeeId }: { employeeId: string }) {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: [...DEVICES_KEY, 'access', employeeId], queryFn: () => devicesApi.access(employeeId) })
  const [custom, setCustom] = useState({ deviceType: 'company_phone', kind: 'app', label: '' })
  const refresh = () => queryClient.invalidateQueries({ queryKey: DEVICES_KEY })
  const setItem = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => devicesApi.setAccessItem(employeeId, id, { status }), onSuccess: refresh })
  const add = useMutation({
    mutationFn: () => devicesApi.addAccessItem(employeeId, custom),
    onSuccess: () => {
      setCustom({ ...custom, label: '' })
      refresh()
    },
    onError: (err) => toast.error(apiMessage(err, 'Could not add')),
  })
  const revoke = useMutation({
    mutationFn: (reason: string) => devicesApi.revoke(employeeId, reason),
    onSuccess: () => {
      toast.success('Their EMS login is off. Work through the steps below.')
      refresh()
    },
    onError: (err) => toast.error(apiMessage(err, 'Could not start')),
  })
  if (isLoading || !data) return <Skeleton className="h-40 w-full" />
  const byType = Object.keys(ACCESS_DEVICE_LABEL).map((t) => ({ type: t, items: data.items.filter((i) => i.deviceType === t) }))
  const openRunbook = data.runbooks.find((r) => r.status === 'open')
  return (
    <div className="grid gap-3">
      <Card className="gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">
              {data.employee.name} <span className="font-normal text-muted-foreground">· {data.employee.designation ?? '—'}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {data.employee.companyEmail ?? 'No company mail on record'} · Devices: {data.devices.map((d) => d.code).join(', ') || 'none'} · Accounts:{' '}
              {data.accounts.map((a) => a.identifier).join(', ') || 'none'}
            </p>
          </div>
          <Button
            size="sm"
            variant="destructive"
            disabled={revoke.isPending || Boolean(openRunbook)}
            onClick={() => {
              const reason = window.prompt(`Revoke all of ${data.employee.name}'s access?\nTheir EMS login goes off at once. Why?`)
              if (reason !== null) revoke.mutate(reason)
            }}
          >
            <ShieldX className="size-3.5" /> Revoke all access
          </Button>
        </div>
        {byType.map(({ type, items }) =>
          items.length ? (
            <div key={type} className="grid gap-1">
              <p className="text-xs font-semibold text-muted-foreground">{ACCESS_DEVICE_LABEL[type]}</p>
              {items.map((i) => (
                <div key={i._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/30 px-3 py-1.5 text-sm">
                  <span className="min-w-0">
                    {i.label}
                    <span className="ml-1.5 text-[11px] text-muted-foreground">
                      {ACCESS_KIND_LABEL[i.kind]}
                      {i.detail ? ` · ${i.detail}` : ''}
                    </span>
                  </span>
                  <span className="flex gap-1">
                    {(['pending', 'done', 'na'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={i.status === 'revoked'}
                        onClick={() => setItem.mutate({ id: i._id, status: s })}
                        className={cn(
                          'rounded px-2 py-0.5 text-[11px] font-semibold',
                          i.status === s ? (s === 'done' ? 'bg-emerald-500/15 text-emerald-700' : s === 'na' ? 'bg-zinc-500/15 text-zinc-700' : 'bg-amber-500/15 text-amber-700') : 'text-muted-foreground hover:bg-secondary'
                        )}
                      >
                        {s === 'pending' ? 'To do' : s === 'done' ? 'Done' : 'N/A'}
                      </button>
                    ))}
                    {i.status === 'revoked' && <Badge variant="destructive">Revoked</Badge>}
                  </span>
                </div>
              ))}
            </div>
          ) : null
        )}
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Select value={custom.deviceType} onValueChange={(v) => setCustom({ ...custom, deviceType: v })}>
            <SelectTrigger className="h-8 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ACCESS_DEVICE_LABEL).map(([k, l]) => (
                <SelectItem key={k} value={k}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={custom.kind} onValueChange={(v) => setCustom({ ...custom, kind: v })}>
            <SelectTrigger className="h-8 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ACCESS_KIND_LABEL).map(([k, l]) => (
                <SelectItem key={k} value={k}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input className="h-8 min-w-48 flex-1" placeholder="Something just for them" value={custom.label} onChange={(e) => setCustom({ ...custom, label: e.target.value })} />
          <Button size="sm" variant="outline" onClick={() => add.mutate()} disabled={!custom.label || add.isPending}>
            <Plus className="size-3.5" /> Add
          </Button>
        </div>
      </Card>
      {data.runbooks.map((r) => (
        <RunbookCard key={r._id} runbook={r} />
      ))}
    </div>
  )
}

export function AccessTab() {
  const { data: settings } = useQuery({ queryKey: [...DEVICES_KEY, 'settings'], queryFn: devicesApi.settings })
  const { data: employees = [] } = useQuery({ queryKey: [...DEVICES_KEY, 'employees'], queryFn: devicesApi.employees })
  const [employeeId, setEmployeeId] = useState('')
  return (
    <div className="grid gap-4">
      <Card className="gap-3 p-4">
        <p className="text-sm font-semibold">A person's access</p>
        <p className="text-xs text-muted-foreground">
          Their checklist from the matrix — what is set up on their company phone, personal phone and laptops. "Revoke all access" turns their EMS login off
          at once and lists every device, account and access to remove.
        </p>
        <Select value={employeeId} onValueChange={setEmployeeId}>
          <SelectTrigger className="max-w-sm">
            <SelectValue placeholder="Choose a person" />
          </SelectTrigger>
          <SelectContent>
            {employees.map((e) => (
              <SelectItem key={e._id} value={e._id}>
                {personName(e)} {e.designation ? `· ${e.designation}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>
      {employeeId && <PersonAccess employeeId={employeeId} />}
      {settings && <MatrixEditor key={settings.accessTemplates.length} settings={settings} />}
    </div>
  )
}

// ---------------------------------------------------------------- settings

export function SettingsTab() {
  const queryClient = useQueryClient()
  const { data: settings, isLoading } = useQuery({ queryKey: [...DEVICES_KEY, 'settings'], queryFn: devicesApi.settings })
  const [draft, setDraft] = useState<Settings | null>(null)
  useEffect(() => {
    if (settings) setDraft(settings)
  }, [settings])
  const save = useMutation({
    mutationFn: () =>
      devicesApi.saveSettings({ apps: draft!.apps, brand: draft!.brand, checkDueDay: draft!.checkDueDay, lowStoragePct: draft!.lowStoragePct, lowBatteryPct: draft!.lowBatteryPct }),
    onSuccess: () => {
      toast.success('Settings saved')
      queryClient.invalidateQueries({ queryKey: DEVICES_KEY })
    },
    onError: (err) => toast.error(apiMessage(err, 'Could not save')),
  })
  const brandFile = useMutation({
    mutationFn: ({ which, file }: { which: 'logo' | 'brochure'; file: File }) => devicesApi.brandFile(which, file),
    onSuccess: () => {
      toast.success('Uploaded')
      queryClient.invalidateQueries({ queryKey: [...DEVICES_KEY, 'settings'] })
    },
    onError: (err) => toast.error(apiMessage(err, 'Could not upload')),
  })
  if (isLoading || !draft) return <Skeleton className="h-60 w-full" />
  const setBrand = (k: string, v: string) => setDraft({ ...draft, brand: { ...draft.brand, [k]: v } })
  return (
    <div className="grid gap-4">
      <Card className="gap-3 p-4">
        <p className="text-sm font-semibold">Apps every company phone carries</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {draft.apps.map((app, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-secondary/30 px-3 py-1.5">
              <Input className="h-8 flex-1" value={app.label} onChange={(e) => setDraft({ ...draft, apps: draft.apps.map((a, j) => (j === i ? { ...a, label: e.target.value } : a)) })} />
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" className="accent-primary" checked={app.required} onChange={(e) => setDraft({ ...draft, apps: draft.apps.map((a, j) => (j === i ? { ...a, required: e.target.checked } : a)) })} />
                Required
              </label>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setDraft({ ...draft, apps: draft.apps.filter((_, j) => j !== i) })}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <Button size="sm" variant="outline" className="w-fit" onClick={() => setDraft({ ...draft, apps: [...draft.apps, { key: '', label: '', required: true }] })}>
          <Plus className="size-3.5" /> App
        </Button>
      </Card>

      <Card className="gap-3 p-4">
        <p className="text-sm font-semibold">Brand kit — every phone's WhatsApp Business and Truecaller profile</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">WhatsApp business name</Label>
            <Input value={draft.brand.whatsappName ?? ''} onChange={(e) => setBrand('whatsappName', e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Website</Label>
            <Input value={draft.brand.website ?? ''} onChange={(e) => setBrand('website', e.target.value)} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Bio / about</Label>
            <Textarea rows={2} value={draft.brand.bio ?? ''} onChange={(e) => setBrand('bio', e.target.value)} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Address</Label>
            <Input value={draft.brand.address ?? ''} onChange={(e) => setBrand('address', e.target.value)} />
          </div>
          {(['logo', 'brochure'] as const).map((which) => (
            <div key={which} className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-secondary/40">
                <Upload className="size-4" /> {draft.brand[which] ? `Replace ${which}` : `Upload ${which}`}
                <input
                  type="file"
                  accept={which === 'logo' ? 'image/jpeg,image/png,image/webp' : 'application/pdf,image/jpeg,image/png'}
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && brandFile.mutate({ which, file: e.target.files[0] })}
                />
              </label>
              {draft.brand[which] && (
                <Button size="sm" variant="link" onClick={() => openBlob(() => devicesApi.file(draft.brand[which] as string))}>
                  Open
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="gap-3 p-4">
        <p className="text-sm font-semibold">Monthly check</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Due by day of the month</Label>
            <Input type="number" min="1" max="28" value={draft.checkDueDay} onChange={(e) => setDraft({ ...draft, checkDueDay: Number(e.target.value) })} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Low storage below (% free)</Label>
            <Input type="number" min="1" max="90" value={draft.lowStoragePct} onChange={(e) => setDraft({ ...draft, lowStoragePct: Number(e.target.value) })} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Weak battery below (%)</Label>
            <Input type="number" min="1" max="100" value={draft.lowBatteryPct} onChange={(e) => setDraft({ ...draft, lowBatteryPct: Number(e.target.value) })} />
          </div>
        </div>
      </Card>
      <Button className="w-fit" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending && <Loader2 className="size-4 animate-spin" />}
        Save settings
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------- guides

const GUIDES: { title: string; steps: string[] }[] = [
  {
    title: 'Setting up a new company phone',
    steps: [
      'Add it here first (it gets its code — stick the code on the back) with its IMEI (dial *#06#) and serial number.',
      'Android: sign in with its own company Gmail. iPhone: its own company Apple ID — never a person’s. Record the account under Accounts, with 2-step codes going to a company number.',
      'Turn on the screen lock, Find My Device / Find My, and theft protection (Android: Settings → Google → Theft protection; iPhone: Settings → Face ID & Passcode → Stolen Device Protection).',
      'Install every app in the list (Settings tab) and sign each in to the company account; set up the WhatsApp Business profile from the brand kit; update the Truecaller name.',
      'Then hand it over from its page — the handover check, the accessories, and print the agreement for signing.',
    ],
  },
  {
    title: 'iPhone: contacts not syncing with the company Gmail',
    steps: [
      'Settings → Contacts → Accounts → Add Account → Google — sign in to the company Gmail.',
      'Open that Gmail account there and turn Contacts on.',
      'Settings → Contacts → Default Account → Gmail, so new numbers are saved to Gmail, not iCloud.',
      'If iCloud contacts are on too, existing numbers may sit in iCloud only — export them (icloud.com/contacts) and import them into Google Contacts.',
    ],
  },
  {
    title: 'Apple ID not syncing',
    steps: [
      'Settings → [name]: check it is signed in to this phone’s own company Apple ID, and iCloud shows no "verify" or "update" banner.',
      'Check the date and time are set automatically, and the phone is on Wi-Fi with iOS up to date.',
      'If the password was changed, sign out and back in (Settings → [name] → Sign Out) — keep a copy of the data first.',
      'Verification codes go to the company number on the account — make sure that SIM is to hand.',
    ],
  },
  {
    title: 'An app won’t download',
    steps: [
      'Storage: there must be at least 1–2 GB free — clear space first (below).',
      'The phone’s OS may be too old for the app — update the OS (Settings → Software update).',
      'Play Store / App Store signed in to the company account, and that account’s country set to India.',
      'iPhone: check Screen Time → Content & Privacy Restrictions; Android: Family Link or a work profile can block installs.',
      'Still failing: report it from "My devices" — it is logged against the phone so repeat problems show.',
    ],
  },
  {
    title: 'Storage keeps filling up',
    steps: [
      'Upload the shoot footage to the company Drive (Drive app → + → Upload) and log it from "My devices" with the Drive link.',
      'Only after it is logged: delete it from the gallery, and empty "Recently deleted".',
      'WhatsApp → Settings → Storage and data → Manage storage: clear large media.',
      'Google Photos → "Free up space" removes what is already backed up.',
    ],
  },
  {
    title: 'A phone is lost, stolen or not returned',
    steps: [
      'Mark it lost on its page at once — a runbook opens with every step.',
      'Lock it from android.com/find or icloud.com/find, with a company number on the lock screen.',
      'Call the carrier to block the SIM; ask for a replacement on the same number.',
      'Change the password of every account on it (the runbook lists them) and sign the phone out of each.',
      'File a police complaint with the IMEI and upload the copy; the CEIR portal (ceir.gov.in) can then block the phone on every network.',
    ],
  },
  {
    title: 'Someone goes rogue or leaves suddenly',
    steps: [
      'Access tab → choose them → "Revoke all access": their EMS login goes off at once.',
      'Work through the steps: take back every device, change every account password, remove them from groups and page roles.',
      'Their full & final can’t go ahead until every device is returned or marked lost.',
    ],
  },
]

export function GuidesTab() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {GUIDES.map((g) => (
        <Card key={g.title} className="gap-2 p-4">
          <p className="text-sm font-semibold">{g.title}</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground/85">
            {g.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </Card>
      ))}
    </div>
  )
}
