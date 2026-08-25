import { useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/layout/PageHeader'
import { useRecentDocuments } from '@/hooks/useDocuments'
import { useStaggerReveal } from '@/hooks/useStaggerReveal'

export default function RecentDocumentsPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useRecentDocuments()

  const documents = data?.documents ?? []
  const tableBodyRef = useStaggerReveal<HTMLTableSectionElement>([isLoading, documents.length])

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 py-8">
      <PageHeader
        eyebrow="Document system"
        title="Documents generated this month"
        description="Every document generated across all employees since the start of the month."
      />

      <div className="overflow-hidden rounded-xl border border-border">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <FileText className="size-10 text-muted-foreground/40" />
            <p className="text-base font-semibold text-foreground">Nothing generated yet this month</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Generated on</TableHead>
                <TableHead>Signed copy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody ref={tableBodyRef}>
              {documents.map((doc) => (
                <TableRow
                  key={doc._id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/employees/${doc.employee._id}`)}
                >
                  <TableCell className="font-medium text-foreground">
                    {doc.employee.firstName} {doc.employee.lastName ?? ''}
                  </TableCell>
                  <TableCell>{doc.template.title}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {doc.signedFile ? <Badge variant="success">Signed</Badge> : <Badge variant="outline">Not signed</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
