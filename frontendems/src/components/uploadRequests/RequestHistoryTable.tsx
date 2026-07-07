import { toast } from 'sonner'
import { Ban } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useRevokeUploadRequest, useUploadRequests } from '@/hooks/useUploadRequests'
import type { UploadRequestStatus } from '@/api/uploadRequests.api'

const STATUS_VARIANT: Record<UploadRequestStatus, 'secondary' | 'success' | 'warning' | 'destructive'> = {
  pending: 'warning',
  partially_fulfilled: 'warning',
  fulfilled: 'success',
  expired: 'secondary',
  revoked: 'destructive',
}

export function RequestHistoryTable({ employeeId }: { employeeId: string }) {
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
            <div key={req._id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant={STATUS_VARIANT[req.status]}>{req.status.replace('_', ' ')}</Badge>
                  <span>{req.requestedDocTypes.join(', ')}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Expires {new Date(req.expiresAt).toLocaleString()}
                </span>
              </div>
              {(req.status === 'pending' || req.status === 'partially_fulfilled') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    revoke.mutate(req._id, {
                      onSuccess: () => toast.success('Request revoked'),
                      onError: () => toast.error('Could not revoke request'),
                    })
                  }
                >
                  <Ban className="size-3.5" />
                  Revoke
                </Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
