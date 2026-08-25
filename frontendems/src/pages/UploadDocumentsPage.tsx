import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { FileUp, UploadCloud } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmployeePickerList } from '@/components/employees/EmployeePickerList'
import { UploadedDocumentsList } from '@/components/documents/UploadedDocumentsList'
import { useEmployees } from '@/hooks/useEmployees'
import { useConfig } from '@/hooks/useConfig'
import { useUploadDocumentDirect } from '@/hooks/useUploadRequests'

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
    <div className="mx-auto flex max-w-6xl flex-col gap-8 py-8">
      <PageHeader
        eyebrow="Admin only"
        title="Upload documents"
        actions={
          <Button variant="outline" onClick={() => navigate('/')}>
            Back to dashboard
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <EmployeePickerList
            search={search}
            onSearchChange={setSearch}
            isLoading={employeesLoading}
            items={employees}
            activeId={employeeId}
            onSelect={(employee) => setEmployeeId(employee._id)}
          />
        </div>

        <div className="space-y-8 lg:col-span-2">
          {!employeeId ? (
            <Card className="flex flex-col items-center justify-center gap-3 py-24 text-center">
              <FileUp className="size-10 text-muted-foreground/40" />
              <p className="text-base font-semibold text-foreground">Select an employee</p>
              <p className="text-sm text-muted-foreground">
                Choose someone from the list to upload a document for them.
              </p>
            </Card>
          ) : (
            <div className="space-y-6">
              <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <p className="text-xs text-muted-foreground">Uploading for</p>
                  <h2 className="text-lg font-semibold text-foreground">
                    {selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : '…'}
                  </h2>
                </div>
              </Card>

              <Card className="gap-4 p-5">
                <div className="grid gap-1.5">
                  <Label>Document type</Label>
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger className="w-full">
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

                <Button onClick={onSubmit} disabled={uploadDirect.isPending}>
                  <UploadCloud className="size-4" />
                  {uploadDirect.isPending ? 'Uploading…' : 'Upload document'}
                </Button>
              </Card>

              <UploadedDocumentsList employeeId={employeeId} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
