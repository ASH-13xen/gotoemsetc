import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { SalaryComponent } from '@/api/employees.api'

interface SalaryComponentsEditorProps {
  value: SalaryComponent[]
  onChange: (value: SalaryComponent[]) => void
  error?: string
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function SalaryComponentsEditor({ value, onChange, error }: SalaryComponentsEditorProps) {
  const monthlyGross = value.reduce((sum, c) => sum + (Number(c.monthlyAmount) || 0), 0)

  const updateRow = (index: number, patch: Partial<SalaryComponent>) => {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const removeRow = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const addRow = () => {
    onChange([...value, { label: '', monthlyAmount: 0 }])
  }

  return (
    <div className="grid gap-3">
      <Label>Salary structure (monthly amounts)</Label>
      {value.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            placeholder="e.g. Basic, HRA, Special Allowance"
            value={row.label}
            onChange={(e) => updateRow(index, { label: e.target.value })}
            className="flex-1"
          />
          <Input
            type="number"
            placeholder="Monthly amount"
            value={row.monthlyAmount || ''}
            onChange={(e) => updateRow(index, { monthlyAmount: Number(e.target.value) })}
            className="w-40"
          />
          <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(index)}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={addRow} className="w-fit">
        <Plus className="size-4" />
        Add component
      </Button>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="mt-2 flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Monthly gross / Annual CTC</span>
        <span className="font-medium">
          {formatCurrency(monthlyGross)} / {formatCurrency(monthlyGross * 12)}
        </span>
      </div>
    </div>
  )
}
