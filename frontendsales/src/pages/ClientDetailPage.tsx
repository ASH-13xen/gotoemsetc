import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Mail, Phone, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ClientStatusBadge } from '@/components/clients/ClientStatusBadge'
import { AddContactDialog } from '@/components/clients/AddContactDialog'
import { OffboardConfirmDialog } from '@/components/clients/OffboardConfirmDialog'
import { MeetingHistoryList } from '@/components/meetings/MeetingHistoryList'
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
    <div className="min-h-screen bg-black p-6 text-white">
      <main className="mx-auto max-w-4xl space-y-8">
        {/* HERO HEADER */}
        <div className="grid grid-cols-1 border-2 border-white bg-black md:grid-cols-3">
          <div className="flex min-h-[220px] flex-col justify-between border-b-2 border-white p-8 md:col-span-2 md:border-r-2 md:border-b-0">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-black tracking-widest text-neutral-400 uppercase">
                CLIENT PROFILE
              </span>
              <h1 className="text-4xl font-black tracking-tighter text-white uppercase md:text-6xl">
                {client.clientName}
              </h1>
              <p className="mt-1 text-base font-bold tracking-wider text-neutral-400 uppercase">
                {client.brandName}
              </p>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <ClientStatusBadge status={client.status} />
              <span className="font-mono text-xs font-bold text-neutral-500 uppercase">
                Registered {new Date(client.dateRegistered).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 divide-y-2 divide-white">
            <div
              onClick={() => navigate('/')}
              className="flex min-h-[100px] cursor-pointer flex-col justify-between bg-primary p-6 text-white transition-all hover:opacity-90 active:scale-[0.99]"
            >
              <span className="text-xs font-black tracking-widest opacity-80 uppercase">NAVIGATION</span>
              <span className="text-2xl font-extrabold tracking-wide uppercase">BACK TO PORTAL</span>
            </div>
            {client.status !== 'offboarded' && (
              <div className="flex min-h-[100px] flex-col justify-between bg-neutral-900 p-6">
                <span className="text-xs font-black tracking-widest text-neutral-400 uppercase">DANGER ZONE</span>
                <OffboardConfirmDialog clientId={client._id} clientName={client.clientName} />
              </div>
            )}
          </div>
        </div>

        {/* CONTACTS */}
        <div className="space-y-6 border-2 border-white bg-black p-6">
          <div className="flex items-center justify-between border-b-2 border-white pb-3">
            <h2 className="text-2xl font-black tracking-widest text-white uppercase">Contacts</h2>
            <AddContactDialog clientId={client._id} />
          </div>
          {client.contacts.length === 0 ? (
            <p className="text-sm font-bold tracking-widest text-neutral-400 uppercase">
              No contacts added yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {client.contacts.map((contact) => (
                <div key={contact._id} className="flex items-start justify-between gap-3 border-2 border-neutral-800 p-4">
                  <div>
                    <p className="font-black tracking-wide text-white uppercase">{contact.name}</p>
                    {contact.role && (
                      <p className="text-xs font-bold tracking-widest text-neutral-400 uppercase">{contact.role}</p>
                    )}
                    <div className="mt-2 flex flex-col gap-1 text-xs text-neutral-300">
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

        {/* MEETINGS */}
        <MeetingHistoryList clientId={client._id} />
      </main>
    </div>
  )
}
