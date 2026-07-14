import {
  Ban,
  CalendarCheck,
  FileSignature,
  FileText,
  History,
  NotebookPen,
  PenSquare,
  Send,
  UploadCloud,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useActivity } from '@/hooks/useActivity'
import type { ActivityLogEntry } from '@/api/activity.api'

const ACTION_CONFIG: Record<string, { label: string; icon: typeof History }> = {
  CLIENT_REGISTERED: { label: 'Client registered', icon: UserPlus },
  CLIENT_UPDATED: { label: 'Client details updated', icon: PenSquare },
  CLIENT_OFFBOARDED: { label: 'Client offboarded', icon: UserMinus },
  CONTACT_ADDED: { label: 'Contact added', icon: UserPlus },
  CONTACT_REMOVED: { label: 'Contact removed', icon: UserMinus },
  MEETING_SCHEDULED: { label: 'Meeting scheduled', icon: Users },
  MEETING_HELD: { label: 'Meeting minutes recorded', icon: CalendarCheck },
  QUOTATION_GENERATED: { label: 'Quotation generated', icon: FileText },
  QUOTATION_SHARED: { label: 'Quotation shared with client', icon: Send },
  QUOTATION_SIGNED: { label: 'Quotation signed by client', icon: FileSignature },
  NOTE_ADDED: { label: 'Internal note added', icon: NotebookPen },
  DOCUMENT_REQUEST_CREATED: { label: 'Requested documents from client', icon: UploadCloud },
  DOCUMENT_REQUEST_REVOKED: { label: 'Revoked a document request', icon: Ban },
  DOCUMENTS_UPLOADED_BY_CLIENT: { label: 'Client uploaded documents', icon: UploadCloud },
}

function describe(entry: ActivityLogEntry): string {
  const config = ACTION_CONFIG[entry.action]
  const label = config?.label ?? entry.action
  const meta = entry.metadata ?? {}

  if (entry.action === 'MEETING_SCHEDULED' && meta.topic) {
    return `${label}: ${meta.topic}`
  }
  if (entry.action === 'DOCUMENT_REQUEST_CREATED' && Array.isArray(meta.requestedDocTypes)) {
    return `${label} (${(meta.requestedDocTypes as string[]).join(', ')})`
  }
  if (entry.action === 'DOCUMENTS_UPLOADED_BY_CLIENT' && Array.isArray(meta.labels)) {
    return `${label}: ${(meta.labels as string[]).join(', ')}`
  }
  if (entry.action === 'QUOTATION_GENERATED' && meta.template) {
    return `${label}: ${meta.template} (v${meta.version})`
  }
  return label
}

export function ActivityTimeline({ clientId }: { clientId: string }) {
  const { data, isLoading } = useActivity(clientId)
  const entries = data?.activityLog ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : entries.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <History className="size-4" />
            No activity yet.
          </p>
        ) : (
          <div className="grid max-h-80 gap-3 overflow-y-auto pr-2">
            {entries.map((entry) => {
              const Icon = ACTION_CONFIG[entry.action]?.icon ?? History
              return (
                <div key={entry._id} className="flex items-start gap-3 text-sm">
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="flex flex-1 items-baseline justify-between gap-2">
                    <span>{describe(entry)}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
