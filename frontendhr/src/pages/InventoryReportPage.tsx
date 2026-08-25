import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
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
import { useInventoryReport } from '@/hooks/useInventory'
import type { EmployeeInventory } from '@/api/inventory.api'

type ColumnKey = keyof EmployeeInventory

const COLUMNS: { key: ColumnKey; label: string; kind: 'text' | 'boolean' }[] = [
  { key: 'deviceName', label: 'Device Name', kind: 'text' },
  { key: 'imeiOrSerialNumber', label: 'IMEI / Serial', kind: 'text' },
  { key: 'deviceColor', label: 'Color', kind: 'text' },
  { key: 'simProvider', label: 'SIM Provider', kind: 'text' },
  { key: 'simPhoneNumber', label: 'SIM Number', kind: 'text' },
  { key: 'screenGuard', label: 'Screen Guard', kind: 'boolean' },
  { key: 'backCover', label: 'Back Cover', kind: 'boolean' },
  { key: 'powerAdapter', label: 'Power Adapter', kind: 'boolean' },
  { key: 'cable', label: 'Cable', kind: 'boolean' },

  { key: 'hasMobile', label: 'Has Mobile', kind: 'boolean' },
  { key: 'mobileOS', label: 'Mobile OS', kind: 'text' },
  { key: 'deviceCondition', label: 'Condition', kind: 'text' },
  { key: 'whatsappTwoFactor', label: 'W/A 2 Factor', kind: 'boolean' },
  { key: 'whatsappTwoFactorBackupMail', label: 'W/A 2 Factor Backup Mail', kind: 'text' },
  { key: 'whatsappTwoFactorPin', label: 'W/A 2 Factor PIN', kind: 'text' },
  { key: 'whatsappNameUpdated', label: 'W/A Name Updated', kind: 'boolean' },
  { key: 'whatsappProfiling', label: 'W/A Profiling', kind: 'boolean' },
  { key: 'whatsappBackupInEmployeeMail', label: 'W/A Backup In Employee Mail', kind: 'boolean' },
  { key: 'galleryBackupInEmployeeMail', label: 'Gallery Backup In Employee Mail', kind: 'boolean' },
  { key: 'trueCallerUpdated', label: 'True Caller Updated', kind: 'boolean' },
  { key: 'theftProtection', label: 'Theft Protection', kind: 'boolean' },
  { key: 'findMyDevice', label: 'Find My Device', kind: 'boolean' },
  { key: 'appleId', label: 'Apple ID', kind: 'text' },
  { key: 'password', label: 'Password', kind: 'text' },
  { key: 'thumbOrFace', label: 'Thumb/Face', kind: 'boolean' },

  { key: 'hasLaptop', label: 'Has Laptop', kind: 'boolean' },
  { key: 'laptopDeviceName', label: 'Laptop', kind: 'text' },
  { key: 'laptopSerialNumber', label: 'Laptop Serial', kind: 'text' },
  { key: 'laptopColor', label: 'Laptop Color', kind: 'text' },
  { key: 'laptopCondition', label: 'Laptop Condition', kind: 'text' },
  { key: 'laptopTheftProtection', label: 'Laptop Theft Protection', kind: 'boolean' },
  { key: 'laptopFindMyDevice', label: 'Laptop Find My Device', kind: 'boolean' },
  { key: 'laptopPassword', label: 'Laptop Password', kind: 'text' },
  { key: 'laptopThumbOrFace', label: 'Laptop Thumb/Face', kind: 'boolean' },
  { key: 'laptopMouse', label: 'Mouse', kind: 'boolean' },

  { key: 'consentFormLink', label: 'Consent Form Link', kind: 'text' },
  { key: 'gotofriendLoggedIn', label: 'Gotofriend12345 Logged In', kind: 'boolean' },
  { key: 'employeeMailLoggedIn', label: 'Employee Mail Logged In', kind: 'boolean' },
  { key: 'clientMailLoggedIn', label: 'Client Mail Logged In', kind: 'boolean' },
  { key: 'goToDataTransfer', label: 'GO-TO Data Transfer', kind: 'boolean' },
  { key: 'podcastDataTransfer', label: 'Podcast Data Transfer', kind: 'boolean' },
]

const DEFAULT_COLUMNS: ColumnKey[] = ['deviceName', 'imeiOrSerialNumber', 'simProvider', 'simPhoneNumber']

function renderCell(value: string | boolean | undefined, kind: 'text' | 'boolean') {
  if (kind === 'boolean') return value ? 'Yes' : 'No'
  return value || '—'
}

export default function InventoryReportPage() {
  const { data, isLoading } = useInventoryReport()
  const employees = data?.employees ?? []
  const [selectedColumns, setSelectedColumns] = useState<Set<ColumnKey>>(new Set(DEFAULT_COLUMNS))
  const [search, setSearch] = useState('')

  const toggleColumn = (key: ColumnKey) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return employees
    return employees.filter(
      (e) => (e.employeeName ?? '').toLowerCase().includes(q) || (e.employeeCode ?? '').toLowerCase().includes(q)
    )
  }, [employees, search])

  const activeColumns = COLUMNS.filter((c) => selectedColumns.has(c.key))

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 py-8">
      <PageHeader
        eyebrow="HR Work"
        title="Inventory details"
        description="Pick the columns you want, then see every employee's inventory values in one table."
      />

      <Card className="p-6">
        <CardContent className="flex flex-wrap gap-x-6 gap-y-2 p-0">
          {COLUMNS.map((col) => (
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
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Code</TableHead>
                {activeColumns.map((col) => (
                  <TableHead key={col.key}>{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.employeeId}>
                  <TableCell className="font-medium text-foreground">{row.employeeName}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{row.employeeCode}</TableCell>
                  {activeColumns.map((col) => (
                    <TableCell key={col.key} className="text-sm text-muted-foreground">
                      {renderCell(row.inventory[col.key], col.kind)}
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
