import type { ContactRequired, ResourceRequired } from '@/api/employeeTasks.api'

export function ResourcesContactsSection({
  resources,
  contacts,
}: {
  resources: ResourceRequired[]
  contacts: ContactRequired[]
}) {
  if (resources.length === 0 && contacts.length === 0) return null

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {resources.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Resources Required</p>
          <ul className="space-y-1">
            {resources.map((resource, index) => (
              <li key={index} className="text-sm text-foreground">
                • {resource.label}
                {resource.notes && <span className="text-muted-foreground"> — {resource.notes}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {contacts.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Contacts Required</p>
          <ul className="space-y-1">
            {contacts.map((contact, index) => (
              <li key={index} className="text-sm text-foreground">
                • {contact.name}
                {contact.role && ` (${contact.role})`}
                {contact.phone && ` — ${contact.phone}`}
                {contact.email && ` — ${contact.email}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
