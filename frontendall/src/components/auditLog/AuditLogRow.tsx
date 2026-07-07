import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { TableCell, TableRow } from '@/components/ui/table'
import type { AuditLogEntry } from '@/api/auditLog.api'

export function AuditLogRow({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setOpen((v) => !v)}>
        <TableCell>
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </TableCell>
        <TableCell className="font-mono text-xs">{new Date(entry.createdAt).toLocaleString()}</TableCell>
        <TableCell className="font-bold uppercase">{entry.actor?.username ?? 'System'}</TableCell>
        <TableCell className="uppercase text-muted-foreground">{entry.actor?.role ?? '-'}</TableCell>
        <TableCell className="font-mono text-xs">{entry.action}</TableCell>
        <TableCell>{entry.resourceType}</TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={6} className="whitespace-pre-wrap bg-accent/30 font-mono text-xs">
            {JSON.stringify({ resourceId: entry.resourceId, metadata: entry.metadata }, null, 2)}
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
