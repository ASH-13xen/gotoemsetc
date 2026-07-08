import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Mail, Phone, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ClientStatusBadge } from '@/components/clients/ClientStatusBadge'
import { AddContactDialog } from '@/components/clients/AddContactDialog'
import { OffboardConfirmDialog } from '@/components/clients/OffboardConfirmDialog'
import { QuotationsSection } from '@/components/quotations/QuotationsSection'
import { useClient, useRemoveContact } from '@/hooks/useClients'

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, isLoading } = useClient(id)
  const removeContact = useRemoveContact(id ?? '')

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <Skeleton className="h-32 w-full bg-neutral-800" />
        <Skeleton className="h-64 w-full bg-neutral-800" />
      </div>
    )
  }

  const { client } = data

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <main className="mx-auto max-w-4xl space-y-8">
        {/* HERO HEADER */}
        <div className="grid grid-cols-1 gap-6 bg-transparent md:grid-cols-3">
          <div className="flex min-h-[220px] flex-col justify-between bg-card border border-border p-8 rounded-2xl md:col-span-2 shadow-sm">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                CLIENT PROFILE
              </span>
              <h1 className="text-4xl font-extrabold tracking-tight text-foreground md:text-5xl">
                {client.clientName}
              </h1>
              <p className="mt-1 text-base font-semibold tracking-wide text-muted-foreground">
                {client.brandName}
              </p>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <ClientStatusBadge status={client.status} />
              <span className="font-mono text-xs text-muted-foreground">
                Registered {new Date(client.dateRegistered).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div
              onClick={() => navigate('/')}
              className="flex min-h-[100px] cursor-pointer flex-col justify-between bg-primary p-6 rounded-xl text-primary-foreground transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]"
            >
              <span className="text-xs font-bold tracking-wider opacity-90 uppercase">NAVIGATION</span>
              <span className="text-xl font-extrabold tracking-wide">BACK TO PORTAL</span>
            </div>
            {client.status !== 'offboarded' && (
              <div className="flex min-h-[100px] flex-col justify-between bg-card border border-border p-6 rounded-xl shadow-sm">
                <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">DANGER ZONE</span>
                <OffboardConfirmDialog clientId={client._id} clientName={client.clientName} />
              </div>
            )}
          </div>
        </div>

        {/* CONTACTS */}
        <div className="space-y-6 bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Contacts</h2>
            <AddContactDialog clientId={client._id} />
          </div>
          {client.contacts.length === 0 ? (
            <p className="text-sm font-medium text-muted-foreground">
              No contacts added yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {client.contacts.map((contact) => (
                <div key={contact._id} className="flex items-start justify-between gap-3 border border-border bg-background p-4 rounded-xl">
                  <div>
                    <p className="font-bold tracking-wide text-foreground">{contact.name}</p>
                    {contact.role && (
                      <p className="text-xs font-medium text-muted-foreground">{contact.role}</p>
                    )}
                    <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                      {contact.email && (
                        <span className="flex items-center gap-1.5">
                          <Mail className="size-3" /> {contact.email}
                        </span>
                      )}
                      {contact.phone && (
                        <span className="flex items-center gap-1.5">
                          <Phone className="size-3" /> {contact.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      removeContact.mutate(contact._id, {
                        onSuccess: () => toast.success('Contact removed'),
                        onError: () => toast.error('Could not remove contact'),
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* QUOTATIONS */}
        <QuotationsSection clientId={client._id} />
      </main>
    </div>
  )
}
