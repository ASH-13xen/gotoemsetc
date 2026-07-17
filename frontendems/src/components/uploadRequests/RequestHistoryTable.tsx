import { toast } from 'sonner'
import { Ban, Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useRevokeUploadRequest, useUploadRequests } from '@/hooks/useUploadRequests'
import { useConfig } from '@/hooks/useConfig'
import { ManualSendButtons } from '@/components/common/ManualSendButtons'
import { buildWhatsappUrl } from '@/lib/manualSend'
import { buildDocumentRequestWhatsappText } from '@/lib/documentRequestTemplates'
import type { UploadRequest, UploadRequestStatus } from '@/api/uploadRequests.api'

const STATUS_VARIANT: Record<UploadRequestStatus, 'secondary' | 'success' | 'warning' | 'destructive'> = {
  pending: 'warning',
  partially_fulfilled: 'warning',
  fulfilled: 'success',
  expired: 'secondary',
  revoked: 'destructive',
}

const ACTIVE_STATUSES: UploadRequestStatus[] = ['pending', 'partially_fulfilled']

function RequestRow({
  req,
  employeeName,
  employeePhone,
  onRevoke,
  revokePending,
}: {
  req: UploadRequest
  employeeName: string
  employeePhone?: string
  onRevoke: () => void
  revokePending: boolean
}) {
  const { data: config } = useConfig()
  const [copied, setCopied] = useState(false)

  const isActive = ACTIVE_STATUSES.includes(req.status) && new Date(req.expiresAt).getTime() > Date.now()
  const docLabels = req.requestedDocTypes
    .map((key) => config?.docTypes.find((d) => d.key === key)?.label ?? key)
    .join(', ')

  const onCopy = async () => {
    await navigator.clipboard.writeText(req.link)
    setCopied(true)
    toast.success('Link copied')
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-secondary/30 p-4 border border-border/5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant={STATUS_VARIANT[req.status]} className="rounded-lg">{req.status.replace('_', ' ')}</Badge>
            <span className="font-semibold text-foreground">{docLabels}</span>
          </div>
          <span className="text-xs text-muted-foreground mt-0.5">
            Expires {new Date(req.expiresAt).toLocaleString()}
          </span>
        </div>
        {(req.status === 'pending' || req.status === 'partially_fulfilled') && (
          <Button variant="ghost" size="sm" className="rounded-xl text-muted-foreground hover:text-destructive" onClick={onRevoke} disabled={revokePending}>
            <Ban className="size-3.5" />
            Revoke
          </Button>
        )}
      </div>
      {isActive && (
        <>
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border/10 bg-secondary/50 p-2">
            <code className="min-w-0 flex-1 truncate text-xs font-mono pl-2 text-foreground/80">{req.link}</code>
            <Button size="sm" variant="outline" className="rounded-lg" onClick={onCopy}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              Copy
            </Button>
          </div>
          {req.accessCode && (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-muted-foreground uppercase tracking-wide">Access code</span>
              <code className="rounded-md bg-secondary/50 px-2 py-0.5 font-mono font-semibold text-foreground">
                {req.accessCode}
              </code>
              <span className="text-muted-foreground">— required on the upload page, separate from the link</span>
            </div>
          )}
          <ManualSendButtons
            whatsappHref={
              employeePhone && req.accessCode
                ? buildWhatsappUrl(
                    employeePhone,
                    buildDocumentRequestWhatsappText(employeeName, docLabels, req.link, req.accessCode)
                  )
                : undefined
            }
            storageKey={`notified_doc_request_${req._id}`}
          />
        </>
      )}
    </div>
  )
}

export function RequestHistoryTable({
  employeeId,
  employeeName,
  employeePhone,
}: {
  employeeId: string
  employeeName: string
  employeePhone?: string
}) {
  const { data, isLoading } = useUploadRequests(employeeId)
  const revoke = useRevokeUploadRequest(employeeId)

  const requests = data?.uploadRequests ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Document requests</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {isLoading ? (
          <Skeleton className="h-12 w-full bg-secondary/40 rounded-xl" />
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground p-2">No requests sent yet.</p>
        ) : (
          requests.map((req) => (
            <RequestRow
              key={req._id}
              req={req}
              employeeName={employeeName}
              employeePhone={employeePhone}
              revokePending={revoke.isPending}
              onRevoke={() =>
                revoke.mutate(req._id, {
                  onSuccess: () => toast.success('Request revoked'),
                  onError: () => toast.error('Could not revoke request'),
                })
              }
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}
