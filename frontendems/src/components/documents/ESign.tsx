import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BadgeCheck, Clock3, Download, Eraser, FileSignature, Loader2, MailCheck, PenLine, Send, ShieldCheck, Upload, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { extractApiErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { useEmployee } from '@/hooks/useEmployees'
import {
  ISSUE_ONLY,
  cancelSignature,
  downloadSignedPdf,
  getSignatories,
  listSignatures,
  openToSign,
  remindSignature,
  saveSignatory,
  sendForSignature,
  type DocumentSignature,
  type Signatory,
} from '@/api/esign.api'

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : ''

export const useSignatures = (employeeId: string | undefined, enabled = true) =>
  useQuery({ queryKey: ['esign', employeeId], queryFn: () => listSignatures(employeeId!), enabled: Boolean(employeeId) && enabled, retry: false })

// The latest e-signing of each document (a newer send replaces older ones).
export function latestByDocument(list: DocumentSignature[] | undefined) {
  const map = new Map<string, DocumentSignature>()
  for (const s of list ?? []) if (!map.has(s.document)) map.set(s.document, s)
  return map
}

function useEsignMutation<T, R>(employeeId: string, fn: (a: T) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['esign', employeeId] })
      qc.invalidateQueries({ queryKey: ['documents', employeeId] })
    },
  })
}

// ---- sending -------------------------------------------------------------------------

export function SendDialog({
  employeeId,
  documentId,
  templateKey,
  title,
  open,
  onOpenChange,
}: {
  employeeId: string
  documentId: string
  templateKey: string
  title: string
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { data } = useEmployee(employeeId)
  const employee = data?.employee
  const companyMail =
    employee?.companyEmail || (employee?.extraDetails ?? []).find((d) => /^\s*company\s*mail\s*id\s*$/i.test(d.key) && /@/.test(d.value ?? ''))?.value || ''
  const [channel, setChannel] = useState<'company' | 'personal'>('company')
  const issue = ISSUE_ONLY.includes(templateKey)
  const send = useEsignMutation(employeeId, () => sendForSignature({ employeeId, documentId, channel }))
  const options = [
    { key: 'company' as const, label: 'Company mail', email: companyMail },
    { key: 'personal' as const, label: 'Personal mail', email: employee?.personalEmail || '' },
  ]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{issue ? 'Send' : 'Send to sign'} — {title}</DialogTitle>
          <DialogDescription>
            {issue
              ? 'It’s emailed as a final copy with a certificate page and a QR code anyone can use to check it’s genuine.'
              : 'They get a link, confirm a code emailed to the same address, read it and sign online — no printing. The signed copy comes back here.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {options.map((o) => (
            <label
              key={o.key}
              className={cn('flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition', channel === o.key ? 'border-primary bg-primary/5' : 'border-border', !o.email && 'cursor-not-allowed opacity-60')}
            >
              <input type="radio" name="esign-channel" checked={channel === o.key} disabled={!o.email} onChange={() => setChannel(o.key)} className="accent-primary" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{o.label}</span>
                <span className="block truncate text-xs normal-case text-muted-foreground">{o.email || 'Not on their profile'}</span>
              </span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={send.isPending || !options.find((o) => o.key === channel)?.email}
            onClick={() =>
              send
                .mutateAsync(undefined)
                .then((s) => {
                  toast.success(s.kind === 'issue' ? `Issued and emailed to ${s.email}` : `Sent to ${s.email} to sign`)
                  onOpenChange(false)
                })
                .catch((err) => toast.error(extractApiErrorMessage(err, 'Could not send it')))
            }
          >
            {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {issue ? 'Send' : 'Send to sign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---- where a document stands -----------------------------------------------------------

export function SignatureStrip({ s, employeeId, canManage }: { s: DocumentSignature; employeeId: string; canManage: boolean }) {
  const remind = useEsignMutation(employeeId, () => remindSignature(s._id))
  const cancel = useEsignMutation(employeeId, () => cancelSignature(s._id))
  const open = s.status === 'sent' || s.status === 'viewed'
  const look =
    s.status === 'signed'
      ? { icon: BadgeCheck, cls: 'bg-emerald-500/10 text-emerald-800', text: `Signed electronically ${fmt(s.signedAt)} as “${s.signerName}”` }
      : s.status === 'issued'
        ? { icon: ShieldCheck, cls: 'bg-emerald-500/10 text-emerald-800', text: `Issued ${fmt(s.issuedAt)} to ${s.email}` }
        : s.status === 'declined'
          ? { icon: XCircle, cls: 'bg-red-500/10 text-red-700', text: `Not signed — ${s.declineReason}` }
          : s.status === 'cancelled'
            ? { icon: XCircle, cls: 'bg-secondary text-muted-foreground', text: `Withdrawn${s.cancelReason ? ` — ${s.cancelReason}` : ''}` }
            : s.status === 'viewed'
              ? { icon: Clock3, cls: 'bg-sky-500/10 text-sky-800', text: `Opened ${fmt(s.viewedAt)} — waiting for the signature (sent to ${s.email})` }
              : { icon: MailCheck, cls: 'bg-sky-500/10 text-sky-800', text: `Sent ${fmt(s.sentAt)} to ${s.email} — not opened yet` }
  const Icon = look.icon
  return (
    <div className={cn('flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs', look.cls)}>
      <Icon className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 font-semibold normal-case">{look.text}</span>
      {(s.status === 'signed' || s.status === 'issued') && (
        <>
          <a href={s.verifyUrl} target="_blank" rel="noreferrer" className="font-mono font-semibold underline">
            {s.code}
          </a>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => downloadSignedPdf(s._id, `${s.templateKey}-${s.code}.pdf`).catch(() => toast.error('Could not download it'))}>
            <Download className="size-3.5" />
            Signed PDF
          </Button>
        </>
      )}
      {open && canManage && (
        <>
          <Button size="sm" variant="ghost" className="h-7" disabled={remind.isPending} onClick={() => remind.mutateAsync(undefined).then(() => toast.success('Sent again, with a new link'))}>
            Remind
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7"
            disabled={cancel.isPending}
            onClick={() => {
              if (window.confirm('Withdraw it? The link stops working.')) cancel.mutateAsync(undefined).then(() => toast.success('Withdrawn'))
            }}
          >
            Withdraw
          </Button>
        </>
      )}
    </div>
  )
}

// ---- the employee: documents to sign, and signed ------------------------------------------

export function MyDocumentsToSign({ employeeId }: { employeeId: string }) {
  const { data: list, isLoading } = useSignatures(employeeId)
  const [opening, setOpening] = useState<string | null>(null)
  const latest = [...latestByDocument(list).values()].filter((s) => s.status !== 'cancelled')
  if (isLoading || latest.length === 0) return null
  return (
    <div className="grid gap-2">
      {latest.map((s) => {
        const open = s.status === 'sent' || s.status === 'viewed'
        return (
          <div key={s._id} className={cn('flex flex-wrap items-center gap-3 rounded-xl border p-3', open ? 'border-primary/40 bg-primary/5' : 'border-border')}>
            <FileSignature className={cn('size-5 shrink-0', open ? 'text-primary' : 'text-muted-foreground')} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{s.title}</p>
              <p className="text-xs normal-case text-muted-foreground">
                {open
                  ? `Waiting for your signature — sent ${fmt(s.sentAt)}`
                  : s.status === 'signed'
                    ? `You signed it ${fmt(s.signedAt)} · ${s.code}`
                    : s.status === 'issued'
                      ? `Issued ${fmt(s.issuedAt)} · ${s.code}`
                      : `You didn't sign it — ${s.declineReason}`}
              </p>
            </div>
            {open ? (
              <Button
                size="sm"
                disabled={opening === s._id}
                onClick={async () => {
                  setOpening(s._id)
                  try {
                    const token = await openToSign(s._id)
                    window.location.href = `/sign/${token}`
                  } catch (err) {
                    toast.error(extractApiErrorMessage(err, 'Could not open it'))
                    setOpening(null)
                  }
                }}
              >
                {opening === s._id ? <Loader2 className="size-4 animate-spin" /> : <PenLine className="size-4" />}
                Review & sign
              </Button>
            ) : (
              (s.status === 'signed' || s.status === 'issued') && (
                <Button size="sm" variant="outline" onClick={() => downloadSignedPdf(s._id, `${s.templateKey}-${s.code}.pdf`).catch(() => toast.error('Could not download it'))}>
                  <Download className="size-4" />
                  Download
                </Button>
              )
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---- the company's signatories (admin, CEO, HR) ---------------------------------------------

function DrawBox({ onChange }: { onChange: (png: Blob | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * 480, y: ((e.clientY - r.top) / r.height) * 160 }
  }
  const done = () => {
    if (!drawing.current) return
    drawing.current = false
    ref.current?.toBlob((b) => onChange(b), 'image/png')
  }
  return (
    <div className="relative rounded-lg border-2 border-dashed border-border bg-white">
      <canvas
        ref={ref}
        width={480}
        height={160}
        className="block h-auto w-full touch-none cursor-crosshair"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          drawing.current = true
          last.current = pos(e)
        }}
        onPointerMove={(e) => {
          const g = ref.current?.getContext('2d')
          if (!drawing.current || !g || !last.current) return
          const p = pos(e)
          g.strokeStyle = '#0f172a'
          g.lineWidth = 3
          g.lineCap = 'round'
          g.beginPath()
          g.moveTo(last.current.x, last.current.y)
          g.lineTo(p.x, p.y)
          g.stroke()
          last.current = p
        }}
        onPointerUp={done}
        onPointerLeave={done}
      />
      <button
        type="button"
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-white/90 px-2 py-0.5 text-xs ring-1 ring-border"
        onClick={() => {
          ref.current?.getContext('2d')?.clearRect(0, 0, 480, 160)
          onChange(null)
        }}
      >
        <Eraser className="size-3" />
        Clear
      </button>
    </div>
  )
}

function SignatoryCard({ s }: { s: Signatory }) {
  const qc = useQueryClient()
  const [name, setName] = useState(s.name)
  const [title, setTitle] = useState(s.title)
  const [image, setImage] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [draw, setDraw] = useState(false)
  useEffect(() => {
    if (!image) return setPreview(null)
    const u = URL.createObjectURL(image)
    setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [image])
  const save = useMutation({
    mutationFn: () => saveSignatory(s.key, { name: name.trim(), title: title.trim() || undefined, image: image ?? undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['esign-signatories'] })
      setImage(null)
      setDraw(false)
      toast.success('Saved — it’s placed on documents generated from now on')
    },
    onError: (err) => toast.error(extractApiErrorMessage(err, 'Could not save')),
  })
  return (
    <div className="grid gap-3 rounded-xl border border-border p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{s.key === 'ceo' ? 'CEO — most letters' : 'HR — appointment, relieving, off-boarding'}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-xs">Name (as the letters print it)</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="normal-case" />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="normal-case" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-20 w-48 place-items-center rounded-lg bg-white ring-1 ring-border">
          {preview || s.image ? <img src={preview || s.image!} alt="" className="max-h-16 max-w-44 object-contain" /> : <span className="text-xs text-muted-foreground">No signature yet</span>}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold">
          <Upload className="size-3.5" />
          Upload image
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) setImage(f)
            }}
          />
        </label>
        <Button type="button" size="sm" variant="outline" onClick={() => setDraw((v) => !v)}>
          <PenLine className="size-3.5" />
          {draw ? 'Hide' : 'Draw it'}
        </Button>
      </div>
      {draw && <DrawBox onChange={setImage} />}
      <p className="text-[11px] text-muted-foreground">A clear signature on a white or transparent background works best. It goes only on letters that name {name || 'this person'}.</p>
      <Button className="justify-self-end" size="sm" disabled={save.isPending || !name.trim()} onClick={() => save.mutate()}>
        {save.isPending && <Loader2 className="size-4 animate-spin" />}
        Save
      </Button>
    </div>
  )
}

export function CompanySignaturesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data } = useQuery({ queryKey: ['esign-signatories'], queryFn: getSignatories, enabled: open })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Company signatures</DialogTitle>
          <DialogDescription>Placed on documents when they are generated — the CEO’s on most letters, HR’s where the letter is signed by HR.</DialogDescription>
        </DialogHeader>
        {!data ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : <div className="grid gap-3">{data.map((s) => <SignatoryCard key={s.key} s={s} />)}</div>}
      </DialogContent>
    </Dialog>
  )
}
