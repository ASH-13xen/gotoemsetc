import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AuditLogRow } from '@/components/auditLog/AuditLogRow'
import { useAuditLog } from '@/hooks/useAuditLog'

export default function AuditLogPage() {
  const [actorUsername, setActorUsername] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useAuditLog({ actorUsername: actorUsername || undefined, page, limit: 50 })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Every action taken by a logged-in worker or admin, across every app."
      />

      <Input
        placeholder="Filter by username…"
        value={actorUsername}
        onChange={(e) => {
          setActorUsername(e.target.value)
          setPage(1)
        }}
        className="max-w-sm"
      />

      <div className="overflow-hidden rounded-xl border border-border">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : (data?.items.length ?? 0) === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((entry) => (
                <AuditLogRow key={entry._id} entry={entry} />
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {data && data.total > data.limit && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="underline disabled:opacity-40"
          >
            Prev
          </button>
          <span>
            Page {data.page} of {Math.ceil(data.total / data.limit)}
          </span>
          <button
            disabled={page * data.limit >= data.total}
            onClick={() => setPage((p) => p + 1)}
            className="underline disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
