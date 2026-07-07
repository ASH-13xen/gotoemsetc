import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ResponsibilitiesEditorProps {
  value: string[]
  onChange: (value: string[]) => void
  error?: string
}

export function ResponsibilitiesEditor({ value, onChange, error }: ResponsibilitiesEditorProps) {
  const updateRow = (index: number, text: string) => {
    onChange(value.map((row, i) => (i === index ? text : row)))
  }

  const removeRow = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const addRow = () => {
    onChange([...value, ''])
  }

  return (
    <div className="grid gap-3">
      <Label>New responsibilities</Label>
      {value.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            placeholder="e.g. Lead the platform migration"
            value={row}
            onChange={(e) => updateRow(index, e.target.value)}
            className="flex-1"
          />
          <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(index)}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={addRow} className="w-fit">
        <Plus className="size-4" />
        Add responsibility
      </Button>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
