import { toast } from 'sonner'
import { Ban, Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useClientDocumentRequests, useRevokeDocumentRequest } from '@/hooks/useClientDocumentRequests'
import { ManualSendButtons } from '@/components/common/ManualSendButtons'
import { buildGmailComposeUrl, buildWhatsappUrl } from '@/lib/manualSend'
import { buildDocumentRequestEmailBody, buildDocumentRequestWhatsappText } from '@/lib/documentRequestTemplates'
import type { ClientDocumentRequest, DocumentRequestStatus } from '@/api/clientDocumentRequests.api'

const STATUS_VARIANT: Record<DocumentRequestStatus, 'secondary' | 'success' | 'warning' | 'destructive'> = {
  pending: 'warning',
  partially_fulfilled: 'warning',
  fulfilled: 'success',
  expired: 'secondary',
  revoked: 'destructive',
}

const ACTIVE_STATUSES: DocumentRequestStatus[] = ['pending', 'partially_fulfilled']

function RequestRow({
  req,
  clientName,
  contactEmail,
  contactPhone,
  onRevoke,
  revokePending,
}: {
  req: ClientDocumentRequest
  clientName: string
  contactEmail?: string
  contactPhone?: string
  onRevoke: () => void
  revokePending: boolean
}) {
  const [copied, setCopied] = useState(false)

  const isActive = ACTIVE_STATUSES.includes(req.status) && new Date(req.expiresAt).getTime() > Date.now()
  const docLabels = req.requestedDocTypes.join(', ')

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
      {isActive && req.accessCode && (
        <>
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border/10 bg-secondary/50 p-2">
            <code className="min-w-0 flex-1 truncate text-xs font-mono pl-2 text-foreground/80">{req.link}</code>
            <Button size="sm" variant="outline" className="rounded-lg" onClick={onCopy}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              Copy
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-muted-foreground uppercase tracking-wide">Access code</span>
            <code className="rounded-md bg-secondary/50 px-2 py-0.5 font-mono font-semibold text-foreground">
              {req.accessCode}
            </code>
          </div>
          <ManualSendButtons
            emailHref={
              contactEmail
                ? buildGmailComposeUrl(
                    contactEmail,
                    'Document Request — GO-TO Friend',
                    buildDocumentRequestEmailBody(clientName, docLabels, req.link, req.accessCode)
                  )
                : undefined
            }
            whatsappHref={
              contactPhone
                ? buildWhatsappUrl(contactPhone, buildDocumentRequestWhatsappText(clientName, docLabels, req.link, req.accessCode))
                : undefined
            }
            storageKey={`notified_client_doc_request_${req._id}`}
          />
        </>
      )}
    </div>
  )
}

export function ClientDocumentRequestHistory({
  clientId,
  clientName,
  contactEmail,
  contactPhone,
}: {
  clientId: string
  clientName: string
  contactEmail?: string
  contactPhone?: string
}) {
  const { data, isLoading } = useClientDocumentRequests(clientId)
  const revoke = useRevokeDocumentRequest(clientId)
  const requests = data?.requests ?? []

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
              clientName={clientName}
              contactEmail={contactEmail}
              contactPhone={contactPhone}
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
