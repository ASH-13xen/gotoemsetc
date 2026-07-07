import type { QuotationTemplate, QuotationTemplateFields, FieldPosition } from '@/api/quotationTemplates.api'

export interface MapperFieldDef {
  key: string
  label: string
  colorClass: string
}

const PALETTE = [
  'text-emerald-400',
  'text-sky-400',
  'text-amber-400',
  'text-orange-400',
  'text-fuchsia-400',
  'text-red-400',
  'text-pink-400',
  'text-violet-400',
]

// The set of fields that must be calibrated varies per template — a fixed
// (single-price) template has no plan checkboxes but does need a payable
// amount; a duration/quantity template has 4 checkboxes but no amount field.
export function getMapperFields(template: QuotationTemplate): MapperFieldDef[] {
  const fields: MapperFieldDef[] = []
  let colorIndex = 0
  const nextColor = () => PALETTE[colorIndex++ % PALETTE.length]

  fields.push({
    key: 'clientName',
    label: template.combinedNameBrand ? 'Name & Brand (combined)' : 'Client Name',
    colorClass: nextColor(),
  })
  if (template.hasBrandName && !template.combinedNameBrand) {
    fields.push({ key: 'brandName', label: 'Brand Name', colorClass: nextColor() })
  }
  if (template.hasDateField) {
    fields.push({ key: 'date', label: 'Date', colorClass: nextColor() })
  }
  if (template.planType !== 'fixed') {
    template.planOptions.forEach((option, i) => {
      fields.push({ key: `planCheckbox_${i}`, label: `Plan Checkbox: ${option.label}`, colorClass: nextColor() })
    })
  }
  if (template.planType === 'fixed' && template.fixedAmount) {
    fields.push({ key: 'totalPayableAmount', label: 'Total Payable Amount', colorClass: nextColor() })
  }
  fields.push({ key: 'adminSignature', label: 'Admin Signature', colorClass: nextColor() })
  fields.push({ key: 'clientSignature', label: 'Client Signature', colorClass: nextColor() })
  return fields
}

// planCheckbox_N is synthetic on the frontend — it maps to index N of the
// `planCheckboxes` array in the backend's field shape.
export function getFieldPosition(fields: QuotationTemplateFields, key: string): FieldPosition | undefined {
  if (key.startsWith('planCheckbox_')) {
    const index = Number(key.split('_')[1])
    return fields.planCheckboxes?.[index]
  }
  return (fields as Record<string, FieldPosition | undefined>)[key]
}

export function setFieldPosition(
  fields: QuotationTemplateFields,
  key: string,
  position: FieldPosition,
  planOptionCount: number
): QuotationTemplateFields {
  if (key.startsWith('planCheckbox_')) {
    const index = Number(key.split('_')[1])
    const nextCheckboxes = [...(fields.planCheckboxes ?? [])]
    while (nextCheckboxes.length < planOptionCount) nextCheckboxes.push(undefined as unknown as FieldPosition)
    nextCheckboxes[index] = position
    return { ...fields, planCheckboxes: nextCheckboxes }
  }
  return { ...fields, [key]: position }
}
