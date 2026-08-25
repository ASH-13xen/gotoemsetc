import { Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useUpdateClient } from '@/hooks/useCms'
import { useCmsAccess } from '@/hooks/useCmsAccess'
import type { Client, CmsPlan } from '@/api/cms.api'

// Mirrors CMS_PLAN_QUOTAS in the backend constants. Kept as display strings
// on purpose — the ranges ("6-8") are what the client is actually promised,
// and resolving them to a single number here would misstate the commitment.
const PLANS: Array<{
  id: CmsPlan
  name: string
  rows: Array<[string, string]>
  accent: string
}> = [
  {
    id: 'gold',
    name: 'Gold',
    accent: 'border-amber-500/60',
    rows: [
      ['Posts', '6'],
      ['Reels', '6'],
      ['Daily stories', '1 / day'],
      ['Festive stories', '2'],
    ],
  },
  {
    id: 'platinum',
    name: 'Platinum',
    accent: 'border-slate-400/70',
    rows: [
      ['Posts', '6-8'],
      ['Reels', '6-8'],
      ['Daily stories', '1-2 / day'],
      ['Festive stories', '2-4'],
    ],
  },
  {
    id: 'diamond',
    name: 'Diamond',
    accent: 'border-cyan-500/60',
    rows: [
      ['Posts', '8'],
      ['Reels', '8'],
      ['Daily stories', '2-3 / day'],
      ['Festive stories', '2-4'],
    ],
  },
]

export function ClientPlanCard({ client }: { client: Client }) {
  const { canEditClient } = useCmsAccess()
  const update = useUpdateClient(client._id)

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pt-6">
        <CardTitle>Plan</CardTitle>
        <p className="text-sm text-muted-foreground">
          Sets what new calendars commit to. Months already created keep the plan they were
          created with.
        </p>
      </CardHeader>
      <CardContent className="pb-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => {
            const selected = client.currentPlan === plan.id
            return (
              <button
                key={plan.id}
                type="button"
                disabled={!canEditClient || update.isPending}
                onClick={() => update.mutate({ currentPlan: plan.id })}
                className={`rounded-2xl border-2 p-4 text-left transition-all disabled:cursor-default ${
                  selected ? `${plan.accent} bg-secondary/50` : 'border-border/40 hover:border-border'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{plan.name}</span>
                  {selected && <Check className="size-4" />}
                </div>
                <dl className="mt-3 space-y-1 text-sm">
                  {plan.rows.map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-medium tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
