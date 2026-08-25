import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useTeams, useUpdateClient } from '@/hooks/useCms'
import { useCmsAccess } from '@/hooks/useCmsAccess'
import type { Client } from '@/api/cms.api'

const NO_TEAM = '__none__'

export function ClientBasicsCard({ client }: { client: Client }) {
  const { canEditClient } = useCmsAccess()
  const { data: teams } = useTeams()
  const update = useUpdateClient(client._id)

  const [form, setForm] = useState({
    name: client.name,
    brandName: client.brandName ?? '',
    instagramHandle: client.instagramHandle ?? '',
    website: client.website ?? '',
    team: client.defaultTeam?._id ?? NO_TEAM,
    addressLine: client.location?.addressLine ?? '',
    city: client.location?.city ?? '',
    state: client.location?.state ?? '',
    country: client.location?.country ?? '',
    pincode: client.location?.pincode ?? '',
  })

  // Re-sync when the client is refetched after a save elsewhere on the page.
  useEffect(() => {
    setForm({
      name: client.name,
      brandName: client.brandName ?? '',
      instagramHandle: client.instagramHandle ?? '',
      website: client.website ?? '',
      team: client.defaultTeam?._id ?? NO_TEAM,
      addressLine: client.location?.addressLine ?? '',
      city: client.location?.city ?? '',
      state: client.location?.state ?? '',
      country: client.location?.country ?? '',
      pincode: client.location?.pincode ?? '',
    })
  }, [client])

  function save() {
    update.mutate({
      name: form.name.trim(),
      brandName: form.brandName.trim(),
      instagramHandle: form.instagramHandle.trim(),
      website: form.website.trim(),
      defaultTeam: form.team === NO_TEAM ? null : form.team,
      location: {
        addressLine: form.addressLine.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        country: form.country.trim(),
        pincode: form.pincode.trim(),
      },
    })
  }

  const field = (key: keyof typeof form, label: string, placeholder?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`basics-${key}`}>{label}</Label>
      <Input
        id={`basics-${key}`}
        value={form[key]}
        placeholder={placeholder}
        disabled={!canEditClient}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  )

  return (
    <Card>
      <CardHeader className="pt-6">
        <CardTitle>Basic details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pb-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {field('name', 'Client name')}
          {field('brandName', 'Brand name')}
          {field('instagramHandle', 'Instagram', '@handle')}
          {field('website', 'Website')}
        </div>

        <div className="space-y-1.5">
          <Label>Team</Label>
          <Select
            value={form.team}
            onValueChange={(v) => setForm((f) => ({ ...f, team: v }))}
            disabled={!canEditClient}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pick a team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_TEAM}>No team</SelectItem>
              {(teams ?? []).map((t) => (
                <SelectItem key={t._id} value={t._id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Used as the default for new calendars. Changing it never alters a month already created.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">Location</Label>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('addressLine', 'Address')}
            {field('city', 'City')}
            {field('state', 'State')}
            {field('country', 'Country')}
            {field('pincode', 'Pincode')}
          </div>
        </div>

        {canEditClient && (
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save details'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
