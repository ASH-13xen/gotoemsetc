import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useReport } from '@/hooks/useCms'
import type { ContentType } from '@/api/cms.api'
import { formatIstDateTime } from '@/lib/istDate'

const TYPE_LABELS: Record<ContentType, string> = {
  post: 'Posts',
  reel: 'Reels',
  story: 'Daily stories',
  festive_story: 'Festive stories',
}

// Rejection reasons are keyed by whichever step the item was rejected at —
// this varies per pipeline (story/post/reel), so there's no fixed lookup
// table anymore, just a plain humanised fallback.
function stepLabel(key: string) {
  return key.replace(/_/g, ' ')
}

export function ReportPanel({ calendarId }: { calendarId: string }) {
  const { data: report, isLoading } = useReport(calendarId)

  if (isLoading || !report) return <Skeleton className="h-56 rounded-2xl" />

  const rejections = Object.entries(report.rejectionsByStage ?? {})

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 pt-6">
        <CardTitle className="text-base">Month-end fulfilment</CardTitle>
        <Badge variant={report.frozen ? 'secondary' : 'outline'} className="font-normal">
          {report.frozen ? 'Frozen at close' : 'Live — not yet closed'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5 pb-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-border/40 text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Committed</th>
                <th className="pb-2 text-right font-medium">Scheduled</th>
                <th className="pb-2 text-right font-medium">Published</th>
                <th className="pb-2 text-right font-medium">On time</th>
                <th className="pb-2 text-right font-medium">Late</th>
                <th className="pb-2 text-right font-medium">Unpublished</th>
              </tr>
            </thead>
            <tbody>
              {report.perType.map((row) => (
                <tr key={row.type} className="border-b border-border/20 last:border-0">
                  <td className="py-2 font-medium">{TYPE_LABELS[row.type]}</td>
                  <td className="py-2 text-muted-foreground">{row.committedLabel}</td>
                  <td className="py-2 text-right tabular-nums">{row.scheduled}</td>
                  <td className="py-2 text-right tabular-nums">{row.published}</td>
                  <td className="py-2 text-right tabular-nums">{row.onTime}</td>
                  <td className="py-2 text-right tabular-nums">{row.late}</td>
                  <td className="py-2 text-right tabular-nums">{row.unpublished}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Average approval turnaround</p>
            <p className="text-lg font-semibold tabular-nums">
              {report.avgApprovalHours === null ? '—' : `${report.avgApprovalHours} h`}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sent back</p>
            {rejections.length === 0 ? (
              <p className="text-lg font-semibold">None</p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-sm">
                {rejections.map(([stage, count]) => (
                  <li key={stage}>
                    <span className="font-semibold tabular-nums">{count}</span>{' '}
                    <span className="text-muted-foreground">{stepLabel(stage)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Generated {formatIstDateTime(report.generatedAt)}.
          {!report.frozen && ' Closing the month freezes these numbers so later edits can’t change them.'}
        </p>
      </CardContent>
    </Card>
  )
}
