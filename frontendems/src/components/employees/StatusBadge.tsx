import { Badge } from '@/components/ui/badge'
import type { EmployeeStatus } from '@/api/employees.api'

const STATUS_CONFIG: Record<EmployeeStatus, { label: string; variant: 'secondary' | 'success' | 'warning' }> = {
  draft: { label: 'Draft', variant: 'warning' },
  active: { label: 'Active', variant: 'success' },
  offboarded: { label: 'Offboarded', variant: 'secondary' },
}

export function StatusBadge({ status }: { status: EmployeeStatus }) {
  const config = STATUS_CONFIG[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}
