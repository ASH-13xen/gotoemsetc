import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WizardShellProps {
  stepLabels: string[]
  currentStep: number
  onStepClick: (index: number) => void
  children: React.ReactNode
}

export function WizardShell({ stepLabels, currentStep, onStepClick, children }: WizardShellProps) {
  return (
    <div>
      <ol className="mb-8 flex flex-wrap items-center gap-y-3">
        {stepLabels.map((label, index) => {
          const isDone = index < currentStep
          const isCurrent = index === currentStep
          return (
            <li key={label} className="flex items-center">
              <button
                type="button"
                onClick={() => onStepClick(index)}
                className="flex items-center gap-2 rounded-md px-1 py-1 text-left"
              >
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                    isCurrent && 'bg-primary text-primary-foreground',
                    isDone && !isCurrent && 'bg-primary/15 text-primary',
                    !isDone && !isCurrent && 'bg-muted text-muted-foreground'
                  )}
                >
                  {isDone ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span
                  className={cn(
                    'text-sm',
                    isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {label}
                </span>
              </button>
              {index < stepLabels.length - 1 && (
                <div className="mx-3 h-px w-8 shrink-0 bg-border" />
              )}
            </li>
          )
        })}
      </ol>
      {children}
    </div>
  )
}
