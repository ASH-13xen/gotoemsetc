import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { Building2, CheckCircle2, KeyRound, Loader2, ShieldAlert, UploadCloud } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  getPublicClientDocumentStatus,
  uploadPublicClientDocuments,
  verifyClientDocumentAccessCode,
  type PublicClientDocumentStatus,
} from '@/api/publicClientDocuments.api'

function errorMessageFrom(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    return (error.response?.data as { message?: string } | undefined)?.message || fallback
  }
  return fallback
}

function CenteredMessage({ icon, title, description }: { icon: React.ReactNode; title: string; description?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <div className="flex max-w-sm flex-col items-center gap-4 bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
        {icon}
        <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && <p className="text-sm font-semibold tracking-wide text-muted-foreground">{description}</p>}
      </div>
    </div>
  )
}

export default function PublicClientUploadPage() {
  const { token } = useParams<{ token: string }>()
  const queryClient = useQueryClient()
  const [selectedFiles, setSelectedFiles] = useState<Record<number, File>>({})
  const [codeInput, setCodeInput] = useState('')
  const [verifiedCode, setVerifiedCode] = useState<string | null>(null)

  const verifyMutation = useMutation({
    mutationFn: () => verifyClientDocumentAccessCode(token as string, codeInput),
    onSuccess: () => setVerifiedCode(codeInput),
    onError: (error) => toast.error(errorMessageFrom(error, 'Incorrect access code')),
  })

  const statusQuery = useQuery({
    queryKey: ['publicClientDocumentStatus', token, verifiedCode],
    queryFn: () => getPublicClientDocumentStatus(token as string, verifiedCode as string),
    enabled: Boolean(token) && Boolean(verifiedCode),
    retry: false,
  })

  const uploadMutation = useMutation({
    mutationFn: () => uploadPublicClientDocuments(token as string, verifiedCode as string, selectedFiles),
    onSuccess: (result) => {
      toast.success('Documents submitted — thank you!')
      setSelectedFiles({})
      // A fully-fulfilled upload clears the access code server-side (see
      // clientDocumentRequest.service.js), so refetching status with the
      // now-stale code would fail — patch the cached status directly from
      // this response instead of ever re-verifying the code.
      queryClient.setQueryData(
        ['publicClientDocumentStatus', token, verifiedCode],
        (old: PublicClientDocumentStatus | undefined) =>
          old ? { ...old, uploadedSlots: result.uploadedSlots, status: result.status } : old
      )
    },
    onError: () => toast.error('Could not upload — please check the files and try again'),
  })

  if (!verifiedCode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <KeyRound className="size-8 text-muted-foreground" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">Enter access code</h1>
          <p className="text-sm font-semibold tracking-wide text-muted-foreground">
            You should have received a 6-digit code separately from this link.
          </p>
          <form
            className="w-full space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (codeInput.trim().length === 6) verifyMutation.mutate()
            }}
          >
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full rounded-xl border border-border bg-secondary/30 p-4 text-center text-2xl font-mono font-bold tracking-[0.5em] text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button
              type="submit"
              className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:opacity-95"
              disabled={codeInput.trim().length !== 6 || verifyMutation.isPending}
            >
              {verifyMutation.isPending && <Loader2 className="size-5 animate-spin" />}
              Continue
            </Button>
          </form>
        </div>
      </div>
    )
  }

  if (statusQuery.isLoading) {
    return <CenteredMessage icon={<Loader2 className="size-8 animate-spin text-primary" />} title="LOADING…" />
  }

  if (statusQuery.isError) {
    return (
      <CenteredMessage
        icon={<ShieldAlert className="size-8 text-destructive" />}
        title={errorMessageFrom(statusQuery.error, 'LINK IS INVALID.')}
        description="Please contact us for a new link."
      />
    )
  }

  const status = statusQuery.data
  if (!status) return null

  const isUploaded = (slotIndex: number) => status.uploadedSlots.includes(slotIndex)
  const hasSelection = Object.keys(selectedFiles).length > 0

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <main className="mx-auto max-w-md space-y-6">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Building2 className="size-5 text-primary" />
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Secure Document Collection</span>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 space-y-6 shadow-sm">
          <div className="border-b border-border pb-4">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Document Request</h1>
            <p className="mt-2 text-sm font-semibold tracking-wide text-muted-foreground">
              Hi {status.clientName}, please upload the requested documents.
            </p>
          </div>

          <div className="space-y-4">
            {status.requestedDocTypes.map((label, slotIndex) => {
              const uploaded = isUploaded(slotIndex)
              return (
                <div key={slotIndex} className="bg-secondary/40 rounded-xl p-4 border border-border/50">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-foreground">{label}</span>
                    {uploaded && (
                      <span className="inline-flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 rounded-lg">
                        <CheckCircle2 className="size-3" />
                        Submitted
                      </span>
                    )}
                  </div>
                  <label className="flex h-14 cursor-pointer items-center justify-center gap-2 border border-dashed border-muted-foreground/30 bg-card hover:bg-secondary/50 transition-colors rounded-xl p-4">
                    <UploadCloud className="size-5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-semibold text-foreground select-none">
                      {selectedFiles[slotIndex]?.name ?? (uploaded ? 'Replace file…' : 'Choose file…')}
                    </span>
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setSelectedFiles((prev) => ({ ...prev, [slotIndex]: file }))
                      }}
                    />
                  </label>
                </div>
              )
            })}
          </div>

          <Button
            className="w-full bg-primary text-primary-foreground font-bold text-base h-12 rounded-xl hover:opacity-95 transition-all mt-4"
            disabled={!hasSelection || uploadMutation.isPending}
            onClick={() => uploadMutation.mutate()}
          >
            {uploadMutation.isPending && <Loader2 className="size-5 animate-spin" />}
            Submit Documents
          </Button>
        </div>
      </main>
    </div>
  )
}
