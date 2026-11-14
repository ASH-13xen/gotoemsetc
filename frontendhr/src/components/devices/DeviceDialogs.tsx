import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckFields, emptyCheck } from './CheckFields'
import {
  FLAG_LABEL,
  GRADE_LABEL,
  KIND_LABEL,
  apiMessage,
  deviceName,
  devicesApi,
  personName,
  type Assignment,
  type CheckInput,
  type Device,
  type DeviceKind,
  type MonthCheck,
} from '@/api/devices.api'

export const DEVICES_KEY = ['devices']
const useRefresh = () => {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: DEVICES_KEY })
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`grid gap-1.5 ${className ?? ''}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------- add / edit

const DEVICE_FIELDS: { key: keyof Device; label: string; type?: string; span?: boolean }[] = [
  { key: 'brand', label: 'Brand' },
  { key: 'model', label: 'Model name' },
  { key: 'modelNumber', label: 'Model number' },
  { key: 'osVersion', label: 'OS version' },
  { key: 'color', label: 'Colour' },
  { key: 'storageGb', label: 'Capacity (GB)', type: 'number' },
  { key: 'serialNumber', label: 'Serial number' },
  { key: 'imei1', label: 'IMEI' },
  { key: 'imei2', label: 'IMEI 2' },
  { key: 'meid', label: 'MEID' },
  { key: 'iccid', label: 'ICCID (SIM card)' },
  { key: 'eid', label: 'EID (eSIM)' },
  { key: 'simNumber', label: 'SIM number' },
  { key: 'simProvider', label: 'SIM provider' },
  { key: 'purchaseDate', label: 'Bought on', type: 'date' },
  { key: 'purchasePrice', label: 'Price (₹)', type: 'number' },
  { key: 'recoveryValue', label: 'Recovery value if lost (₹)', type: 'number' },
  { key: 'vendor', label: 'Bought from' },
  { key: 'warrantyUntil', label: 'Warranty until', type: 'date' },
]

export function DeviceFormDialog({ open, onOpenChange, device }: { open: boolean; onOpenChange: (v: boolean) => void; device?: Device }) {
  const refresh = useRefresh()
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = { kind: device?.kind ?? 'phone', os: device?.os ?? '', notes: device?.notes ?? '' }
    for (const f of DEVICE_FIELDS) {
      const v = device?.[f.key]
      init[f.key] = v == null ? '' : f.type === 'date' ? String(v).slice(0, 10) : String(v)
    }
    return init
  })
  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { ...form }
      for (const f of DEVICE_FIELDS) if (f.type === 'number') body[f.key] = form[f.key] === '' ? '' : Number(form[f.key])
      return device ? devicesApi.update(device._id, body as Partial<Device>) : devicesApi.create(body as Partial<Device>)
    },
    onSuccess: (d) => {
      toast.success(device ? 'Saved' : `Added as ${d.code}`)
      refresh()
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiMessage(err, 'Could not save')),
  })
  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{device ? `Edit ${device.code}` : 'Add a device'}</DialogTitle>
          <DialogDescription>It gets a code (PH-001, LT-001…) — write it on a sticker on the device. Copy the details from the device: iPhone, Settings → General → About; Android, Settings → About phone (or dial *#06# for the IMEI).</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Kind">
            <Select value={form.kind} onValueChange={(v) => set('kind', v)} disabled={Boolean(device)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_LABEL) as DeviceKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="OS">
            <Select value={form.os || 'none'} onValueChange={(v) => set('os', v === 'none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {['android', 'ios', 'windows', 'macos', 'other'].map((o) => (
                  <SelectItem key={o} value={o}>
                    {o === 'ios' ? 'iOS' : o === 'macos' ? 'macOS' : o[0].toUpperCase() + o.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {DEVICE_FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <Input type={f.type ?? 'text'} value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} />
            </Field>
          ))}
          <Field label="Notes" className="sm:col-span-3">
            <Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            {device ? 'Save' : 'Add device'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- this month's check

const CHECK_KIND_NAME: Record<MonthCheck['kind'], string> = { handover: 'handover check', return: 'return check', monthly: 'monthly check', adhoc: 'HR check' }
const shortDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

// A device is checked once a month: a handover or return later in the month
// goes on that check, unless HR chooses to check it again.
function MonthCheckNote({ check, onRecheck }: { check: MonthCheck; onRecheck: () => void }) {
  const who = check.byHolder ? `${personName(check.employee)}'s ${CHECK_KIND_NAME[check.kind]}, verified` : `${CHECK_KIND_NAME[check.kind]}${check.by ? ` by ${check.by.username}` : ''}`
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-emerald-500/10 px-3 py-2.5 text-sm">
      <CheckCircle2 className="size-4 shrink-0 text-emerald-700" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          Already checked this month — {shortDate(check.createdAt)}, {who}
        </p>
        <p className="text-xs text-muted-foreground">
          {check.grade ? GRADE_LABEL[check.grade] : 'No grade'}
          {check.flags?.length ? ` · ${check.flags.map((f) => FLAG_LABEL[f] ?? f).join(', ')}` : ''}. That check is used — no need to check it again.
        </p>
      </div>
      <Button size="sm" variant="outline" className="h-8" onClick={onRecheck}>
        Check again
      </Button>
    </div>
  )
}

// The check part of a handover / return: this month's check if there is one
// (HR can still check again), otherwise the check form.
function CheckOrMonthCheck({
  device,
  recheck,
  onRecheck,
  children,
}: {
  device: Device
  recheck: boolean
  onRecheck: (v: boolean) => void
  children: ReactNode
}) {
  const done = device.checkThisMonth
  if (done && !recheck) return <MonthCheckNote check={done} onRecheck={() => onRecheck(true)} />
  return (
    <>
      {done && (
        <button type="button" className="w-fit text-xs text-primary hover:underline" onClick={() => onRecheck(false)}>
          Use the check of {shortDate(done.createdAt)} instead
        </button>
      )}
      {children}
    </>
  )
}

// ---------------------------------------------------------------- hand over

export function AssignDialog({ open, onOpenChange, device }: { open: boolean; onOpenChange: (v: boolean) => void; device: Device }) {
  const refresh = useRefresh()
  const { data: employees = [] } = useQuery({ queryKey: [...DEVICES_KEY, 'employees'], queryFn: devicesApi.employees, enabled: open })
  const { data: accessories = [] } = useQuery({ queryKey: [...DEVICES_KEY, 'accessories'], queryFn: devicesApi.accessories, enabled: open })
  const { data: settings } = useQuery({ queryKey: [...DEVICES_KEY, 'settings'], queryFn: devicesApi.settings, enabled: open })
  const [employeeId, setEmployeeId] = useState('')
  const [qty, setQty] = useState<Record<string, number>>({})
  const [check, setCheck] = useState<CheckInput>({ ...emptyCheck(), storageTotalGb: device.storageGb })
  const [photos, setPhotos] = useState<File[]>([])
  // Checked this month already: that check is the handover check unless HR checks again.
  const [recheck, setRecheck] = useState(!device.checkThisMonth)
  const assign = useMutation({
    mutationFn: () =>
      devicesApi.assign(
        device._id,
        {
          employeeId,
          accessories: Object.entries(qty).filter(([, n]) => n > 0).map(([accessory, n]) => ({ accessory, qty: n })),
          check: recheck ? check : undefined,
        },
        recheck ? photos : []
      ),
    onSuccess: () => {
      toast.success('Handed over — they confirm it on their dashboard. Print the agreement for signing.')
      refresh()
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiMessage(err, 'Could not hand it over')),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Hand over {device.code} — {deviceName(device)}
          </DialogTitle>
          <DialogDescription>
            {device.checkThisMonth
              ? 'Who gets it and which accessories go with it. It was checked this month, so that check goes on the handover.'
              : 'Who gets it, which accessories go with it, and its condition right now (this is the handover check).'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="To">
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose the person" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e._id} value={e._id}>
                    {personName(e)} {e.designation ? `· ${e.designation}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {accessories.length > 0 && (
            <Field label="Accessories">
              <div className="grid gap-1.5 sm:grid-cols-2">
                {accessories.map((a) => (
                  <div key={a._id} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/30 px-3 py-1.5 text-sm">
                    <span className="min-w-0 truncate">
                      {a.name} <span className="text-[11px] text-muted-foreground">({a.inStock} in stock)</span>
                    </span>
                    <Input
                      type="number"
                      min="0"
                      max={a.inStock}
                      className="h-8 w-16"
                      value={qty[a._id] ?? 0}
                      onChange={(e) => setQty((q) => ({ ...q, [a._id]: Math.max(0, Math.min(a.inStock, Number(e.target.value) || 0)) }))}
                    />
                  </div>
                ))}
              </div>
            </Field>
          )}
          <CheckOrMonthCheck device={device} recheck={recheck} onRecheck={setRecheck}>
            <CheckFields kind={device.kind} os={device.os} locationAccount={settings?.locationAccount} apps={settings?.apps ?? []} value={check} onChange={setCheck} photos={photos} onPhotos={setPhotos} />
          </CheckOrMonthCheck>
        </div>
        <DialogFooter>
          <Button onClick={() => assign.mutate()} disabled={!employeeId || (recheck && !check.grade) || assign.isPending}>
            {assign.isPending && <Loader2 className="size-4 animate-spin" />}
            Hand over
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- return

export function ReturnDialog({ open, onOpenChange, device, assignment }: { open: boolean; onOpenChange: (v: boolean) => void; device: Device; assignment?: Assignment }) {
  const refresh = useRefresh()
  const { data: settings } = useQuery({ queryKey: [...DEVICES_KEY, 'settings'], queryFn: devicesApi.settings, enabled: open })
  const [back, setBack] = useState<Record<string, number>>(() => Object.fromEntries((assignment?.accessories ?? []).map((a) => [a.accessory, a.qty])))
  const [check, setCheck] = useState<CheckInput>({ ...emptyCheck(), storageTotalGb: device.storageGb })
  const [photos, setPhotos] = useState<File[]>([])
  const [note, setNote] = useState('')
  const [toRepair, setToRepair] = useState(false)
  // Checked this month already: that check is the return check unless HR checks again.
  const [recheck, setRecheck] = useState(!device.checkThisMonth)
  const ret = useMutation({
    mutationFn: () =>
      devicesApi.returnDevice(
        device._id,
        { check: recheck ? check : undefined, accessoriesReturned: Object.entries(back).map(([accessory, qty]) => ({ accessory, qty })), note, toRepair },
        recheck ? photos : []
      ),
    onSuccess: () => {
      toast.success('Returned — print the return receipt for signing')
      refresh()
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiMessage(err, 'Could not take it back')),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Take back {device.code} from {personName(device.holder)}
          </DialogTitle>
          <DialogDescription>
            {device.checkThisMonth
              ? "It was checked this month, so that check goes on the return. If something has changed since (new damage, a setting off), check it again in front of them."
              : 'Check it in front of them — anything damaged or missing is recorded against their handover.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {(assignment?.accessories ?? []).length > 0 && (
            <Field label="Accessories returned">
              <div className="grid gap-1.5 sm:grid-cols-2">
                {assignment!.accessories.map((a) => (
                  <div key={a.accessory} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/30 px-3 py-1.5 text-sm">
                    <span>
                      {a.label} <span className="text-[11px] text-muted-foreground">(handed over {a.qty})</span>
                    </span>
                    <Input
                      type="number"
                      min="0"
                      max={a.qty}
                      className="h-8 w-16"
                      value={back[a.accessory] ?? a.qty}
                      onChange={(e) => setBack((b) => ({ ...b, [a.accessory]: Math.max(0, Math.min(a.qty, Number(e.target.value) || 0)) }))}
                    />
                  </div>
                ))}
              </div>
            </Field>
          )}
          <CheckOrMonthCheck device={device} recheck={recheck} onRecheck={setRecheck}>
            <CheckFields kind={device.kind} os={device.os} locationAccount={settings?.locationAccount} apps={settings?.apps ?? []} value={check} onChange={setCheck} photos={photos} onPhotos={setPhotos} />
          </CheckOrMonthCheck>
          <Field label="Note">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-primary" checked={toRepair} onChange={(e) => setToRepair(e.target.checked)} />
            Send it for repair (it is not available until it is back)
          </label>
        </div>
        <DialogFooter>
          <Button onClick={() => ret.mutate()} disabled={(recheck && !check.grade) || ret.isPending}>
            {ret.isPending && <Loader2 className="size-4 animate-spin" />}
            Take it back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- lost

export function LostDialog({ open, onOpenChange, device }: { open: boolean; onOpenChange: (v: boolean) => void; device: Device }) {
  const refresh = useRefresh()
  const [note, setNote] = useState('')
  const lost = useMutation({
    mutationFn: () => devicesApi.lost(device._id, note),
    onSuccess: () => {
      toast.success('Marked lost — work through the runbook (lock, SIM, passwords, police complaint)')
      refresh()
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiMessage(err, 'Could not mark it lost')),
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark {device.code} lost</DialogTitle>
          <DialogDescription>
            Lost, stolen, or not returned. A runbook opens: lock it, block the SIM, change the password of every account on it, file a police complaint with
            the IMEI.{' '}
            {device.holder ? `Its recovery value goes against ${personName(device.holder)}'s handover (taken from their full & final if they leave).` : ''}
          </DialogDescription>
        </DialogHeader>
        <Field label="What happened">
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="destructive" onClick={() => lost.mutate()} disabled={lost.isPending}>
            {lost.isPending && <Loader2 className="size-4 animate-spin" />}
            Mark lost
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- HR's own check

export function HrCheckDialog({ open, onOpenChange, device }: { open: boolean; onOpenChange: (v: boolean) => void; device: Device }) {
  const refresh = useRefresh()
  const { data: settings } = useQuery({ queryKey: [...DEVICES_KEY, 'settings'], queryFn: devicesApi.settings, enabled: open })
  const [check, setCheck] = useState<CheckInput>({ ...emptyCheck(), storageTotalGb: device.storageGb })
  const [photos, setPhotos] = useState<File[]>([])
  const save = useMutation({
    mutationFn: () => devicesApi.check(device._id, check, photos),
    onSuccess: () => {
      toast.success('Check saved')
      refresh()
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiMessage(err, 'Could not save the check')),
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Check {device.code}</DialogTitle>
          <DialogDescription>
            Recorded as verified by you.
            {device.checkThisMonth ? ` It was already checked this month (${shortDate(device.checkThisMonth.createdAt)}) — this one replaces it as this month's check.` : ''}
          </DialogDescription>
        </DialogHeader>
        <CheckFields kind={device.kind} os={device.os} locationAccount={settings?.locationAccount} apps={settings?.apps ?? []} value={check} onChange={setCheck} photos={photos} onPhotos={setPhotos} />
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!check.grade || save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            Save check
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
