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
import { buildGmailComposeUrl, buildWhatsappUrl } from '@/lib/manualSend'
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
  employeeEmail,
  employeePhone,
  onRevoke,
  revokePending,
}: {
  req: UploadRequest
  employeeName: string
  employeeEmail?: string
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
  const companyName = config?.companyName ?? 'us'

  const onCopy = async () => {
    await navigator.clipboard.writeText(req.link)
    setCopied(true)
    toast.success('Link copied')
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant={STATUS_VARIANT[req.status]}>{req.status.replace('_', ' ')}</Badge>
            <span>{docLabels}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            Expires {new Date(req.expiresAt).toLocaleString()}
          </span>
        </div>
        {(req.status === 'pending' || req.status === 'partially_fulfilled') && (
          <Button variant="ghost" size="sm" onClick={onRevoke} disabled={revokePending}>
            <Ban className="size-3.5" />
            Revoke
          </Button>
        )}
      </div>
      {isActive && (
        <>
          <div className="flex min-w-0 items-center gap-2 rounded-md border bg-muted/40 p-2">
            <code className="min-w-0 flex-1 truncate text-xs">{req.link}</code>
            <Button size="sm" variant="outline" onClick={onCopy}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              Copy
            </Button>
          </div>
          <ManualSendButtons
            emailHref={
              employeeEmail
                ? buildGmailComposeUrl(
                    employeeEmail,
                    `Document Request — ${companyName}`,
                    `Hi ${employeeName},\n\nPlease upload the following documents using the secure link below:\n${docLabels}\n\n${req.link}\n\nThanks,\n${companyName} HR`
                  )
                : undefined
            }
            whatsappHref={
              employeePhone
                ? buildWhatsappUrl(
                    employeePhone,
                    `Hi ${employeeName}, please upload the following documents using this secure link: ${docLabels}\n${req.link}`
                  )
                : undefined
            }
          />
        </>
      )}
    </div>
  )
}

export function RequestHistoryTable({
  employeeId,
  employeeName,
  employeeEmail,
  employeePhone,
}: {
  employeeId: string
  employeeName: string
  employeeEmail?: string
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
          <Skeleton className="h-10 w-full" />
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No requests sent yet.</p>
        ) : (
          requests.map((req) => (
            <RequestRow
              key={req._id}
              req={req}
              employeeName={employeeName}
              employeeEmail={employeeEmail}
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
