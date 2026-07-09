import { Badge } from '@/components/ui/badge'
import type { ApplicantStatus } from '@/api/applicants.api'

const STATUS_CONFIG: Record<
  ApplicantStatus,
  { label: string; variant: 'secondary' | 'success' | 'destructive' | 'warning' }
> = {
  pending: { label: 'Pending', variant: 'secondary' },
  interview_scheduled: { label: 'Interview Scheduled', variant: 'warning' },
  hired: { label: 'Hired', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'destructive' },
}

export function ApplicantStatusBadge({ status }: { status: ApplicantStatus }) {
  const config = STATUS_CONFIG[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}
