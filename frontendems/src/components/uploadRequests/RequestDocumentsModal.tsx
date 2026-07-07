import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Copy, FilePlus2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useConfig } from '@/hooks/useConfig'
import { useCreateUploadRequest } from '@/hooks/useUploadRequests'

export function RequestDocumentsModal({ employeeId, trigger }: { employeeId: string; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [expiresInHours, setExpiresInHours] = useState('72')
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: config } = useConfig()
  const createUploadRequest = useCreateUploadRequest(employeeId)

  const reset = () => {
    setSelectedTypes([])
    setExpiresInHours('72')
    setLink(null)
    setCopied(false)
  }

  const onSubmit = () => {
    if (selectedTypes.length === 0) {
      toast.error('Select at least one document to request')
      return
    }
    createUploadRequest.mutate(
      { requestedDocTypes: selectedTypes, expiresInHours: Number(expiresInHours) },
      {
        onSuccess: ({ link: newLink }) => setLink(newLink),
        onError: () => toast.error('Could not create the request'),
      }
    )
  }

  const onCopy = async () => {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    toast.success('Link copied')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline">
            <FilePlus2 className="size-4" />
            Request Documents
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request documents</DialogTitle>
          <DialogDescription>
            Generates a secure link the employee can use to upload files directly — no login
            needed on their end.
          </DialogDescription>
        </DialogHeader>

        {!link ? (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Documents to request</Label>
              <div className="grid gap-2">
                {(config?.docTypes ?? []).map((docType) => {
                  const selected = selectedTypes.includes(docType.key)
                  return (
                    <button
                      key={docType.key}
                      type="button"
                      onClick={() =>
                        setSelectedTypes((prev) =>
                          prev.includes(docType.key)
                            ? prev.filter((k) => k !== docType.key)
                            : [...prev, docType.key]
                        )
                      }
                      className={cn(
                        'flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm',
                        selected ? 'border-primary bg-accent/50' : 'hover:bg-muted/50'
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-4 items-center justify-center rounded border',
                          selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                        )}
                      >
                        {selected && <Check className="size-3" />}
                      </span>
                      {docType.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Link expires in</Label>
              <Select value={expiresInHours} onValueChange={setExpiresInHours}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="72">3 days</SelectItem>
                  <SelectItem value="168">7 days</SelectItem>
                  <SelectItem value="720">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button onClick={onSubmit} disabled={createUploadRequest.isPending}>
                Create link
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="flex min-w-0 items-center gap-2 rounded-md border bg-muted/40 p-3">
              <code className="min-w-0 flex-1 truncate text-xs">{link}</code>
              <Button size="sm" variant="outline" onClick={onCopy}>
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Share this link with the employee (WhatsApp, email, etc.). It only works for the
              documents selected above and expires automatically.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
