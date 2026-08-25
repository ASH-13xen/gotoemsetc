import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { usePlanPrices, useSetPlanPrices } from '@/hooks/useInvoices'
import type { PlanTier } from '@/api/invoices.api'

const PLAN_LABEL: Record<PlanTier, string> = { gold: 'Gold', platinum: 'Platinum', diamond: 'Diamond' }
const PLANS: PlanTier[] = ['gold', 'platinum', 'diamond']

export function PlanPricesCard() {
  const { data } = usePlanPrices()
  const setPrices = useSetPlanPrices()
  const [amounts, setAmounts] = useState<Record<PlanTier, string>>({ gold: '', platinum: '', diamond: '' })

  useEffect(() => {
    if (!data) return
    const next = { gold: '', platinum: '', diamond: '' } as Record<PlanTier, string>
    for (const p of data.prices) next[p.plan] = String(p.amount)
    setAmounts(next)
  }, [data])

  function handleSave() {
    setPrices.mutate(
      PLANS.map((plan) => ({ plan, amount: Number(amounts[plan]) || 0 })),
      {
        onSuccess: () => toast.success('Plan prices updated'),
        onError: () => toast.error('Could not update plan prices'),
      }
    )
  }

  return (
    <Card className="space-y-3 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Monthly plan pricing</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <div key={plan} className="grid gap-1.5">
            <Label htmlFor={`price-${plan}`}>{PLAN_LABEL[plan]} (₹/month)</Label>
            <Input
              id={`price-${plan}`}
              type="number"
              min={0}
              value={amounts[plan]}
              onChange={(e) => setAmounts((prev) => ({ ...prev, [plan]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <Button size="sm" onClick={handleSave} disabled={setPrices.isPending}>
        {setPrices.isPending ? 'Saving…' : 'Save prices'}
      </Button>
    </Card>
  )
}
