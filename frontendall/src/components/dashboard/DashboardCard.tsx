import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// The one shared shell every dashboard widget renders through — this is
// what makes "cards not the same size" and "every card looks different"
// structurally impossible rather than something each widget has to
// individually remember: `h-full` + the parent grid's default item-stretch
// (see DashboardPage.tsx — none of these grids override it to items-start
// anymore) makes every card in a row match the tallest one, and the
// icon-chip/title/link header is built once here instead of copy-pasted
// into every widget file.
export function DashboardCard({
  icon,
  title,
  viewAllHref,
  viewAllLabel = 'View all',
  headerRight,
  className,
  children,
}: {
  icon: ReactNode
  title: string
  viewAllHref?: string
  viewAllLabel?: string
  headerRight?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Card
      className={cn(
        // transition-[box-shadow,border-color] deliberately excludes
        // opacity/transform — GSAP's mount entrance (DashboardPage.tsx)
        // animates those same two properties on this same element, and a
        // CSS transition racing a JS-driven rAF tween over the same
        // property produces exactly the bug this replaced: cards stuck
        // fading in forever, never quite reaching opacity 1.
        'dashboard-card group flex h-full flex-col rounded-2xl border border-border p-6 transition-[box-shadow,border-color] duration-200 hover:border-primary/25 hover:shadow-[0_8px_24px_-12px_oklch(0.52_0.16_265/0.25)]',
        className
      )}
    >
      <CardContent className="flex flex-1 flex-col p-0">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex min-w-0 items-center gap-2.5 text-sm font-bold text-foreground">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {icon}
            </span>
            <span className="truncate">{title}</span>
          </h2>
          {headerRight}
          {viewAllHref && (
            <Link
              to={viewAllHref}
              className="shrink-0 text-xs font-semibold text-primary hover:underline"
            >
              {viewAllLabel} →
            </Link>
          )}
        </div>
        <div className="mt-4 flex flex-1 flex-col">{children}</div>
      </CardContent>
    </Card>
  )
}

// Centered icon + message instead of a single left-aligned sentence — so a
// card with nothing to show still looks intentional rather than broken,
// and fills the same vertical space its siblings' content would.
export function DashboardCardEmpty({ icon, message }: { icon: ReactNode; message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2.5 rounded-xl bg-secondary/25 py-8 text-center">
      <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        {icon}
      </span>
      <p className="max-w-[220px] text-xs text-muted-foreground">{message}</p>
    </div>
  )
}
