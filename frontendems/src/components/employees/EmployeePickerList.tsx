import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface PickerItem {
  _id: string
  firstName: string
  lastName?: string
  employeeCode: string
  designation: string
}

interface EmployeePickerListProps<T extends PickerItem> {
  search: string
  onSearchChange: (value: string) => void
  isLoading: boolean
  items: T[]
  activeId?: string
  onSelect: (item: T) => void
  renderTrailing?: (item: T) => ReactNode
  itemClassName?: (item: T) => string
  className?: string
}

// Shared searchable employee list used by AttendancePage and
// UploadDocumentsPage, previously duplicated near-verbatim in both.
export function EmployeePickerList<T extends PickerItem>({
  search,
  onSearchChange,
  isLoading,
  items,
  activeId,
  onSelect,
  renderTrailing,
  itemClassName,
  className,
}: EmployeePickerListProps<T>) {
  return (
    <div
      className={cn(
        'flex max-h-[calc(100vh-260px)] flex-col overflow-hidden rounded-xl border border-border',
        className
      )}
    >
      <div className="border-b border-border p-3">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground/60" />
          <Input
            placeholder="Search employees..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 pl-9 text-sm"
          />
        </div>
      </div>
      <div className="divide-y divide-border overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No employees found</p>
        ) : (
          items.map((item) => (
            <button
              key={item._id}
              type="button"
              onClick={() => onSelect(item)}
              className={cn(
                'w-full border-l-2 border-transparent p-3.5 text-left transition-colors hover:bg-secondary/40',
                activeId === item._id && 'border-primary bg-secondary/40',
                itemClassName?.(item)
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium uppercase text-foreground">
                  {item.firstName} {item.lastName}
                </p>
                {renderTrailing?.(item)}
              </div>
              <p className="mt-0.5 text-xs uppercase text-muted-foreground">
                {item.employeeCode} · {item.designation}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
