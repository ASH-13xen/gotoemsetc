import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { FileUp, Search, UploadCloud } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UploadedDocumentsList } from '@/components/documents/UploadedDocumentsList'
import { useEmployees } from '@/hooks/useEmployees'
import { useConfig } from '@/hooks/useConfig'
import { useUploadDocumentDirect } from '@/hooks/useUploadRequests'
import { cn } from '@/lib/utils'

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timeout)
  }, [value, delayMs])
  return debounced
}

export default function UploadDocumentsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [employeeId, setEmployeeId] = useState<string | undefined>()
  const [docType, setDocType] = useState<string | undefined>()
  const [otherLabel, setOtherLabel] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const { data: employeesData, isLoading: employeesLoading } = useEmployees({
    search: debouncedSearch || undefined,
    limit: 100,
  })
  const { data: config } = useConfig()
  const uploadDirect = useUploadDocumentDirect()

  const employees = employeesData?.items ?? []
  const selectedEmployee = employees.find((e) => e._id === employeeId)

  const resetForm = () => {
    setDocType(undefined)
    setOtherLabel('')
    setFile(null)
  }

  const onSubmit = () => {
    if (!employeeId) {
      toast.error('Select an employee')
      return
    }
    if (!docType) {
      toast.error('Select a document type')
      return
    }
    if (docType === 'other' && !otherLabel.trim()) {
      toast.error('Type a name for this document')
      return
    }
    if (!file) {
      toast.error('Choose a file to upload')
      return
    }
    uploadDirect.mutate(
      { employeeId, docType, file, otherLabel: docType === 'other' ? otherLabel.trim() : undefined },
      {
        onSuccess: () => {
          toast.success('Document uploaded')
          resetForm()
        },
        onError: () => toast.error('Could not upload the document'),
      }
    )
  }

  return (
    <div className="space-y-8 py-4">
      <main className="mx-auto max-w-6xl space-y-8">
        {/* HERO HEADER */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="flex min-h-[180px] flex-col justify-between p-8 md:col-span-2">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              ADMIN ONLY
            </span>
            <h1 className="text-5xl font-extrabold tracking-tight text-foreground uppercase select-none md:text-7xl">
              UPLOAD DOCUMENTS
            </h1>
          </Card>
          <div
            onClick={() => navigate('/')}
            className="bg-primary/10 text-primary p-8 rounded-2xl flex flex-col justify-between cursor-pointer hover:shadow-glow hover:-translate-y-0.5 active:scale-[0.99] transition-all min-h-[180px]"
          >
            <span className="text-xs font-bold uppercase tracking-widest opacity-80">NAVIGATION</span>
            <span className="text-3xl font-extrabold tracking-wide uppercase">BACK TO PORTAL</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* EMPLOYEE PICKER */}
          <div className="flex max-h-[calc(100vh-260px)] flex-col bg-card/90 backdrop-blur-md rounded-2xl shadow-diffuse border-0 overflow-hidden lg:col-span-1">
            <div className="border-b border-border/15 p-4">
              <div className="relative flex items-center">
                <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground/60 z-10" />
                <Input
                  placeholder="SEARCH EMPLOYEES..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-11 pl-9 text-sm uppercase"
                />
              </div>
            </div>
            <div className="divide-y divide-border/10 overflow-y-auto">
              {employeesLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full bg-neutral-800" />
                  ))}
                </div>
              ) : employees.length === 0 ? (
                <p className="p-6 text-center text-sm font-bold tracking-widest text-neutral-400 uppercase">
                  No employees found
                </p>
              ) : (
                employees.map((employee) => (
                  <button
                    key={employee._id}
                    type="button"
                    onClick={() => setEmployeeId(employee._id)}
                    className={cn(
                      'w-full border-l-4 border-transparent p-4 text-left transition-colors hover:bg-secondary/40',
                      employeeId === employee._id && 'border-primary bg-secondary/50'
                    )}
                  >
                    <p className="font-bold tracking-wide text-foreground uppercase">
                      {employee.firstName} {employee.lastName}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                      {employee.employeeCode} · {employee.designation}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* UPLOAD FORM + EXISTING DOCS */}
          <div className="lg:col-span-2 space-y-8">
            {!employeeId ? (
              <Card className="flex flex-col items-center justify-center gap-4 py-24 text-center">
                <FileUp className="size-16 text-muted-foreground/40" />
                <p className="text-2xl font-bold tracking-wider text-foreground uppercase">Select an employee</p>
                <p className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
                  Choose someone from the list to upload a document for them.
                </p>
              </Card>
            ) : (
              <div className="space-y-6">
                <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
                  <div>
                    <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                      Uploading for
                    </p>
                    <h2 className="text-2xl font-extrabold tracking-tight text-foreground uppercase">
                      {selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : '…'}
                    </h2>
                  </div>
                </Card>

                <Card className="p-6 space-y-4">
                  <div className="grid gap-1.5">
                    <Label>Document type</Label>
                    <Select value={docType} onValueChange={setDocType}>
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue placeholder="Choose a document type" />
                      </SelectTrigger>
                      <SelectContent>
                        {(config?.docTypes ?? []).map((dt) => (
                          <SelectItem key={dt.key} value={dt.key}>
                            {dt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {docType === 'other' && (
                    <div className="grid gap-1.5">
                      <Label>Document name</Label>
                      <Input
                        placeholder="e.g. Salary negotiation letter"
                        value={otherLabel}
                        onChange={(e) => setOtherLabel(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="grid gap-1.5">
                    <Label>File</Label>
                    <Input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </div>

                  <Button
                    onClick={onSubmit}
                    disabled={uploadDirect.isPending}
                    className="rounded-xl"
                  >
                    <UploadCloud className="size-4" />
                    {uploadDirect.isPending ? 'Uploading…' : 'Upload document'}
                  </Button>
                </Card>

                <UploadedDocumentsList employeeId={employeeId} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
