import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, FileUp, Search, UserPlus, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/layout/PageHeader'
import { QuickActions, QuickActionItem } from '@/components/layout/QuickActions'
import { StatusBadge } from '@/components/employees/StatusBadge'
import { AddEmployeeDialog } from '@/components/employees/AddEmployeeDialog'
import { FlagStrip } from '@/components/employees/EmployeeFlags'
import { StatRow } from '@/components/dashboard/StatRow'
import { useEmployees } from '@/hooks/useEmployees'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useAuth } from '@/hooks/useAuth'
import { useStaggerReveal } from '@/hooks/useStaggerReveal'
import { hasPermission, isAdmin } from '@/lib/permissions'
import type { EmployeeStatus } from '@/api/employees.api'

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timeout)
  }, [value, delayMs])
  return debounced
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<EmployeeStatus | 'all'>('active')
  const debouncedSearch = useDebouncedValue(search, 350)
  const { data, isLoading } = useEmployees({
    search: debouncedSearch || undefined,
    status: status === 'all' ? undefined : status,
    limit: 50,
  })
  const employees = data?.items ?? []
  const { data: stats } = useDashboardStats()
  const tableBodyRef = useStaggerReveal<HTMLTableSectionElement>([isLoading, employees.length])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 py-8">
      <PageHeader
        eyebrow="Employee Management System"
        title="Dashboard"
        description="An overview of your workforce, applicants, and attendance."
        actions={
          hasPermission(user, 'add_employee') && (
            <AddEmployeeDialog
              trigger={
                <Button>
                  <UserPlus className="size-4" />
                  Add employee
                </Button>
              }
            />
          )
        }
      />

      <QuickActions>
        {hasPermission(user, 'view_applicants') && (
          <QuickActionItem
            icon={<Users className="size-4" />}
            label="Applicants"
            description="Recruitment pipeline"
            onClick={() => navigate('/applicants')}
          />
        )}
        <QuickActionItem
          icon={<Clock className="size-4" />}
          label="Attendance"
          description="Workforce tracking"
          onClick={() => navigate('/attendance')}
        />
        {isAdmin(user) && (
          <QuickActionItem
            icon={<FileUp className="size-4" />}
            label="Upload documents"
            description="Admin only"
            onClick={() => navigate('/upload-documents')}
          />
        )}
      </QuickActions>

      <StatRow
        stats={[
          { label: 'Total employees', value: stats?.totalEmployees },
          {
            label: 'Pending document requests',
            value: stats?.pendingUploadRequests,
            onClick: hasPermission(user, 'request_documents') ? () => navigate('/upload-requests') : undefined,
          },
          {
            label: 'Documents generated this month',
            value: stats?.documentsGeneratedThisMonth,
            onClick: hasPermission(user, 'generate_documents') ? () => navigate('/documents') : undefined,
          },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex flex-1 items-center">
          <Search className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground/60" />
          <Input
            placeholder="Search by name, code, designation..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as EmployeeStatus | 'all')}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="offboarded">Offboarded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <Users className="size-10 text-muted-foreground/40" />
            <p className="text-base font-semibold text-foreground">No employees yet</p>
            <p className="text-sm text-muted-foreground">Add your first employee to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody ref={tableBodyRef}>
              {employees.map((employee) => (
                <TableRow
                  key={employee._id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/employees/${employee._id}`)}
                >
                  <TableCell className="font-mono text-xs uppercase text-muted-foreground">
                    {employee.employeeCode}
                  </TableCell>
                  <TableCell className="font-medium uppercase text-foreground">
                    <div className="flex items-center gap-2">
                      {employee.firstName} {employee.lastName}
                      <FlagStrip flags={employee.flags ?? []} />
                    </div>
                  </TableCell>
                  <TableCell className="uppercase">{employee.designation}</TableCell>
                  <TableCell className="uppercase">{employee.department || '—'}</TableCell>
                  <TableCell>
                    <StatusBadge status={employee.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
