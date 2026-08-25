import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateClient, useTeams } from '@/hooks/useCms'
import type { CmsPlan } from '@/api/cms.api'

const NO_TEAM = '__none__'
const NO_PLAN = '__none__'

// Registration asks only for what's genuinely needed to get started — a name,
// and optionally the team and plan. Contacts, location, and the rest are
// filled in on the client's detail page afterwards, matching how onboarding
// actually goes.
export function RegisterClientDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: teams } = useTeams()
  const createClient = useCreateClient()

  const [name, setName] = useState('')
  const [brandName, setBrandName] = useState('')
  const [team, setTeam] = useState(NO_TEAM)
  const [plan, setPlan] = useState(NO_PLAN)

  function reset() {
    setName('')
    setBrandName('')
    setTeam(NO_TEAM)
    setPlan(NO_PLAN)
  }

  function submit() {
    if (!name.trim()) return
    createClient.mutate(
      {
        name: name.trim(),
        brandName: brandName.trim() || undefined,
        defaultTeam: team === NO_TEAM ? null : team,
        currentPlan: plan === NO_PLAN ? null : (plan as CmsPlan),
      },
      {
        onSuccess: () => {
          reset()
          onOpenChange(false)
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register client</DialogTitle>
          <DialogDescription>
            The client joins the shared registry, so they appear in Task Management too.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client-name">Client name</Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Pvt Ltd"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand-name">Brand name</Label>
            <Input
              id="brand-name"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Acme"
            />
          </div>

          <div className="space-y-2">
            <Label>Team</Label>
            <Select value={team} onValueChange={setTeam}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TEAM}>Decide later</SelectItem>
                {(teams ?? []).map((t) => (
                  <SelectItem key={t._id} value={t._id}>
                    {t.name}
                    {!(t.memberRoles ?? []).some((r) => r.roles.includes('social_media_manager')) &&
                      ' — no social media manager'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Plan</Label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PLAN}>Decide later</SelectItem>
                <SelectItem value="gold">Gold — 6 posts, 6 reels, 1 story/day, 2 festive</SelectItem>
                <SelectItem value="platinum">Platinum — 6-8 posts, 6-8 reels, 1-2 stories/day, 2-4 festive</SelectItem>
                <SelectItem value="diamond">Diamond — 8 posts, 8 reels, 2-3 stories/day, 2-4 festive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || createClient.isPending}>
            {createClient.isPending ? 'Registering…' : 'Register'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
