import { useState } from 'react'
import { useFieldArray, type Control, type UseFormRegister } from 'react-hook-form'
import { Laptop, Plus, Smartphone, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { INVENTORY_ITEM_CATEGORY_LABEL, type InventoryItemCategory } from '@/api/employees.api'
import type { FormValues } from '@/pages/EmployeeDetailPage'

const CATEGORIES: InventoryItemCategory[] = ['office_phone', 'personal_phone', 'office_laptop', 'personal_laptop']

function isPhoneCategory(category: InventoryItemCategory) {
  return category === 'office_phone' || category === 'personal_phone'
}

type BooleanItemField =
  | 'theftProtection'
  | 'findMyDevice'
  | 'thumbOrFace'
  | 'screenGuard'
  | 'backCover'
  | 'powerAdapter'
  | 'cable'
  | 'mouse'

// Local, compact checkbox chip — deliberately not importing
// EmployeeDetailPage's own CheckboxRow (not exported, and that one is sized
// for a full form section, not a tight per-item grid).
function ItemCheckbox({
  label,
  index,
  field,
  register,
}: {
  label: string
  index: number
  field: BooleanItemField
  register: UseFormRegister<FormValues>
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-secondary/30 px-2.5 py-2 text-xs font-medium text-foreground select-none hover:bg-secondary/50">
      <input
        type="checkbox"
        {...register(`inventoryItems.${index}.${field}`)}
        className="size-3.5 cursor-pointer rounded border-border accent-primary"
      />
      {label}
    </label>
  )
}

// Every categorized inventory item this employee has — Office/Personal
// Phone, Office/Personal Laptop, any number of each (a replaced phone stays
// on record; the new one gets its own entry). Deliberately a leaner field
// set than the legacy single-device Inventory section above it (no WhatsApp
// setup checklist here) — the point of splitting into categories was to cut
// clustering, not carry every field into every item.
export function InventoryItemsManager({
  control,
  register,
  disabled,
}: {
  control: Control<FormValues>
  register: UseFormRegister<FormValues>
  disabled?: boolean
}) {
  const { fields, append, remove } = useFieldArray({ control, name: 'inventoryItems' })
  const [newCategory, setNewCategory] = useState<InventoryItemCategory>('office_phone')

  return (
    <div className="grid gap-4">
      {!disabled && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Category</Label>
            <Select value={newCategory} onValueChange={(v) => setNewCategory(v as InventoryItemCategory)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {INVENTORY_ITEM_CATEGORY_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" onClick={() => append({ category: newCategory })}>
            <Plus className="size-4" />
            Add item
          </Button>
        </div>
      )}

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">No inventory items on record yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {fields.map((field, index) => {
            const isPhone = isPhoneCategory(field.category)
            return (
              <div key={field.id} className="grid gap-3 rounded-xl border border-border bg-secondary/20 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="gap-1.5">
                    {isPhone ? <Smartphone className="size-3" /> : <Laptop className="size-3" />}
                    {INVENTORY_ITEM_CATEGORY_LABEL[field.category]}
                  </Badge>
                  {!disabled && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="grid gap-1">
                    <Label className="text-xs text-muted-foreground">Device name</Label>
                    <Input {...register(`inventoryItems.${index}.deviceName`)} />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs text-muted-foreground">{isPhone ? 'IMEI / Serial' : 'Serial number'}</Label>
                    <Input {...register(`inventoryItems.${index}.serialNumber`)} />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs text-muted-foreground">Color</Label>
                    <Input {...register(`inventoryItems.${index}.color`)} />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs text-muted-foreground">Condition</Label>
                    <Input {...register(`inventoryItems.${index}.condition`)} />
                  </div>
                  {isPhone && (
                    <>
                      <div className="grid gap-1">
                        <Label className="text-xs text-muted-foreground">SIM provider</Label>
                        <Input {...register(`inventoryItems.${index}.simProvider`)} />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs text-muted-foreground">SIM number</Label>
                        <Input {...register(`inventoryItems.${index}.simPhoneNumber`)} />
                      </div>
                    </>
                  )}
                  <div className="grid gap-1 sm:col-span-2">
                    <Label className="text-xs text-muted-foreground">Password</Label>
                    <Input {...register(`inventoryItems.${index}.password`)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <ItemCheckbox label="Theft protection" index={index} field="theftProtection" register={register} />
                  <ItemCheckbox label="Find my device" index={index} field="findMyDevice" register={register} />
                  <ItemCheckbox label="Thumb / face unlock" index={index} field="thumbOrFace" register={register} />
                  {isPhone ? (
                    <>
                      <ItemCheckbox label="Screen guard" index={index} field="screenGuard" register={register} />
                      <ItemCheckbox label="Back cover" index={index} field="backCover" register={register} />
                      <ItemCheckbox label="Power adapter" index={index} field="powerAdapter" register={register} />
                      <ItemCheckbox label="Cable" index={index} field="cable" register={register} />
                    </>
                  ) : (
                    <ItemCheckbox label="Mouse issued" index={index} field="mouse" register={register} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
