import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { Building2, CheckCircle2, KeyRound, Loader2, ShieldAlert, UploadCloud } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useConfig } from '@/hooks/useConfig'
import {
  getPublicUploadStatus,
  uploadPublicDocuments,
  verifyUploadAccessCode,
  type PublicUploadStatus,
} from '@/api/publicUpload.api'

function errorMessageFrom(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    return (error.response?.data as { message?: string } | undefined)?.message || fallback
  }
  return fallback
}

function CenteredMessage({ icon, title, description }: { icon: ReactNode; title: string; description?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <div className="flex max-w-sm flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center">
        {icon}
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
    </div>
  )
}

export default function PublicUploadPage() {
  const { token } = useParams<{ token: string }>()
  const queryClient = useQueryClient()
  const { data: config } = useConfig()
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File>>({})
  const [codeInput, setCodeInput] = useState('')
  const [verifiedCode, setVerifiedCode] = useState<string | null>(null)

  const verifyMutation = useMutation({
    mutationFn: () => verifyUploadAccessCode(token as string, codeInput),
    onSuccess: () => setVerifiedCode(codeInput),
    onError: (error) => toast.error(errorMessageFrom(error, 'Incorrect access code')),
  })

  const statusQuery = useQuery({
    queryKey: ['publicUploadStatus', token, verifiedCode],
    queryFn: () => getPublicUploadStatus(token as string, verifiedCode as string),
    enabled: Boolean(token) && Boolean(verifiedCode),
    retry: false,
  })

  const uploadMutation = useMutation({
    mutationFn: () => uploadPublicDocuments(token as string, verifiedCode as string, selectedFiles),
    onSuccess: (result) => {
      toast.success('Documents submitted — thank you!')
      setSelectedFiles({})
      // A fully-fulfilled upload clears the access code server-side (see
      // uploadRequest.service.js), so refetching status with the now-stale
      // code would fail — patch the cached status directly from this
      // response instead of ever re-verifying the code.
      queryClient.setQueryData(
        ['publicUploadStatus', token, verifiedCode],
        (old: PublicUploadStatus | undefined) =>
          old ? { ...old, uploadedDocTypes: result.uploadedDocTypes, status: result.status } : old
      )
    },
    onError: () => toast.error('Could not upload — please check the files and try again'),
  })

  if (!verifiedCode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center">
          <KeyRound className="size-7 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">Enter access code</h1>
          <p className="text-sm text-muted-foreground">HR sent you a 6-digit code separately from this link.</p>
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
              className="w-full rounded-lg bg-secondary/60 p-4 text-center font-mono text-2xl font-semibold tracking-[0.5em] text-foreground focus:ring-2 focus:ring-primary/30 focus:outline-none"
            />
            <Button type="submit" size="lg" className="w-full" disabled={codeInput.trim().length !== 6 || verifyMutation.isPending}>
              {verifyMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Continue
            </Button>
          </form>
        </div>
      </div>
    )
  }

  if (statusQuery.isLoading) {
    return <CenteredMessage icon={<Loader2 className="size-7 animate-spin text-muted-foreground" />} title="Loading…" />
  }

  if (statusQuery.isError) {
    return (
      <CenteredMessage
        icon={<ShieldAlert className="size-7 text-destructive" />}
        title={errorMessageFrom(statusQuery.error, 'Link is invalid.')}
        description="Please contact HR for a new link."
      />
    )
  }

  const status = statusQuery.data
  if (!status) return null

  const labelFor = (key: string) => config?.docTypes.find((d) => d.key === key)?.label ?? key
  const isUploaded = (key: string) => status.uploadedDocTypes.includes(key)
  const hasSelection = Object.keys(selectedFiles).length > 0

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Building2 className="size-4" />
          <span className="text-xs font-medium">EMS secure collection</span>
        </div>

        <div className="space-y-6 rounded-xl border border-border bg-card p-8">
          <div className="border-b border-border pb-4">
            <h1 className="text-lg font-semibold text-foreground">Upload request</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Hi {status.employeeName}, please upload the requested documents.
            </p>
          </div>

          <div className="space-y-3">
            {status.requestedDocTypes.map((docType) => {
              const uploaded = isUploaded(docType)
              return (
                <div key={docType} className="rounded-lg bg-secondary/40 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{labelFor(docType)}</span>
                    {uploaded && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="size-3" />
                        Submitted
                      </span>
                    )}
                  </div>
                  <label className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/30 bg-card p-4 transition-colors hover:bg-secondary/50">
                    <UploadCloud className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium text-foreground select-none">
                      {selectedFiles[docType]?.name ?? (uploaded ? 'Replace file…' : 'Choose file…')}
                    </span>
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setSelectedFiles((prev) => ({ ...prev, [docType]: file }))
                      }}
                    />
                  </label>
                </div>
              )
            })}
          </div>

          <Button
            size="lg"
            className="w-full"
            disabled={!hasSelection || uploadMutation.isPending}
            onClick={() => uploadMutation.mutate()}
          >
            {uploadMutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Submit requests
          </Button>
        </div>
      </div>
    </div>
  )
}
