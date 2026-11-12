import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Camera, Loader2, Smartphone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DashboardCard } from '@/components/dashboard/DashboardCard'
import { listClients } from '@/api/clients.api'
import { listOpenEmployeeDirectory } from '@/api/employees.api'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import {
  GENUINE_LABEL,
  GENUINE_PARTS,
  GRADE_LABEL,
  ISSUE_LABEL,
  acceptDevice,
  apiMessage,
  deviceFile,
  deviceName,
  logFootage,
  myDevices,
  reportDeviceIssue,
  sendMonthlyCheck,
  shootDrives,
  type CheckInput,
  type GenuineState,
  type Grade,
  type MyDevice,
  type MyDevices,
  type PartState,
} from '@/api/devices.api'

// The company devices this person holds: accept a handover, send the
// monthly check (HR verifies it), report a problem, log shoot footage once
// it is on the company Drive, and the brand kit for the WhatsApp profile.
// Shows nothing for someone with no company device.

export const KEY = ['my-devices']
const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '')
const nextMonth = () => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('en-IN', { month: 'long' })
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`

async function openFile(id: string) {
  const url = URL.createObjectURL(await deviceFile(id))
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

const STATES: PartState[] = ['ok', 'worn', 'damaged', 'missing']
const STATE_STYLE: Record<PartState, string> = {
  ok: 'bg-emerald-500/15 text-emerald-700',
  worn: 'bg-amber-500/15 text-amber-700',
  damaged: 'bg-destructive/15 text-destructive',
  missing: 'bg-zinc-500/15 text-zinc-700',
}

export function CheckDialog({
  device,
  apps,
  locationAccount,
  onClose,
}: {
  device: MyDevice
  apps: MyDevices['apps']
  locationAccount?: string | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [value, setValue] = useState<CheckInput>({ parts: {}, security: {}, apps: [], storageTotalGb: device.storageGb ?? '' })
  const [photos, setPhotos] = useState<File[]>([])
  const set = (patch: Partial<CheckInput>) => setValue((v) => ({ ...v, ...patch }))
  const appState = (key: string) => value.apps.find((a) => a.key === key) ?? { key, installed: false, loggedIn: false }
  const setApp = (key: string, patch: { installed?: boolean; loggedIn?: boolean }) => {
    const next = { ...appState(key), ...patch }
    if (patch.installed === false) next.loggedIn = false
    set({ apps: [...value.apps.filter((a) => a.key !== key), next] })
  }
  const phone = device.kind === 'phone' || device.kind === 'tablet'
  const iphone = device.os === 'ios'
  const missing = [
    !value.grade && 'the overall condition',
    device.parts.some((p) => !value.parts[p.key]) && 'every part',
    value.storageFreeGb === undefined || value.storageFreeGb === '' ? 'the free storage' : null,
    device.securityItems.some((s) => value.security[s.key] === undefined) && 'every security setting',
    device.locationItems?.some((s) => value.location?.[s.key] === undefined) && 'every location setting',
    iphone && GENUINE_PARTS.some((p) => !value.genuine?.[p.key]) && 'the Parts and Service History',
    photos.length < 2 && 'at least 2 photos (front and back)',
  ].filter(Boolean) as string[]
  const send = useMutation({
    mutationFn: () => sendMonthlyCheck(device._id, value, photos),
    onSuccess: () => {
      toast.success('Sent — HR will verify it')
      queryClient.invalidateQueries({ queryKey: KEY })
      onClose()
    },
    onError: (err) => toast.error(apiMessage(err, 'Could not send')),
  })

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {device.code} · {deviceName(device)} — this month's check
          </DialogTitle>
          <DialogDescription>Check the phone itself, honestly. HR verifies every check; something wrong is fixed, not held against you.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Overall condition</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(GRADE_LABEL) as Grade[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => set({ grade: g })}
                  className={cn('rounded-lg border px-2 py-2 text-left text-xs font-medium', value.grade === g ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-secondary/60')}
                >
                  {GRADE_LABEL[g]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Each part</Label>
            {device.parts.map((part) => (
              <div key={part.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/30 px-3 py-1.5">
                <span className="text-sm">{part.label}</span>
                <div className="flex gap-1">
                  {STATES.map((state) => (
                    <button
                      key={state}
                      type="button"
                      onClick={() => set({ parts: { ...value.parts, [part.key]: state } })}
                      className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize', value.parts[part.key] === state ? STATE_STYLE[state] : 'text-muted-foreground hover:bg-secondary')}
                    >
                      {state}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {iphone && (
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Parts and Service History — Settings → General → About (a part never replaced is not listed)</Label>
              {GENUINE_PARTS.map((part) => (
                <div key={part.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/30 px-3 py-1.5">
                  <span className="text-sm">{part.label}</span>
                  <div className="flex gap-1">
                    {(Object.keys(GENUINE_LABEL) as GenuineState[]).map((state) => (
                      <button
                        key={state}
                        type="button"
                        onClick={() => set({ genuine: { ...value.genuine, [part.key]: state } })}
                        className={cn(
                          'rounded-md px-2 py-0.5 text-[11px] font-semibold',
                          value.genuine?.[part.key] === state ? (state === 'unknown' ? STATE_STYLE.damaged : STATE_STYLE.ok) : 'text-muted-foreground hover:bg-secondary'
                        )}
                      >
                        {GENUINE_LABEL[state]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Storage total (GB)</Label>
              <Input type="number" min="0" value={value.storageTotalGb ?? ''} onChange={(e) => set({ storageTotalGb: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Storage free (GB)</Label>
              <Input type="number" min="0" value={value.storageFreeGb ?? ''} onChange={(e) => set({ storageFreeGb: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Battery health (%)</Label>
              <Input type="number" min="0" max="100" value={value.batteryHealth ?? ''} onChange={(e) => set({ batteryHealth: e.target.value })} />
            </div>
          </div>
          <p className="-mt-3 text-[11px] text-muted-foreground">
            iPhone: Capacity and Available are in Settings → General → About; battery health is Settings → Battery → Battery Health (Maximum Capacity).
            Android: Settings → Storage, and Settings → Battery.
          </p>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Security settings</Label>
            {device.securityItems.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/30 px-3 py-1.5">
                <span className="text-sm">{item.label}</span>
                <div className="flex shrink-0 gap-1">
                  {[true, false].map((on) => (
                    <button
                      key={String(on)}
                      type="button"
                      onClick={() => set({ security: { ...value.security, [item.key]: on } })}
                      className={cn(
                        'rounded-md px-2 py-0.5 text-[11px] font-semibold',
                        value.security[item.key] === on ? (on ? STATE_STYLE.ok : STATE_STYLE.damaged) : 'text-muted-foreground hover:bg-secondary'
                      )}
                    >
                      {on ? 'On' : 'Off'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {(device.locationItems?.length ?? 0) > 0 && (
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Location — so the company can see where the device is</Label>
              {device.locationItems.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/30 px-3 py-1.5">
                  <span className="text-sm">{item.label}</span>
                  <div className="flex shrink-0 gap-1">
                    {[true, false].map((on) => (
                      <button
                        key={String(on)}
                        type="button"
                        onClick={() => set({ location: { ...value.location, [item.key]: on } })}
                        className={cn(
                          'rounded-md px-2 py-0.5 text-[11px] font-semibold',
                          value.location?.[item.key] === on ? (on ? STATE_STYLE.ok : STATE_STYLE.damaged) : 'text-muted-foreground hover:bg-secondary'
                        )}
                      >
                        {on ? 'On' : 'Off'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {locationAccount && (
                <p className="text-[11px] text-muted-foreground">
                  Share the location from Google Maps → profile picture → Location sharing → "Until you turn this off" → {locationAccount}.
                </p>
              )}
            </div>
          )}
          {phone && (
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Apps — installed, and signed in to the company account</Label>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {apps.map((app) => {
                  const s = appState(app.key)
                  return (
                    <div key={app.key} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/30 px-3 py-1.5 text-sm">
                      <span className="min-w-0 truncate">{app.label}</span>
                      <span className="flex shrink-0 gap-2 text-[11px]">
                        <label className="flex items-center gap-1">
                          <input type="checkbox" className="accent-primary" checked={Boolean(s.installed)} onChange={(e) => setApp(app.key, { installed: e.target.checked })} />
                          Installed
                        </label>
                        <label className="flex items-center gap-1">
                          <input type="checkbox" className="accent-primary" checked={Boolean(s.loggedIn)} disabled={!s.installed} onChange={(e) => setApp(app.key, { loggedIn: e.target.checked })} />
                          Signed in
                        </label>
                      </span>
                    </div>
                  )
                })}
              </div>
              <label className="mt-1 flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-primary" checked={Boolean(value.galleryBackedUp)} onChange={(e) => set({ galleryBackedUp: e.target.checked })} />
                Gallery and shoot footage backed up to the company Drive / Photos
              </label>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Anything else</Label>
            <Textarea rows={2} value={value.remarks ?? ''} onChange={(e) => set({ remarks: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Photos — front, back, and any damage</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-secondary/40">
              <Camera className="size-4" />
              {photos.length ? `${photos.length} photo${photos.length === 1 ? '' : 's'} chosen` : 'Add photos'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => setPhotos((p) => [...p, ...Array.from(e.target.files ?? [])].slice(0, 8))}
              />
            </label>
          </div>
        </div>
        <DialogFooter className="items-center">
          {missing.length > 0 && <p className="mr-auto text-xs text-muted-foreground">Still needed: {missing.join(', ')}.</p>}
          <Button onClick={() => send.mutate()} disabled={missing.length > 0 || send.isPending}>
            {send.isPending && <Loader2 className="size-4 animate-spin" />}
            Send to HR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function IssueDialog({ device, onClose }: { device: MyDevice; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [category, setCategory] = useState('storage')
  const [description, setDescription] = useState('')
  const send = useMutation({
    mutationFn: () => reportDeviceIssue(device._id, { category, description }),
    onSuccess: () => {
      toast.success('HR has been told')
      queryClient.invalidateQueries({ queryKey: KEY })
      onClose()
    },
    onError: (err) => toast.error(apiMessage(err, 'Could not send')),
  })
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>A problem with {device.code}</DialogTitle>
          <DialogDescription>HR is told at once, and it stays on the phone's record.</DialogDescription>
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
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is happening? Any error message?" />
        </div>
        <DialogFooter>
          <Button onClick={() => send.mutate()} disabled={send.isPending}>
            {send.isPending && <Loader2 className="size-4 animate-spin" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Logging a shoot upload: which company Drive it went to, the link, who
// uploaded it (them by default), and the shoot. The time it's logged is saved
// automatically; HR then opens the link and verifies it.
export function FootageDialog({ devices, onClose }: { devices: MyDevice[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { data: clients = [] } = useQuery({ queryKey: ['task-clients'], queryFn: listClients, retry: false })
  const { data: drives = [] } = useQuery({ queryKey: ['shoot-drives'], queryFn: shootDrives })
  const { data: people = [] } = useQuery({ queryKey: ['employee-directory'], queryFn: listOpenEmployeeDirectory })
  const NONE = '__none__'
  const [form, setForm] = useState({
    device: devices.find((d) => d.kind === 'phone')?._id ?? devices[0]?._id ?? NONE,
    driveAccount: '',
    driveLink: '',
    uploadedBy: user?.employeeLink ?? '',
    shootDate: '',
    client: '',
    clientName: '',
    files: '',
    sizeGb: '',
    clearedFromPhone: false,
  })
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }))
  const send = useMutation({
    mutationFn: () =>
      logFootage({
        device: form.device === NONE ? undefined : form.device,
        driveAccount: form.driveAccount || undefined,
        driveLink: form.driveLink,
        uploadedBy: form.uploadedBy || undefined,
        shootDate: form.shootDate || undefined,
        client: form.client || undefined,
        clientName: form.client ? undefined : form.clientName || undefined,
        files: form.files,
        sizeGb: form.sizeGb,
        clearedFromPhone: form.clearedFromPhone,
      }),
    onSuccess: () => {
      toast.success('Logged — HR will verify it')
      queryClient.invalidateQueries({ queryKey: KEY })
      onClose()
    },
    onError: (err) => toast.error(apiMessage(err, 'Could not log')),
  })
  const needsDrive = drives.length > 0 && !form.driveAccount
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Log a shoot upload</DialogTitle>
          <DialogDescription>
            Upload the footage to the company Google Drive first (Drive app → + → Upload), then log it here. It's saved with today's date and time; HR then
            opens the link and verifies it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Which Google Drive</Label>
            {drives.length ? (
              <Select value={form.driveAccount} onValueChange={(v) => set('driveAccount', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose the Drive it went to" />
                </SelectTrigger>
                <SelectContent>
                  {drives.map((d) => (
                    <SelectItem key={d._id} value={d._id}>
                      {d.identifier}
                      {d.label ? ` · ${d.label}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground">HR hasn't added the company Drives yet — paste the link below.</p>
            )}
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Drive link (the folder with the footage)</Label>
            <Input placeholder="https://drive.google.com/…" value={form.driveLink} onChange={(e) => set('driveLink', e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Uploaded by</Label>
            <Select value={form.uploadedBy} onValueChange={(v) => set('uploadedBy', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Who uploaded it" />
              </SelectTrigger>
              <SelectContent>
                {people.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {`${p.firstName} ${p.lastName ?? ''}`.trim()}
                    {p._id === user?.employeeLink ? ' (me)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Shot on</Label>
            <Select value={form.device} onValueChange={(v) => set('device', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {devices.map((d) => (
                  <SelectItem key={d._id} value={d._id}>
                    {d.code} · {deviceName(d)}
                  </SelectItem>
                ))}
                <SelectItem value={NONE}>Not a company device</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Client</Label>
            {clients.length ? (
              <Select value={form.client || 'other'} onValueChange={(v) => set('client', v === 'other' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="other">Someone else…</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
            {!form.client && <Input placeholder="Client / shoot name" value={form.clientName} onChange={(e) => set('clientName', e.target.value)} />}
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Shoot date (optional)</Label>
            <Input type="date" value={form.shootDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set('shootDate', e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Files (optional)</Label>
            <Input type="number" min="0" value={form.files} onChange={(e) => set('files', e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Size in GB (optional)</Label>
            <Input type="number" min="0" step="0.1" value={form.sizeGb} onChange={(e) => set('sizeGb', e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="accent-primary" checked={form.clearedFromPhone} onChange={(e) => set('clearedFromPhone', e.target.checked)} />
            I've checked it opens on Drive and cleared it from the phone
          </label>
        </div>
        <DialogFooter className="items-center">
          {needsDrive && <p className="mr-auto text-xs text-muted-foreground">Choose which Drive it went to.</p>}
          <Button onClick={() => send.mutate()} disabled={!form.driveLink || needsDrive || send.isPending}>
            {send.isPending && <Loader2 className="size-4 animate-spin" />}
            Log it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function BrandDialog({ brand, onClose }: { brand: MyDevices['brand']; onClose: () => void }) {
  const row = (label: string, value?: string) =>
    value ? (
      <div className="rounded-lg bg-secondary/30 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <button type="button" className="text-[11px] font-semibold text-primary" onClick={() => navigator.clipboard.writeText(value).then(() => toast.success('Copied'))}>
            Copy
          </button>
        </div>
        <p className="text-sm whitespace-pre-line">{value}</p>
      </div>
    ) : null
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Brand kit</DialogTitle>
          <DialogDescription>
            Every company phone's WhatsApp Business profile looks the same: WhatsApp Business → Settings → Business tools → Business profile. Update the
            Truecaller name to the same.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {row('Business name', brand.whatsappName)}
          {row('About / bio', brand.bio)}
          {row('Website', brand.website)}
          {row('Address', brand.address)}
          <div className="flex gap-2">
            {brand.logo && (
              <Button variant="outline" size="sm" onClick={() => openFile(brand.logo!)}>
                Open the logo
              </Button>
            )}
            {brand.brochure && (
              <Button variant="outline" size="sm" onClick={() => openFile(brand.brochure!)}>
                Open the brochure
              </Button>
            )}
          </div>
          {!brand.whatsappName && !brand.bio && !brand.logo && <p className="text-sm text-muted-foreground">HR hasn't filled in the brand kit yet.</p>}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export const HELP: { title: string; steps: string[] }[] = [
  {
    title: 'Storage is full',
    steps: [
      'Upload the shoot footage to the company Drive and log it here first.',
      'Then delete it from the gallery and empty "Recently deleted".',
      'WhatsApp → Settings → Storage and data → Manage storage: clear big media.',
    ],
  },
  {
    title: 'An app won’t download',
    steps: ['Free at least 2 GB of storage.', 'Update the phone (Settings → Software update).', 'Still stuck? Report it here — HR sees it at once.'],
  },
  {
    title: 'iPhone contacts not in Gmail',
    steps: ['Settings → Contacts → Accounts → the company Gmail → Contacts on.', 'Settings → Contacts → Default Account → Gmail.'],
  },
  {
    title: 'The phone is lost or stolen',
    steps: ['Tell HR at once — every minute counts.', 'HR locks it, blocks the SIM and changes the passwords; you file the police complaint with the IMEI.'],
  },
]

export function DeviceRow({ device, data, onCheck, onIssue }: { device: MyDevice; data: MyDevices; onCheck: () => void; onIssue: () => void }) {
  const queryClient = useQueryClient()
  const accept = useMutation({
    mutationFn: () => acceptDevice(device.assignment!._id),
    onSuccess: () => {
      toast.success('Accepted')
      queryClient.invalidateQueries({ queryKey: KEY })
    },
    onError: (err) => toast.error(apiMessage(err, 'Could not accept')),
  })
  const c = device.monthCheck
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 rounded-xl bg-secondary/30 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold break-words text-foreground">
            {device.code} · {deviceName(device)}
          </p>
          <p className="text-xs text-muted-foreground">
            {device.simNumber ? `${device.simNumber} · ` : ''}
            {device.assignment?.accessories.length ? `with ${device.assignment.accessories.map((a) => `${a.label}${a.qty > 1 ? ` × ${a.qty}` : ''}`).join(', ')}` : 'no accessories'}
          </p>
        </div>
        <span className="shrink-0">
        {!c && device.newThisMonth ? (
          <Badge variant="secondary">First check in {nextMonth()}</Badge>
        ) : !c || c.status === 'rejected' ? (
          device.checkOverdue ? (
            <Badge variant="destructive">Check overdue</Badge>
          ) : (
            <Badge variant="warning">Check due by the {ordinal(data.checkDueDay)}</Badge>
          )
        ) : c.status === 'submitted' ? (
          <Badge variant="secondary">Check with HR</Badge>
        ) : (
          <Badge variant="success">Checked this month</Badge>
        )}
        </span>
      </div>
      {device.assignment && !device.assignment.acceptedAt && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs text-foreground">
          <span className="flex-1">HR handed you this on {fmt(device.assignment.assignedAt)}. Check the phone and accessories, then accept.</span>
          <Button size="sm" className="h-7" onClick={() => accept.mutate()} disabled={accept.isPending}>
            Accept
          </Button>
        </div>
      )}
      {c?.status === 'rejected' && <p className="rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">HR sent your check back: {c.reviewNote || 'please redo it'}</p>}
      {device.openIssues.map((i) => (
        <p key={i._id} className="text-xs text-muted-foreground">
          Reported {fmt(i.createdAt)}: {ISSUE_LABEL[i.category] ?? i.category} — HR is on it
        </p>
      ))}
      <div className="flex flex-wrap gap-2">
        {((!c && !device.newThisMonth) || c?.status === 'rejected') && (
          <Button size="sm" className="h-8" onClick={onCheck}>
            Do this month's check
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-8" onClick={onIssue}>
          Report a problem
        </Button>
      </div>
    </div>
  )
}

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Phone help</DialogTitle>
          <DialogDescription>The usual problems, and what to do.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {HELP.map((h) => (
            <div key={h.title}>
              <p className="text-sm font-semibold">{h.title}</p>
              <ol className="list-decimal space-y-0.5 pl-5 text-sm text-foreground/85">
                {h.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// On the dashboard: the devices and what they need now. Everything else —
// details, shoot uploads, brand kit — is on the My devices page.
export function MyDevicesCard() {
  const { user } = useAuth()
  const { data } = useQuery({ queryKey: KEY, queryFn: myDevices, enabled: Boolean(user?.employeeLink), refetchInterval: 5 * 60_000 })
  const [dialog, setDialog] = useState<{ kind: 'check' | 'issue'; device: MyDevice } | null>(null)
  if (!data?.devices.length) return null

  return (
    <DashboardCard icon={<Smartphone className="size-4" />} title="My company devices" viewAllHref="/my-devices" viewAllLabel="Open">
      <div className="mt-4 grid grid-cols-1 gap-2">
        {data.devices.map((d) => (
          <DeviceRow key={d._id} device={d} data={data} onCheck={() => setDialog({ kind: 'check', device: d })} onIssue={() => setDialog({ kind: 'issue', device: d })} />
        ))}
        {data.footage.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Last upload logged {fmt(data.footage[0].createdAt)}
            {data.footage.some((f) => !f.verifiedAt) ? ' · waiting for HR to verify' : ' · verified'}
          </p>
        )}
      </div>
      {dialog?.kind === 'check' && <CheckDialog device={dialog.device} apps={data.apps} locationAccount={data.locationAccount} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'issue' && <IssueDialog device={dialog.device} onClose={() => setDialog(null)} />}
    </DashboardCard>
  )
}
