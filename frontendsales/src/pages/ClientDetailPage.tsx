import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Mail, Phone, Trash2, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ClientStatusBadge } from '@/components/clients/ClientStatusBadge'
import { AddContactDialog } from '@/components/clients/AddContactDialog'
import { OffboardConfirmDialog } from '@/components/clients/OffboardConfirmDialog'
import { AssignEmployeesDialog } from '@/components/clients/AssignEmployeesDialog'
import { ClientLogoUpload } from '@/components/clients/ClientLogoUpload'
import { ActivityTimeline } from '@/components/clients/ActivityTimeline'
import { ClientNotes } from '@/components/clients/ClientNotes'
import { RequestClientDocumentsModal } from '@/components/clients/RequestClientDocumentsModal'
import { ClientDocumentRequestHistory } from '@/components/clients/ClientDocumentRequestHistory'
import { ClientUploadedDocumentsList } from '@/components/clients/ClientUploadedDocumentsList'
import { QuotationsSection } from '@/components/quotations/QuotationsSection'
import { MeetingList } from '@/components/meetings/MeetingList'
import { ScheduleMeetingDialog } from '@/components/meetings/ScheduleMeetingDialog'
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
  const primaryContact = client.contacts[0]

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <main className="mx-auto max-w-4xl space-y-8">
        {/* HERO HEADER */}
        <div className="grid grid-cols-1 gap-6 bg-transparent md:grid-cols-3">
          <div className="flex min-h-[220px] flex-col justify-between bg-card border border-border p-8 rounded-2xl md:col-span-2 shadow-sm">
            <div className="flex items-start gap-4">
              <ClientLogoUpload clientId={client._id} logoUrl={client.logoUrl} clientName={client.clientName} />
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

        {/* ASSIGNED EMPLOYEES */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" />
              Assigned employees
            </CardTitle>
            <AssignEmployeesDialog
              clientId={client._id}
              currentAssigned={client.assignedEmployees}
              currentMain={client.mainEmployee}
            />
          </CardHeader>
          <CardContent>
            {client.assignedEmployees.length === 0 ? (
              <p className="text-sm text-muted-foreground">No employees assigned yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {client.assignedEmployees.map((emp) => {
                  const isMain = emp._id === client.mainEmployee?._id
                  return (
                    <span
                      key={emp._id}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        isMain
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-secondary/40 text-foreground'
                      }`}
                    >
                      {emp.firstName} {emp.lastName}
                      {isMain && ' · Main'}
                    </span>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

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
        <QuotationsSection
          clientId={client._id}
          clientName={client.clientName}
          contactEmail={primaryContact?.email}
          contactPhone={primaryContact?.phone}
        />

        {/* MEETINGS */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle className="text-base">Meetings</CardTitle>
            <ScheduleMeetingDialog clientId={client._id} trigger={<Button size="sm">Schedule Meeting</Button>} />
          </CardHeader>
          <CardContent>
            <MeetingList clientId={client._id} />
          </CardContent>
        </Card>

        {/* DOCUMENT REQUESTS */}
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <RequestClientDocumentsModal
              clientId={client._id}
              clientName={client.clientName}
              contactEmail={primaryContact?.email}
              contactPhone={primaryContact?.phone}
            />
          </div>
          <ClientDocumentRequestHistory
            clientId={client._id}
            clientName={client.clientName}
            contactEmail={primaryContact?.email}
            contactPhone={primaryContact?.phone}
          />
          <ClientUploadedDocumentsList clientId={client._id} />
        </div>

        {/* NOTES */}
        <ClientNotes clientId={client._id} />

        {/* ACTIVITY */}
        <ActivityTimeline clientId={client._id} />
      </main>
    </div>
  )
}
