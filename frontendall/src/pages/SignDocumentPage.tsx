import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Download, ExternalLink, FileSignature, Loader2, Mail, ShieldCheck, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SignaturePad } from '@/components/esign/SignaturePad'
import { apiMessage, fetchSignFile, getSignView, requestSignCode, signDocument, verifySignCode } from '@/api/esign.api'

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : ''

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto grid max-w-3xl gap-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
          <FileSignature className="size-4" />
          GO-TO Friend · documents
        </div>
        {children}
      </div>
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6 ${className}`}>{children}</div>
}

// Opened from the signing email (or from EMS): confirm a code sent to the
// same email, read the document, sign it (or say why not). No login needed.
export default function SignDocumentPage() {
  const { token = '' } = useParams()
  const { data: view, isLoading, error, refetch } = useQuery({ queryKey: ['esign', token], queryFn: () => getSignView(token), retry: false })
  const [codeSent, setCodeSent] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [session, setSession] = useState<string | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [done, setDone] = useState<null | { kind: 'signed'; code: string; verifyUrl: string } | { kind: 'declined' }>(null)

  // The document, once the code is confirmed (and again after signing: the signed copy).
  const loadFile = async (s: string) => {
    const blob = await fetchSignFile(token, s)
    setFileUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return URL.createObjectURL(blob)
    })
  }
  useEffect(() => () => (fileUrl ? URL.revokeObjectURL(fileUrl) : undefined), [fileUrl])

  const run = async (fn: () => Promise<void>, fallback: string) => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
    } catch (err) {
      setMsg(apiMessage(err, fallback))
    } finally {
      setBusy(false)
    }
  }

  if (isLoading)
    return (
      <Shell>
        <Card>
          <Loader2 className="size-5 animate-spin text-slate-400" />
        </Card>
      </Shell>
    )
  if (error || !view)
    return (
      <Shell>
        <Card>
          <p className="flex items-center gap-2 font-semibold">
            <XCircle className="size-5 text-red-500" />
            {apiMessage(error, 'This link is not valid.')}
          </p>
        </Card>
      </Shell>
    )

  const signedAlready = view.status === 'signed' || done?.kind === 'signed'
  const closed = view.status === 'cancelled' || view.status === 'declined' || done?.kind === 'declined'

  return (
    <Shell>
      <Card>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{view.company}</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{view.title}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {signedAlready
            ? `Signed${view.signedAt ? ` on ${fmt(view.signedAt)}` : ''}. Your signed copy was emailed to you.`
            : closed
              ? view.status === 'cancelled'
                ? 'HR withdrew this document. If you think that is a mistake, ask them to send it again.'
                : 'You chose not to sign this document. HR has been told.'
              : `Hi ${view.firstName || 'there'} — please read this document and sign it below. No printing needed.`}
        </p>
      </Card>

      {/* signed — on this visit, or earlier */}
      {signedAlready && (
        <Card className="grid gap-3">
          <p className="flex items-center gap-2 text-lg font-bold text-emerald-700">
            <CheckCircle2 className="size-5" />
            Signed
          </p>
          <p className="text-sm text-slate-600">
            Document <span className="font-mono font-semibold">{done?.kind === 'signed' ? done.code : view.code}</span>. Anyone can check a copy is genuine at{' '}
            <a className="font-semibold text-indigo-700 underline" href={`/verify/${done?.kind === 'signed' ? done.code : view.code}`}>
              the verification page
            </a>
            .
          </p>
          {session ? (
            fileUrl && (
              <a href={fileUrl} download="signed-document.pdf">
                <Button>
                  <Download className="size-4" />
                  Download your signed copy
                </Button>
              </a>
            )
          ) : (
            <p className="text-xs text-slate-500">To download it here again, confirm a code below.</p>
          )}
        </Card>
      )}

      {/* the code */}
      {!session && !closed && (
        <Card className="grid gap-3">
          <p className="flex items-center gap-2 font-bold">
            <Mail className="size-5 text-indigo-600" />
            First, confirm it's you
          </p>
          <p className="text-sm text-slate-600">We'll email a one-time code to {view.email}.</p>
          {!codeSent ? (
            <Button
              className="justify-self-start"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const r = await requestSignCode(token)
                  setCodeSent(r.sentTo)
                }, 'Could not send the code')
              }
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Email me the code
            </Button>
          ) : (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                run(async () => {
                  const r = await verifySignCode(token, code.trim())
                  setSession(r.session)
                  await loadFile(r.session)
                  void refetch()
                }, 'That code did not work')
              }}
            >
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                className="w-40 text-center font-mono text-lg tracking-[0.3em]"
              />
              <Button type="submit" disabled={busy || code.length !== 6}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Confirm
              </Button>
              <button
                type="button"
                className="text-xs font-semibold text-slate-500 underline"
                onClick={() => run(async () => void (await requestSignCode(token)), 'Could not send the code')}
              >
                Send a new code
              </button>
              <p className="basis-full text-xs text-slate-500">Sent to {codeSent}. It works for 10 minutes.</p>
            </form>
          )}
        </Card>
      )}

      {/* the document */}
      {session && fileUrl && !signedAlready && (
        <Card className="grid gap-3 p-3 sm:p-3">
          <div className="flex items-center justify-between gap-2 px-2 pt-1">
            <p className="text-sm font-bold">Read the document</p>
            <a href={fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700">
              Open it full screen <ExternalLink className="size-3" />
            </a>
          </div>
          <iframe title={view.title} src={fileUrl} className="h-[70vh] w-full rounded-xl border border-slate-200" />
        </Card>
      )}

      {/* signing */}
      {session && !signedAlready && !closed && (
        <Card className="grid gap-4">
              <p className="font-bold">Sign it</p>
              <div className="grid gap-1.5">
                <label className="text-sm font-semibold" htmlFor="esign-name">
                  Your full name
                </label>
                <Input id="esign-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="As on your documents" maxLength={120} />
              </div>
              <SignaturePad onChange={setSignature} />
              <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-indigo-600" />
                <span>{view.consent}</span>
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={busy || !signature || name.trim().length < 3 || !consent}
                  onClick={() =>
                    run(async () => {
                      const r = await signDocument(token, { session, name: name.trim(), signature: signature!, consent })
                      setDone({ kind: 'signed', code: r.code, verifyUrl: r.verifyUrl })
                      await loadFile(session)
                      void refetch()
                    }, 'Could not sign it')
                  }
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                  Sign the document
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Signing records your name, signature, the time, and your device and network address, with a fingerprint of the document — all on a certificate page added to the signed copy.
              </p>
        </Card>
      )}

      {msg && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">{msg}</p>}
      {view.expiresAt && !signedAlready && !closed && <p className="text-center text-xs text-slate-500">This link works until {fmt(view.expiresAt)}.</p>}
    </Shell>
  )
}
