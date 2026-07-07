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
    <div className="flex min-h-screen items-center justify-center bg-black p-4 text-white">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center border-2 border-white p-8">
        {icon}
        <h1 className="text-xl font-black uppercase tracking-wider">{title}</h1>
        {description && <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest">{description}</p>}
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
    <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-2 text-neutral-400">
          <Building2 className="size-5" />
          <span className="text-xs font-black uppercase tracking-widest">EMS SECURE COLLECTION</span>
        </div>
        
        <div className="border-2 border-white bg-black p-8 space-y-6">
          <div className="border-b-2 border-white pb-4">
            <h1 className="text-2xl font-black uppercase tracking-widest text-white">UPLOAD REQUEST</h1>
            <p className="mt-2 text-sm font-bold text-neutral-400 uppercase tracking-wide">
              Hi {status.employeeName}, please upload the requested documents.
            </p>
          </div>

          <div className="space-y-4">
            {status.requestedDocTypes.map((docType) => {
              const uploaded = isUploaded(docType)
              return (
                <div key={docType} className="border-2 border-neutral-800 p-4 bg-neutral-950/20">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-black uppercase tracking-wider text-white">{labelFor(docType)}</span>
                    {uploaded && (
                      <span className="inline-flex items-center gap-1 border-2 border-emerald-500 bg-emerald-950/40 px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-emerald-400">
                        <CheckCircle2 className="size-3.5" />
                        SUBMITTED
                      </span>
                    )}
                  </div>
                  <label className="flex h-16 cursor-pointer items-center justify-center gap-2 border-2 border-dashed border-white bg-neutral-900 hover:bg-neutral-800 transition-colors rounded-none p-4">
                    <UploadCloud className="size-5 shrink-0 text-neutral-400" />
                    <span className="truncate text-sm font-bold uppercase tracking-wider text-white select-none">
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
            className="w-full bg-primary hover:opacity-90 text-white font-extrabold text-lg h-14 rounded-none border-none tracking-widest uppercase mt-4"
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
