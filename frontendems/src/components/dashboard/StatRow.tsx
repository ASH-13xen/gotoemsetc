import { Skeleton } from '@/components/ui/skeleton'
import { useCountUp } from '@/hooks/useCountUp'
import { cn } from '@/lib/utils'

interface Stat {
  label: string
  value: number | undefined
  onClick?: () => void
}

// Inline stat group — replaces the old boxed StatCard grid. One shared
// surface with hairline dividers between entries instead of a card per
// number, each value animating in via useCountUp. A stat with an onClick
// becomes a real button that navigates to that number's detail view.
export function StatRow({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-wrap divide-x divide-border overflow-hidden rounded-xl border border-border bg-card',
        className
      )}
    >
      {stats.map((stat) => (
        <StatItem key={stat.label} {...stat} />
      ))}
    </div>
  )
}

function StatItem({ label, value, onClick }: Stat) {
  const ref = useCountUp(value)
  const content = (
    <>
      {value === undefined ? (
        <Skeleton className="h-9 w-16" />
      ) : (
        <span ref={ref} className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">
          0
        </span>
      )}
      <span className="text-xs text-muted-foreground">{label}</span>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-36 flex-1 flex-col gap-1 px-6 py-5 text-left transition-colors hover:bg-secondary/40"
      >
        {content}
      </button>
    )
  }

  return <div className="flex min-w-36 flex-1 flex-col gap-1 px-6 py-5">{content}</div>
}
