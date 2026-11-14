import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, FileSearch, Loader2, ShieldAlert, ShieldCheck, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiMessage, verifyByCode, verifyUpload, type VerifyRecord } from '@/api/esign.api'

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '—'

function Record({ r }: { r: VerifyRecord }) {
  const final = r.status === 'signed' || r.status === 'issued'
  const rows: [string, string][] = [
    ['Document', `${r.title} (${r.code})`],
    ['Issued by', r.company || ''],
    [r.kind === 'issue' ? 'Issued to' : 'Employee', r.issuedTo || '—'],
    ...(r.companySignatories?.length ? [['Company signature', r.companySignatories.map((s) => `${s.name}${s.title ? `, ${s.title}` : ''}`).join('; ')] as [string, string]] : []),
    ...(r.kind === 'issue' ? [['Issued', fmt(r.issuedAt)] as [string, string]] : [['Signed', r.signedAt ? `${fmt(r.signedAt)} — as “${r.signerName}”` : 'Not signed'] as [string, string]]),
  ]
  return (
    <div className="grid gap-3">
      <p className={`flex items-center gap-2 text-lg font-bold ${final ? 'text-emerald-700' : 'text-amber-700'}`}>
        {final ? <BadgeCheck className="size-5" /> : <ShieldAlert className="size-5" />}
        {final ? (r.kind === 'issue' ? 'A genuine document, issued by GO-TO Friend' : 'A genuine document, signed electronically') : r.status === 'cancelled' ? 'This document was withdrawn' : r.status === 'declined' ? 'This document was not signed (declined)' : 'Sent, not signed yet'}
      </p>
      <dl className="grid gap-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-0.5 border-b border-slate-100 pb-2 sm:grid-cols-[180px_1fr]">
            <dt className="font-semibold text-slate-500">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        {final && r.signedHash && (
          <div className="grid gap-0.5 sm:grid-cols-[180px_1fr]">
            <dt className="font-semibold text-slate-500">Fingerprint (SHA-256)</dt>
            <dd className="break-all font-mono text-xs">{r.signedHash}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}

// The page the certificate's QR code opens — and where anyone can upload a
// copy to see whether it is exactly the signed (or issued) document.
export default function VerifyDocumentPage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const [typed, setTyped] = useState(code)
  const [busy, setBusy] = useState(false)
  const [upload, setUpload] = useState<null | { match: 'signed' | 'issued' | 'as_sent' | 'none'; hash: string; record?: VerifyRecord; name: string }>(null)
  const [err, setErr] = useState<string | null>(null)
  const { data, isLoading } = useQuery({ queryKey: ['verify', code], queryFn: () => verifyByCode(code), enabled: Boolean(code), retry: false })

  const check = async (file: File) => {
    setBusy(true)
    setErr(null)
    try {
      const r = await verifyUpload(file)
      setUpload({ ...r, name: file.name })
    } catch (e) {
      setErr(apiMessage(e, 'Could not check that file'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto grid max-w-2xl gap-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
          <ShieldCheck className="size-4" />
          GO-TO Friend · document verification
        </div>

        <div className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <h1 className="text-2xl font-black tracking-tight">Check a document</h1>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (typed.trim()) navigate(`/verify/${typed.trim().toUpperCase()}`)
            }}
          >
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Document code, e.g. GTF-ABCD-2345" className="min-w-0 flex-1 font-mono" />
            <Button type="submit">
              <FileSearch className="size-4" />
              Look up
            </Button>
          </form>
          {code &&
            (isLoading ? (
              <Loader2 className="size-5 animate-spin text-slate-400" />
            ) : data?.found ? (
              <Record r={data} />
            ) : (
              <p className="flex items-center gap-2 font-semibold text-red-600">
                <ShieldAlert className="size-5" />
                No document has the code {code}.
              </p>
            ))}
        </div>

        <div className="grid gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <p className="font-bold">Is this copy unchanged?</p>
          <p className="text-sm text-slate-600">Upload the PDF. Its fingerprint is compared with the one recorded when it was signed or issued — any change at all, and it won't match. The file isn't kept.</p>
          <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Choose the PDF
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void check(f)
              }}
            />
          </label>
          {err && <p className="text-sm font-medium text-red-600">{err}</p>}
          {upload && (
            <div className="grid gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <p className="text-xs text-slate-500">
                {upload.name} · <span className="break-all font-mono">{upload.hash}</span>
              </p>
              {upload.match === 'none' ? (
                <p className="flex items-center gap-2 font-bold text-red-600">
                  <ShieldAlert className="size-5" />
                  Not a match — this file isn't a document we signed or issued, or it has been changed.
                </p>
              ) : upload.match === 'as_sent' ? (
                <p className="flex items-center gap-2 font-bold text-amber-700">
                  <ShieldAlert className="size-5" />
                  This is the unsigned copy as it was sent — not the signed one.
                </p>
              ) : (
                <p className="flex items-center gap-2 font-bold text-emerald-700">
                  <BadgeCheck className="size-5" />
                  Exact match — this is the {upload.match === 'issued' ? 'issued' : 'signed'} document, unchanged.
                </p>
              )}
              {upload.record?.found && <Record r={upload.record} />}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
