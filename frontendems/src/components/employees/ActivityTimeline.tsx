import {
  Ban,
  CalendarCheck,
  FileText,
  History,
  PenSquare,
  UserPlus,
  UserX,
  UploadCloud,
  XCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useActivity } from '@/hooks/useActivity'
import type { ActivityLogEntry } from '@/api/activity.api'

const ACTION_CONFIG: Record<string, { label: string; icon: typeof History }> = {
  EMPLOYEE_CREATED: { label: 'Employee record created', icon: UserPlus },
  EMPLOYEE_UPDATED: { label: 'Employee details updated', icon: PenSquare },
  EMPLOYEE_REMOVED: { label: 'Employee removed', icon: UserX },
  DOCUMENT_GENERATED: { label: 'Document generated', icon: FileText },
  DOCUMENT_GENERATION_FAILED: { label: 'Document generation failed', icon: XCircle },
  UPLOAD_REQUEST_CREATED: { label: 'Requested documents from employee', icon: UploadCloud },
  UPLOAD_REQUEST_REVOKED: { label: 'Revoked a document request', icon: Ban },
  DOCUMENTS_UPLOADED_BY_EMPLOYEE: { label: 'Employee uploaded documents', icon: UploadCloud },
  ATTENDANCE_MARKED: { label: 'Attendance marked', icon: CalendarCheck },
  EMPLOYEE_CREATED_FROM_APPLICANT: { label: 'Hired from an application', icon: UserPlus },
}

function describe(entry: ActivityLogEntry): string {
  const config = ACTION_CONFIG[entry.action]
  const label = config?.label ?? entry.action
  const meta = entry.metadata ?? {}

  if (entry.action === 'DOCUMENT_GENERATED' && meta.templateKey) {
    return `${label}: ${meta.templateKey}`
  }
  if (entry.action === 'UPLOAD_REQUEST_CREATED' && Array.isArray(meta.requestedDocTypes)) {
    return `${label} (${(meta.requestedDocTypes as string[]).join(', ')})`
  }
  if (entry.action === 'ATTENDANCE_MARKED' && meta.date) {
    return `${label}: ${meta.date} — ${meta.status}${meta.isBackdated ? ' (backdated)' : ''}`
  }
  return label
}

export function ActivityTimeline({ employeeId }: { employeeId: string }) {
  const { data, isLoading } = useActivity(employeeId)
  const entries = data?.activityLog ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Activity</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : entries.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <History className="size-4" />
            No activity yet.
          </p>
        ) : (
          entries.map((entry) => {
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
          })
        )}
      </CardContent>
    </Card>
  )
}
