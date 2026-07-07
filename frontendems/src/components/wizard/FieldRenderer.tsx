import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TemplateField } from '@/api/templates.api'

interface FieldRendererProps {
  field: TemplateField
  value: string
  error?: string
  onChange: (value: string) => void
}

export function FieldRenderer({ field, value, error, onChange }: FieldRendererProps) {
  const inputId = `field-${field.key}`

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={inputId}>
        {field.label}
        {!field.required && <span className="font-normal text-muted-foreground">(optional)</span>}
      </Label>

      {field.type === 'textarea' ? (
        <Textarea
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
        />
      ) : field.type === 'select' ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={inputId} className="w-full">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={inputId}
          type={field.type === 'date' ? 'date' : field.type === 'number' || field.type === 'currency' ? 'number' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
        />
      )}

      {field.helpText && !error && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
