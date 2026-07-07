import { z } from 'zod'
import type { TemplateField } from '@/api/templates.api'

// Wizard state stores every field as a raw string (HTML inputs are strings),
// so schemas validate the string shape rather than coercing types — coercing
// here would let `z.coerce.number()` silently turn an empty required field
// into 0 instead of failing validation.
function baseSchemaFor(field: TemplateField): z.ZodTypeAny {
  if (field.type === 'number' || field.type === 'currency') {
    const numeric = z.string().refine((v) => v.trim() !== '' && !Number.isNaN(Number(v)), {
      message: `${field.label} must be a number`,
    })
    return field.required ? numeric : z.union([z.literal(''), numeric])
  }

  const text = z.string()
  return field.required ? text.min(1, `${field.label} is required`) : text.optional().or(z.literal(''))
}

// Builds a zod object schema at runtime from a template's declared fields, so
// wizard step validation stays as data-driven as the fields themselves.
export function buildStepSchema(fields: TemplateField[]) {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const field of fields) {
    shape[field.key] = baseSchemaFor(field)
  }
  return z.object(shape)
}
