import { Link } from 'react-router-dom'
import { ArrowUpRight, Network } from 'lucide-react'
import { useOrgChart } from '@/hooks/useOrgChart'
import { useAuth } from '@/hooks/useAuth'

// Dashboard entry point to the Organisation chart (everyone sees it; only
// admin can edit) — a glance at the chart, linking to the full canvas.
export function OrgChartTeaser() {
  const { data } = useOrgChart()
  const { user } = useAuth()
  const canEdit = user?.role === 'admin'
  const nodes = data?.nodes ?? []
  // A team box is a container, not a seat — only its role boxes count.
  const vacant = nodes.filter((n) => n.assignees.length === 0 && n.kind !== 'team').length
  const teams = nodes.filter((n) => n.kind === 'team').length
  const people = new Set(nodes.flatMap((n) => n.assignees.map((a) => a._id))).size

  return (
    <Link
      to="/organisation"
      className="dashboard-card group relative block overflow-hidden rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-[0_18px_40px_-18px_rgba(99,102,241,0.45)]"
    >
      <div className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-gradient-to-br from-indigo-500/25 via-violet-500/20 to-fuchsia-500/10 blur-2xl transition-transform duration-700 group-hover:scale-125" />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-md transition-transform duration-500 group-hover:rotate-6">
            <Network className="size-5 text-white" />
          </span>
          <div>
            <p className="text-base font-black tracking-tight text-foreground">Organisation chart</p>
            <p className="text-xs text-muted-foreground">
              {canEdit ? 'Who reports to whom — assign people to every position and team role.' : 'Who reports to whom — see every position, team and the people in them.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          {[
            { label: 'Boxes', value: nodes.length },
            { label: 'Teams', value: teams },
            { label: 'People', value: people },
            ...(canEdit ? [{ label: 'Vacant', value: vacant, warn: vacant > 0 }] : []),
          ].map((s) => (
            <div key={s.label} className="text-right">
              <p className={`text-xl leading-none font-black tabular-nums ${s.warn ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
                {data ? s.value : '–'}
              </p>
              <p className="mt-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">{s.label}</p>
            </div>
          ))}
          <ArrowUpRight className="size-5 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
        </div>
      </div>
    </Link>
  )
}
