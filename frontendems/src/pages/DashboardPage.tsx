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
    <div className="min-h-screen bg-black text-white p-6">
      <main className="mx-auto max-w-6xl space-y-8">
        {/* SWISS GRID HERO HEADER */}
        <div className="grid grid-cols-1 md:grid-cols-3 border-2 border-white bg-black">
          {/* Logo/Branding Tile */}
          <div className="md:col-span-2 border-b-2 md:border-b-0 md:border-r-2 border-white p-8 flex flex-col justify-between min-h-[180px]">
            <span className="text-xs font-black tracking-widest text-neutral-400 uppercase">EMPLOYEE MANAGEMENT SYSTEM</span>
            <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter text-white select-none">
              EMS
            </h1>
          </div>

          {/* Action Tiles */}
          <div className="grid grid-cols-1 divide-y-2 divide-white">
            {/* Go to Applicants Tile */}
            <div
              onClick={() => navigate('/applicants')}
              className="bg-primary text-primary-foreground p-8 flex flex-col justify-between cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all min-h-[120px]"
            >
              <span className="text-xs font-black tracking-widest opacity-80 uppercase">VIEW RECRUITMENT</span>
              <span className="text-3xl font-extrabold uppercase tracking-wide">APPLICANTS</span>
            </div>

            {/* Go to Attendance Tile */}
            <div
              onClick={() => navigate('/attendance')}
              className="bg-blue-700 text-white p-8 flex flex-col justify-between cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all min-h-[120px]"
            >
              <span className="text-xs font-black tracking-widest opacity-80 uppercase">WORKFORCE TRACKING</span>
              <span className="text-3xl font-extrabold uppercase tracking-wide">ATTENDANCE</span>
            </div>

            {/* Add Employee Tile */}
            <AddEmployeeDialog
              trigger={
                <div
                  className="bg-emerald-600 text-white p-8 flex flex-col justify-between cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all min-h-[120px]"
                >
                  <span className="text-xs font-black tracking-widest opacity-80 uppercase">CREATE PROFILE</span>
                  <span className="text-3xl font-extrabold uppercase tracking-wide">ADD EMPLOYEE</span>
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
        <div className="border-2 border-white bg-black p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 relative flex items-center">
            <Search className="pointer-events-none absolute left-4 size-5 text-neutral-400 z-10" />
            <Input
              placeholder="SEARCH BY NAME, CODE, DESIGNATION..."
              className="pl-12 h-14 text-lg border-2 border-white bg-black text-white focus:border-primary font-bold placeholder:text-neutral-500 rounded-none uppercase"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <Select value={status} onValueChange={(v) => setStatus(v as EmployeeStatus | 'all')}>
              <SelectTrigger className="w-full h-14 text-lg border-2 border-white bg-black text-white focus:border-primary font-bold rounded-none uppercase">
                <SelectValue placeholder="FILTER BY STATUS" />
              </SelectTrigger>
              <SelectContent className="border-2 border-white bg-black text-white rounded-none">
                <SelectItem value="all">ALL STATUSES</SelectItem>
                <SelectItem value="draft">DRAFT</SelectItem>
                <SelectItem value="active">ACTIVE</SelectItem>
                <SelectItem value="offboarded">OFFBOARDED</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* EMPLOYEES GRID TABLE */}
        <div className="border-2 border-white bg-black overflow-x-auto">
          {isLoading ? (
            <div className="space-y-4 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full bg-neutral-800 rounded-none" />
              ))}
            </div>
          ) : employees.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <Users className="size-16 text-neutral-600" />
              <p className="text-2xl font-black uppercase tracking-wider text-white">No employees yet</p>
              <p className="text-sm text-neutral-400 uppercase tracking-widest">
                Add your first employee to get started.
              </p>
            </div>
          ) : (
            <Table className="border-collapse w-full">
              <TableHeader className="bg-neutral-900 border-b-2 border-white">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="text-white font-black text-xs uppercase tracking-widest p-4">CODE</TableHead>
                  <TableHead className="text-white font-black text-xs uppercase tracking-widest p-4">NAME</TableHead>
                  <TableHead className="text-white font-black text-xs uppercase tracking-widest p-4">DESIGNATION</TableHead>
                  <TableHead className="text-white font-black text-xs uppercase tracking-widest p-4">DEPARTMENT</TableHead>
                  <TableHead className="text-white font-black text-xs uppercase tracking-widest p-4">STATUS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y-2 divide-neutral-900">
                {employees.map((employee) => (
                  <TableRow
                    key={employee._id}
                    className="cursor-pointer border-none hover:bg-neutral-900 transition-colors"
                    onClick={() => navigate(`/employees/${employee._id}`)}
                  >
                    <TableCell className="font-mono text-sm text-neutral-400 p-4 font-bold">
                      {employee.employeeCode}
                    </TableCell>
                    <TableCell className="font-black text-base text-white p-4 uppercase tracking-wider">
                      {employee.firstName} {employee.lastName}
                    </TableCell>
                    <TableCell className="text-sm text-neutral-300 p-4 font-bold uppercase">{employee.designation}</TableCell>
                    <TableCell className="text-sm text-neutral-300 p-4 font-bold uppercase">{employee.department || '—'}</TableCell>
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
