import { useNavigate } from 'react-router-dom'
import { Inbox } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/layout/PageHeader'
import { usePendingUploadRequests } from '@/hooks/useUploadRequests'
import { useConfig } from '@/hooks/useConfig'
import { useStaggerReveal } from '@/hooks/useStaggerReveal'
import type { UploadRequestStatus } from '@/api/uploadRequests.api'

const STATUS_VARIANT: Record<UploadRequestStatus, 'secondary' | 'success' | 'warning' | 'destructive'> = {
  pending: 'warning',
  partially_fulfilled: 'warning',
  fulfilled: 'success',
  expired: 'secondary',
  revoked: 'destructive',
}

export default function PendingRequestsPage() {
  const navigate = useNavigate()
  const { data, isLoading } = usePendingUploadRequests()
  const { data: config } = useConfig()

  const requests = data?.uploadRequests ?? []
  const tableBodyRef = useStaggerReveal<HTMLTableSectionElement>([isLoading, requests.length])

  const labelFor = (key: string) => config?.docTypes.find((d) => d.key === key)?.label ?? key

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 py-8">
      <PageHeader
        eyebrow="Document system"
        title="Pending document requests"
        description="Every outstanding document request across all employees."
      />

      <div className="overflow-hidden rounded-xl border border-border">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <Inbox className="size-10 text-muted-foreground/40" />
            <p className="text-base font-semibold text-foreground">Nothing pending</p>
            <p className="text-sm text-muted-foreground">Every requested document has been uploaded.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Requested documents</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody ref={tableBodyRef}>
              {requests.map((req) => (
                <TableRow
                  key={req._id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/employees/${req.employee._id}`)}
                >
                  <TableCell className="font-medium text-foreground">
                    {req.employee.firstName} {req.employee.lastName ?? ''}
                  </TableCell>
                  <TableCell>{req.requestedDocTypes.map(labelFor).join(', ')}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[req.status]}>{req.status.replace('_', ' ')}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(req.expiresAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
