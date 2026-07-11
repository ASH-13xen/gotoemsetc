import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { Building2, CheckCircle2, Loader2, ShieldAlert, UploadCloud } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useConfig } from '@/hooks/useConfig'
import { getPublicUploadStatus, uploadPublicDocuments } from '@/api/publicUpload.api'

function CenteredMessage({ icon, title, description }: { icon: React.ReactNode; title: string; description?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center bg-card rounded-2xl shadow-diffuse border border-border/10 p-8">
        {icon}
        <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">{title}</h1>
        {description && <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">{description}</p>}
      </div>
    </div>
  )
}

export default function PublicUploadPage() {
  const { token } = useParams<{ token: string }>()
  const queryClient = useQueryClient()
  const { data: config } = useConfig()
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File>>({})

  const statusQuery = useQuery({
    queryKey: ['publicUploadStatus', token],
    queryFn: () => getPublicUploadStatus(token as string),
    enabled: Boolean(token),
    retry: false,
  })

  const uploadMutation = useMutation({
    mutationFn: () => uploadPublicDocuments(token as string, selectedFiles),
    onSuccess: () => {
      toast.success('Documents submitted — thank you!')
      setSelectedFiles({})
      queryClient.invalidateQueries({ queryKey: ['publicUploadStatus', token] })
    },
    onError: () => toast.error('Could not upload — please check the files and try again'),
  })

  if (statusQuery.isLoading) {
    return (
      <CenteredMessage
        icon={<Loader2 className="size-8 animate-spin text-neutral-400" />}
        title="LOADING…"
      />
    )
  }

  if (statusQuery.isError) {
    const message = isAxiosError(statusQuery.error)
      ? (statusQuery.error.response?.data as { message?: string } | undefined)?.message
      : undefined
    return (
      <CenteredMessage
        icon={<ShieldAlert className="size-8 text-destructive" />}
        title={message || 'LINK IS INVALID.'}
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
    <div className="min-h-screen bg-background text-foreground p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Building2 className="size-5" />
          <span className="text-xs font-bold uppercase tracking-widest">EMS SECURE COLLECTION</span>
        </div>
        
        <div className="bg-card rounded-2xl shadow-diffuse border border-border/10 p-8 space-y-6">
          <div className="border-b border-border/15 pb-4">
            <h1 className="text-2xl font-bold uppercase tracking-widest text-foreground">UPLOAD REQUEST</h1>
            <p className="mt-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Hi {status.employeeName}, please upload the requested documents.
            </p>
          </div>
 
          <div className="space-y-4">
            {status.requestedDocTypes.map((docType) => {
              const uploaded = isUploaded(docType)
              return (
                <div key={docType} className="bg-secondary/40 rounded-xl p-4 border border-border/5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-bold uppercase tracking-wider text-foreground">{labelFor(docType)}</span>
                    {uploaded && (
                      <span className="inline-flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 rounded-lg">
                        <CheckCircle2 className="size-3" />
                        SUBMITTED
                      </span>
                    )}
                  </div>
                  <label className="flex h-14 cursor-pointer items-center justify-center gap-2 border border-dashed border-muted-foreground/30 bg-card hover:bg-secondary/50 transition-colors rounded-xl p-4">
                    <UploadCloud className="size-5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-semibold uppercase tracking-wider text-foreground select-none">
                      {selectedFiles[docType]?.name ?? (uploaded ? 'REPLACE FILE…' : 'CHOOSE FILE…')}
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
            className="w-full bg-primary text-primary-foreground font-bold text-base h-12 rounded-xl hover:brightness-105 transition-all shadow-button mt-4 border-0 cursor-pointer"
            disabled={!hasSelection || uploadMutation.isPending}
            onClick={() => uploadMutation.mutate()}
          >
            {uploadMutation.isPending && <Loader2 className="size-5 animate-spin text-white" />}
            SUBMIT REQUESTS
          </Button>
        </div>
      </div>
    </div>
  )
}
