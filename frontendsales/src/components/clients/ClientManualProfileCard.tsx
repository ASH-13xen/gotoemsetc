import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useUpdateClient } from '@/hooks/useCms'
import { useCmsAccess } from '@/hooks/useCmsAccess'
import type { Client } from '@/api/cms.api'

// The client manual's page 1 (Expectations) and page 2 (About) content —
// as long as needed, no length cap.
export function ClientManualProfileCard({ client }: { client: Client }) {
  const { canEditClient } = useCmsAccess()
  const update = useUpdateClient(client._id)

  const [form, setForm] = useState({
    aboutBrand: client.aboutBrand ?? '',
    aboutClient: client.aboutClient ?? '',
    expectations: client.expectations ?? '',
  })

  useEffect(() => {
    setForm({
      aboutBrand: client.aboutBrand ?? '',
      aboutClient: client.aboutClient ?? '',
      expectations: client.expectations ?? '',
    })
  }, [client])

  function save() {
    update.mutate(form)
  }

  const field = (key: keyof typeof form, label: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`manual-${key}`}>{label}</Label>
      <Textarea
        id={`manual-${key}`}
        rows={5}
        value={form[key]}
        disabled={!canEditClient}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder="As long as needed — this goes straight into the client manual."
      />
    </div>
  )

  return (
    <Card>
      <CardHeader className="pt-6">
        <CardTitle>Client manual — profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pb-6">
        {field('expectations', 'Expectations of the client')}
        {field('aboutBrand', 'About the brand')}
        {field('aboutClient', 'About the client')}
        {canEditClient && (
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
