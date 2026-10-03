import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useInventoryReport } from '@/hooks/useInventory'
import {
  INVENTORY_ITEM_CATEGORY_LABEL,
  type InventoryItemCategory,
  type InventoryItemRow,
} from '@/api/inventory.api'

type ColumnKey = keyof Omit<InventoryItemRow, 'itemId' | 'employeeId' | 'employeeName' | 'employeeCode' | 'designation' | 'category'>

const CATEGORIES: InventoryItemCategory[] = ['office_phone', 'personal_phone', 'office_laptop', 'personal_laptop']

function isPhoneCategory(c: InventoryItemCategory) {
  return c === 'office_phone' || c === 'personal_phone'
}

// Scoped so the column picker only ever offers fields relevant to the
// category filter currently active — the whole point of splitting inventory
// into categories was to stop phone and laptop fields cluttering one giant
// list together.
const COLUMNS: { key: ColumnKey; label: string; kind: 'text' | 'boolean'; scope: 'common' | 'phone' | 'laptop' }[] = [
  { key: 'deviceName', label: 'Device Name', kind: 'text', scope: 'common' },
  { key: 'serialNumber', label: 'IMEI / Serial', kind: 'text', scope: 'common' },
  { key: 'color', label: 'Color', kind: 'text', scope: 'common' },
  { key: 'condition', label: 'Condition', kind: 'text', scope: 'common' },
  { key: 'password', label: 'Password', kind: 'text', scope: 'common' },
  { key: 'theftProtection', label: 'Theft Protection', kind: 'boolean', scope: 'common' },
  { key: 'findMyDevice', label: 'Find My Device', kind: 'boolean', scope: 'common' },
  { key: 'thumbOrFace', label: 'Thumb/Face', kind: 'boolean', scope: 'common' },

  { key: 'simProvider', label: 'SIM Provider', kind: 'text', scope: 'phone' },
  { key: 'simPhoneNumber', label: 'SIM Number', kind: 'text', scope: 'phone' },
  { key: 'screenGuard', label: 'Screen Guard', kind: 'boolean', scope: 'phone' },
  { key: 'backCover', label: 'Back Cover', kind: 'boolean', scope: 'phone' },
  { key: 'powerAdapter', label: 'Power Adapter', kind: 'boolean', scope: 'phone' },
  { key: 'cable', label: 'Cable', kind: 'boolean', scope: 'phone' },
  { key: 'mobileOS', label: 'Mobile OS', kind: 'text', scope: 'phone' },
  { key: 'appleId', label: 'Apple ID', kind: 'text', scope: 'phone' },
  { key: 'whatsappTwoFactor', label: 'W/A 2 Factor', kind: 'boolean', scope: 'phone' },
  { key: 'whatsappTwoFactorBackupMail', label: 'W/A 2 Factor Backup Mail', kind: 'text', scope: 'phone' },
  { key: 'whatsappTwoFactorPin', label: 'W/A 2 Factor PIN', kind: 'text', scope: 'phone' },
  { key: 'whatsappNameUpdated', label: 'W/A Name Updated', kind: 'boolean', scope: 'phone' },
  { key: 'whatsappProfiling', label: 'W/A Profiling', kind: 'boolean', scope: 'phone' },
  { key: 'whatsappBackupInEmployeeMail', label: 'W/A Backup In Employee Mail', kind: 'boolean', scope: 'phone' },
  { key: 'galleryBackupInEmployeeMail', label: 'Gallery Backup In Employee Mail', kind: 'boolean', scope: 'phone' },
  { key: 'trueCallerUpdated', label: 'True Caller Updated', kind: 'boolean', scope: 'phone' },

  { key: 'mouse', label: 'Mouse Issued', kind: 'boolean', scope: 'laptop' },
]

const DEFAULT_COLUMNS: ColumnKey[] = ['deviceName', 'serialNumber', 'color', 'simProvider', 'simPhoneNumber']

function renderCell(value: string | boolean | undefined, kind: 'text' | 'boolean') {
  if (kind === 'boolean') return value ? 'Yes' : 'No'
  return value || '—'
}

export default function InventoryReportPage() {
  const { data, isLoading } = useInventoryReport()
  const items = data?.items ?? []
  const [selectedCategories, setSelectedCategories] = useState<Set<InventoryItemCategory>>(new Set(CATEGORIES))
  const [selectedColumns, setSelectedColumns] = useState<Set<ColumnKey>>(new Set(DEFAULT_COLUMNS))
  const [search, setSearch] = useState('')

  const toggleCategory = (c: InventoryItemCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }

  const toggleColumn = (key: ColumnKey) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const activeHasPhone = [...selectedCategories].some(isPhoneCategory)
  const activeHasLaptop = [...selectedCategories].some((c) => !isPhoneCategory(c))
  const availableColumns = COLUMNS.filter(
    (c) => c.scope === 'common' || (c.scope === 'phone' && activeHasPhone) || (c.scope === 'laptop' && activeHasLaptop)
  )
  const activeColumns = availableColumns.filter((c) => selectedColumns.has(c.key))

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items
      .filter((item) => selectedCategories.has(item.category))
      .filter(
        (item) =>
          !q || item.employeeName.toLowerCase().includes(q) || (item.employeeCode ?? '').toLowerCase().includes(q)
      )
  }, [items, selectedCategories, search])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 py-8">
      <PageHeader
        eyebrow="HRMS"
        title="Inventory details"
        description="Every categorized inventory item, across every employee — filter by category, pick the columns you want."
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-muted-foreground">Category:</span>
        {CATEGORIES.map((c) => {
          const active = selectedCategories.has(c)
          return (
            <button
              key={c}
              type="button"
              onClick={() => toggleCategory(c)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                active
                  ? 'border-transparent bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground/60 hover:bg-secondary/50'
              )}
            >
              {INVENTORY_ITEM_CATEGORY_LABEL[c]}
            </button>
          )
        })}
      </div>

      <Card className="p-6">
        <CardContent className="flex flex-wrap gap-x-6 gap-y-2 p-0">
          {availableColumns.map((col) => (
            <label key={col.key} className="flex cursor-pointer items-center gap-2 text-sm select-none">
              <input
                type="checkbox"
                checked={selectedColumns.has(col.key)}
                onChange={() => toggleColumn(col.key)}
                className="size-4 rounded border-border text-primary accent-primary cursor-pointer"
              />
              {col.label}
            </label>
          ))}
        </CardContent>
      </Card>

      <div className="relative flex max-w-sm items-center">
        <Search className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground/60" />
        <Input
          placeholder="Search by name or code..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : activeColumns.length === 0 ? (
        <p className="text-sm text-muted-foreground">Pick at least one column above to see the report.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No inventory items match the current category filter.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Category</TableHead>
                {activeColumns.map((col) => (
                  <TableHead key={col.key}>{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row, i) => (
                <TableRow key={row.itemId ?? `${row.employeeId}-${row.category}-${i}`}>
                  <TableCell className="font-medium text-foreground">{row.employeeName}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{row.employeeCode}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{INVENTORY_ITEM_CATEGORY_LABEL[row.category]}</Badge>
                  </TableCell>
                  {activeColumns.map((col) => (
                    <TableCell key={col.key} className="text-sm text-muted-foreground">
                      {renderCell(row[col.key], col.kind)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
