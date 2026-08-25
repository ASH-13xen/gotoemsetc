import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StepTrailEntry } from '@/api/cms.api'

function stepLabel(key: string) {
  return key
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

// Renders a pipeline's full step trail left-to-right. Steps up to and
// including the current one are painted their real colour — background tint
// and text both — everything after it stays neutral black/grey, per spec:
// completed steps read as done, future ones read as "not there yet."
export function PipelineStepper({
  trail,
  isSentBack,
  isRejected,
}: {
  trail: StepTrailEntry[]
  isSentBack?: boolean
  isRejected?: boolean
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        {trail.map((step, i) => (
          <div key={step.key} className="flex items-center gap-1">
            <span
              className={cn(
                'rounded-lg border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
                !step.reached && 'border-border text-muted-foreground'
              )}
              style={
                step.reached
                  ? { borderColor: step.color, color: step.color, backgroundColor: `${step.color}1a` }
                  : undefined
              }
            >
              {stepLabel(step.key)}
              {step.current && !isSentBack && !isRejected && (
                <span className="ml-1.5 inline-block size-1.5 rounded-full" style={{ backgroundColor: step.color }} />
              )}
            </span>
            {i < trail.length - 1 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />}
          </div>
        ))}
      </div>
      {isSentBack && (
        <p className="text-xs font-semibold" style={{ color: '#f9a8d4' }}>
          Sent back — waiting on the previous step to be redone.
        </p>
      )}
      {isRejected && (
        <p className="text-xs font-semibold text-destructive">Rejected — this item is closed.</p>
      )}
    </div>
  )
}
