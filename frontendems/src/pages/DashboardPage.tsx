import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Users } from 'lucide-react'

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
import { StatusBadge } from '@/components/employees/StatusBadge'
import { AddEmployeeDialog } from '@/components/employees/AddEmployeeDialog'
import { StatCard } from '@/components/dashboard/StatCard'
import { useEmployees } from '@/hooks/useEmployees'
import { useDashboardStats } from '@/hooks/useDashboardStats'
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
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<EmployeeStatus | 'all'>('all')
  const debouncedSearch = useDebouncedValue(search, 350)

  const { data, isLoading } = useEmployees({
    search: debouncedSearch || undefined,
    status: status === 'all' ? undefined : status,
    limit: 50,
  })
  const { data: stats } = useDashboardStats()

  const employees = data?.items ?? []

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <main className="mx-auto max-w-6xl space-y-8">
        {/* HERO HEADER */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-transparent">
          {/* Logo/Branding Tile */}
          <div className="md:col-span-2 bg-card border border-border p-8 rounded-2xl flex flex-col justify-between min-h-[180px] shadow-sm">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">EMPLOYEE MANAGEMENT SYSTEM</span>
            <h1 className="text-5xl font-extrabold tracking-tight text-foreground select-none">
              EMS
            </h1>
          </div>

          {/* Action Tiles */}
          <div className="flex flex-col gap-4">
            {/* Go to Applicants Tile */}
            <div
              onClick={() => navigate('/applicants')}
              className="bg-primary text-primary-foreground p-6 rounded-xl flex flex-col justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all min-h-[100px]"
            >
              <span className="text-xs font-bold tracking-wider opacity-90 uppercase">VIEW RECRUITMENT</span>
              <span className="text-2xl font-extrabold tracking-wide">APPLICANTS</span>
            </div>

            {/* Go to Attendance Tile */}
            <div
              onClick={() => navigate('/attendance')}
              className="bg-blue-600 text-white p-6 rounded-xl flex flex-col justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all min-h-[100px]"
            >
              <span className="text-xs font-bold tracking-wider opacity-90 uppercase">WORKFORCE TRACKING</span>
              <span className="text-2xl font-extrabold tracking-wide">ATTENDANCE</span>
            </div>

            {/* Add Employee Tile */}
            <AddEmployeeDialog
              trigger={
                <div
                  className="bg-emerald-600 text-white p-6 rounded-xl flex flex-col justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all min-h-[100px]"
                >
                  <span className="text-xs font-bold tracking-wider opacity-90 uppercase">CREATE PROFILE</span>
                  <span className="text-2xl font-extrabold tracking-wide">ADD EMPLOYEE</span>
                </div>
              }
            />
          </div>
        </div>

        {/* STATS PANEL */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="grid gap-6 sm:grid-cols-3"
        >
          <StatCard label="Total employees" value={stats?.totalEmployees} />
          <StatCard
            label="Pending document requests"
            value={stats?.pendingUploadRequests}
          />
          <StatCard
            label="Documents generated this month"
            value={stats?.documentsGeneratedThisMonth}
          />
        </motion.div>

        {/* FILTERS & CONTROLS */}
        <div className="bg-card border border-border rounded-xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4 shadow-sm">
          <div className="md:col-span-2 relative flex items-center">
            <Search className="pointer-events-none absolute left-4 size-5 text-muted-foreground/60 z-10" />
            <Input
              placeholder="Search by name, code, designation..."
              className="pl-12 h-12 text-base placeholder:text-muted-foreground/60 focus:border-primary"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <Select value={status} onValueChange={(v) => setStatus(v as EmployeeStatus | 'all')}>
              <SelectTrigger className="w-full h-12 text-base border border-border bg-card text-foreground focus:border-primary font-medium rounded-lg uppercase">
                <SelectValue placeholder="FILTER BY STATUS" />
              </SelectTrigger>
              <SelectContent className="border border-border bg-card text-foreground rounded-lg">
                <SelectItem value="all">ALL STATUSES</SelectItem>
                <SelectItem value="draft">DRAFT</SelectItem>
                <SelectItem value="active">ACTIVE</SelectItem>
                <SelectItem value="offboarded">OFFBOARDED</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* EMPLOYEES GRID TABLE */}
        <div className="bg-card border border-border rounded-xl overflow-x-auto shadow-sm">
          {isLoading ? (
            <div className="space-y-4 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full bg-muted/40 rounded-lg" />
              ))}
            </div>
          ) : employees.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <Users className="size-16 text-muted-foreground/40" />
              <p className="text-xl font-bold tracking-tight text-foreground">No employees yet</p>
              <p className="text-sm text-muted-foreground uppercase tracking-wider">
                Add your first employee to get started.
              </p>
            </div>
          ) : (
            <Table className="border-collapse w-full">
              <TableHeader className="bg-muted/30 border-b border-border">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-muted-foreground font-semibold text-xs uppercase tracking-wider p-4">CODE</TableHead>
                  <TableHead className="text-muted-foreground font-semibold text-xs uppercase tracking-wider p-4">NAME</TableHead>
                  <TableHead className="text-muted-foreground font-semibold text-xs uppercase tracking-wider p-4">DESIGNATION</TableHead>
                  <TableHead className="text-muted-foreground font-semibold text-xs uppercase tracking-wider p-4">DEPARTMENT</TableHead>
                  <TableHead className="text-muted-foreground font-semibold text-xs uppercase tracking-wider p-4">STATUS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/60">
                {employees.map((employee) => (
                  <TableRow
                    key={employee._id}
                    className="cursor-pointer hover:bg-secondary/40 transition-colors"
                    onClick={() => navigate(`/employees/${employee._id}`)}
                  >
                    <TableCell className="font-mono text-sm text-muted-foreground p-4">
                      {employee.employeeCode}
                    </TableCell>
                    <TableCell className="font-semibold text-base text-foreground p-4">
                      {employee.firstName} {employee.lastName}
                    </TableCell>
                    <TableCell className="text-sm text-foreground/80 p-4 font-medium">{employee.designation}</TableCell>
                    <TableCell className="text-sm text-foreground/80 p-4 font-medium">{employee.department || '—'}</TableCell>
                    <TableCell className="p-4">
                      <StatusBadge status={employee.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </main>
    </div>
  )
}
