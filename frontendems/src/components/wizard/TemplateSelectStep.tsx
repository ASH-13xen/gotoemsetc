import { Check, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocumentTemplate } from '@/api/templates.api'

interface TemplateSelectStepProps {
  templates: DocumentTemplate[]
  selectedIds: string[]
  onToggle: (id: string) => void
}

export function TemplateSelectStep({ templates, selectedIds, onToggle }: TemplateSelectStepProps) {
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Choose which documents to generate. You'll only be asked for the fields these need.
      </p>
      {templates.map((template) => {
        const selected = selectedIds.includes(template._id)
        return (
          <button
            key={template._id}
            type="button"
            onClick={() => onToggle(template._id)}
            className={cn(
              'flex items-start gap-3 rounded-xl border p-4 text-left transition-colors',
              selected ? 'border-primary bg-accent/50' : 'hover:bg-muted/50'
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border',
                selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
              )}
            >
              {selected && <Check className="size-3.5" />}
            </span>
            <span className="flex-1">
              <span className="flex items-center gap-2 font-medium">
                <FileText className="size-4 text-muted-foreground" />
                {template.title}
              </span>
              {template.description && (
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {template.description}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
