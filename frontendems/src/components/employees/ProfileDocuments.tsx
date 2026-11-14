import { useState } from 'react'
import { toast } from 'sonner'
import { Eye, FileText, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DocumentPreviewDialog } from '@/components/documents/DocumentPreviewDialog'
import { useConfig } from '@/hooks/useConfig'
import { useUploadDocumentDirect, useUploadedDocuments } from '@/hooks/useUploadRequests'
import { extractApiErrorMessage } from '@/lib/errors'
import type { UploadedDocument } from '@/api/uploadRequests.api'

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

// Uploading a document straight onto this employee — the admin only (no
// request link). An earlier file of the same kind is kept.
export function UploadDocumentDialog({
  employeeId,
  employeeName,
  open,
  onOpenChange,
  initialType,
}: {
  employeeId: string
  employeeName: string
  open: boolean
  onOpenChange: (v: boolean) => void
  initialType?: string
}) {
  const { data: config } = useConfig()
  const upload = useUploadDocumentDirect()
  const [docType, setDocType] = useState(initialType ?? '')
  const [otherLabel, setOtherLabel] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const types = (config?.docTypes ?? []).filter((d) => !d.internal)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload a document</DialogTitle>
          <DialogDescription>Attached straight to {employeeName}'s documents. If one of this kind is already on file, it is kept — the new one shows first.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">Document</Label>
            <Select value={docType || undefined} onValueChange={setDocType}>
              <SelectTrigger>
                <SelectValue placeholder="Choose what it is" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {types.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {docType === 'other' && (
            <div className="grid gap-1.5">
              <Label className="text-xs">What is it?</Label>
              <Input value={otherLabel} onChange={(e) => setOtherLabel(e.target.value)} placeholder="e.g. Driving licence" maxLength={80} />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label className="text-xs">File (PDF or image)</Label>
            <Input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={upload.isPending || !docType || !file || (docType === 'other' && !otherLabel.trim())}
            onClick={() =>
              upload.mutate(
                { employeeId, docType, file: file!, otherLabel: docType === 'other' ? otherLabel.trim() : undefined },
                {
                  onSuccess: () => {
                    toast.success('Uploaded')
                    onOpenChange(false)
                  },
                  onError: (err) => toast.error(extractApiErrorMessage(err, 'Could not upload it')),
                }
              )
            }
          >
            {upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// The uploaded documents of one kind, inside a profile section (e.g. the
// passbook in Bank details, the CV in Personal details) — they also stay in
// Requested documents. `match` also picks up "Other" files labelled that way.
export function DocsOfType({
  employeeId,
  employeeName,
  title,
  docTypes,
  match,
  canUpload,
  extra,
}: {
  employeeId: string
  employeeName: string
  title: string
  docTypes: string[]
  match?: RegExp
  canUpload: boolean
  extra?: React.ReactNode
}) {
  const { data, isLoading } = useUploadedDocuments(employeeId)
  const { data: config } = useConfig()
  const [preview, setPreview] = useState<UploadedDocument | null>(null)
  const [uploading, setUploading] = useState(false)
  const docs = (data?.uploadedDocuments ?? []).filter((d) => docTypes.includes(d.docType) || (match && d.docType === 'other' && match.test(d.otherLabel || '')))
  const labelFor = (d: UploadedDocument) => d.otherLabel || config?.docTypes.find((t) => t.key === d.docType)?.label || d.docType
  return (
    <div className="grid gap-2 rounded-xl border border-border bg-secondary/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        {canUpload && (
          <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => setUploading(true)}>
            <Upload className="size-3.5" />
            Upload
          </Button>
        )}
      </div>
      {extra}
      {isLoading ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : docs.length === 0 && !extra ? (
        <p className="text-sm text-muted-foreground">Not uploaded yet.</p>
      ) : (
        docs.map((d, i) => (
          <div key={d._id} className="flex flex-wrap items-center gap-2 rounded-lg bg-card px-3 py-2 ring-1 ring-border">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {labelFor(d)}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {fmt(d.createdAt)}
                {i > 0 && docs.some((x, j) => j < i && x.docType === d.docType) ? ' · earlier copy' : ''}
              </span>
            </span>
            <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setPreview(d)}>
              <Eye className="size-3.5" />
              Preview
            </Button>
          </div>
        ))
      )}
      <DocumentPreviewDialog doc={preview} label={preview ? labelFor(preview) : ''} onClose={() => setPreview(null)} />
      {uploading && <UploadDocumentDialog employeeId={employeeId} employeeName={employeeName} open onOpenChange={setUploading} initialType={docTypes[0]} />}
    </div>
  )
}
