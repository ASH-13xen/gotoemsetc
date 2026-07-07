import { Badge } from '@/components/ui/badge'
import type { ClientStatus } from '@/api/clients.api'

const STATUS_CONFIG: Record<ClientStatus, { label: string; variant: 'secondary' | 'success' | 'destructive' }> = {
  lead: { label: 'Lead', variant: 'secondary' },
  onboarded: { label: 'Onboarded', variant: 'success' },
  offboarded: { label: 'Offboarded', variant: 'destructive' },
}

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const config = STATUS_CONFIG[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}
