import { isAxiosError } from 'axios'

// Every validation failure the backend returns (Zod body/query/params
// validation, or a Mongoose schema ValidationError) shares the same
// `{ message, details }` shape, where `details` is a flat
// "dotted.path" -> message map — one entry per failing field, including
// nested ones (e.g. "permanentAddress.pincode") — see
// backend/src/middlewares/validate.middleware.js and error.middleware.js.
// This turns that into one readable string naming exactly which field(s)
// are wrong, instead of the generic top-level message ("Invalid body")
// that hides where the actual problem is.
export function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (!isAxiosError(error)) return fallback
  const data = error.response?.data as { message?: string; details?: unknown } | undefined
  if (!data) return fallback

  if (data.details && typeof data.details === 'object' && !Array.isArray(data.details)) {
    const fieldMessages = Object.entries(data.details as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([field, message]) => `${field}: ${message}`)
    if (fieldMessages.length > 0) return fieldMessages.join('; ')
  }

  return data.message || fallback
}
