import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getByPath(obj: unknown, dotPath: string): unknown {
  return dotPath.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[key]
  }, obj)
}

// Writes into a nested object following a dot-path, creating intermediate
// objects as needed — the inverse of getByPath, used to turn a template
// field's `mapsTo: 'address.line1'` into a PATCH-able nested update.
export function setByPath(target: Record<string, unknown>, dotPath: string, value: unknown): void {
  const keys = dotPath.split('.')
  let cursor = target
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (typeof cursor[key] !== 'object' || cursor[key] === null) {
      cursor[key] = {}
    }
    cursor = cursor[key] as Record<string, unknown>
  }
  cursor[keys[keys.length - 1]] = value
}
