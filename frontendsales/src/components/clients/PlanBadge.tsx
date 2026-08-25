import { Badge } from '@/components/ui/badge'
import type { CmsPlan } from '@/api/cms.api'

// Plan tiers get a fixed visual identity so they're recognisable at a glance
// across the client list, the detail page, and the calendar header.
const PLAN_STYLES: Record<CmsPlan, string> = {
  gold: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  platinum: 'bg-slate-400/20 text-slate-600 dark:text-slate-300',
  diamond: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
}

export function PlanBadge({ plan }: { plan?: CmsPlan | null }) {
  if (!plan) {
    return (
      <Badge variant="outline" className="shrink-0 font-normal text-muted-foreground">
        No plan
      </Badge>
    )
  }
  return <Badge className={`shrink-0 uppercase ${PLAN_STYLES[plan]}`}>{plan}</Badge>
}
