// ISO string <-> the value an <input type="datetime-local"> needs (local
// wall-clock time, no timezone suffix) — and back again on submit.
export function toDateTimeLocalValue(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// The Date constructor interprets a bare "YYYY-MM-DDTHH:mm" string as local
// time, so this just needs to round-trip it back out to ISO/UTC.
export function fromDateTimeLocalValue(value: string): string {
  return new Date(value).toISOString()
}
