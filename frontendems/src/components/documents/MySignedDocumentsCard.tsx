import { Download, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useEmployeeDocuments } from '@/hooks/useDocuments'
import { downloadMySignedDocument } from '@/api/documents.api'

const DOCUMENT_TEMPLATE_KEYS = ['offer-letter', 'appointment-letter']

// Read-only self-service view of your own signed documents — deliberately
// separate from GeneratedDocumentsList (the admin view, with delete/upload-
// signed/share actions a plain employee shouldn't have over their own
// official paperwork). Only ever shows the Offer Letter / Letter of
// Appointment once HR has uploaded the countersigned copy back, never the
// bare unsigned original. Ported from the frontendall dashboard's
// MyDocumentsCard so it lives with the rest of an employee's own record
// in EMS instead.
export function MySignedDocumentsCard({ employeeId }: { employeeId: string }) {
  const { data, isLoading } = useEmployeeDocuments(employeeId)
  const documents = (data?.documents ?? []).filter(
    (d) => d.signedFile && DOCUMENT_TEMPLATE_KEYS.includes(d.template.key)
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">My documents</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {isLoading ? (
          <Skeleton className="h-12 w-full bg-secondary/40 rounded-xl" />
        ) : documents.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground p-2">
            <FileText className="size-4" />
            No signed documents on file yet — your Offer Letter and Letter of Appointment will appear here once HR
            uploads the signed copy.
          </p>
        ) : (
          documents.map((doc) => (
            <button
              key={doc._id}
              type="button"
              onClick={() => downloadMySignedDocument(employeeId, doc._id, `${doc.template.title}.pdf`)}
              className="flex w-full items-center justify-between gap-4 rounded-xl bg-secondary/30 p-4 border border-border/5 text-left hover:bg-secondary/50"
            >
              <span className="text-sm font-semibold text-foreground">{doc.template.title}</span>
              <Download className="size-4 shrink-0 text-primary" />
            </button>
          ))
        )}
      </CardContent>
    </Card>
  )
}
