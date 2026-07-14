import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Copy, FilePlus2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { ManualSendButtons } from '@/components/common/ManualSendButtons'
import { buildGmailComposeUrl, buildWhatsappUrl } from '@/lib/manualSend'
import { buildDocumentRequestEmailBody, buildDocumentRequestWhatsappText } from '@/lib/documentRequestTemplates'
import { useCreateDocumentRequest } from '@/hooks/useClientDocumentRequests'

export function RequestClientDocumentsModal({
  clientId,
  clientName,
  contactEmail,
  contactPhone,
  trigger,
}: {
  clientId: string
  clientName: string
  contactEmail?: string
  contactPhone?: string
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [items, setItems] = useState<string[]>([])
  const [expiresInHours, setExpiresInHours] = useState('72')
  const [request, setRequest] = useState<{ link: string; accessCode: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const createRequest = useCreateDocumentRequest(clientId)

  const reset = () => {
    setDraft('')
    setItems([])
    setExpiresInHours('72')
    setRequest(null)
    setCopied(false)
  }

  const addItem = () => {
    const value = draft.trim()
    if (!value) return
    if (items.includes(value)) {
      toast.error('Already added')
      return
    }
    setItems((prev) => [...prev, value])
    setDraft('')
  }

  const removeItem = (value: string) => {
    setItems((prev) => prev.filter((i) => i !== value))
  }

  const onSubmit = () => {
    if (items.length === 0) {
      toast.error('Add at least one document to request')
      return
    }
    createRequest.mutate(
      { requestedDocTypes: items, expiresInHours: Number(expiresInHours) },
      {
        onSuccess: ({ request: created }) => {
          if (!created.accessCode) return
          setRequest({ link: created.link, accessCode: created.accessCode })
        },
        onError: () => toast.error('Could not create the request'),
      }
    )
  }

  const docLabels = items.join(', ')
  const emailBody = request ? buildDocumentRequestEmailBody(clientName, docLabels, request.link, request.accessCode) : ''
  const whatsappText = request
    ? buildDocumentRequestWhatsappText(clientName, docLabels, request.link, request.accessCode)
    : ''

  const onCopy = async () => {
    if (!request) return
    await navigator.clipboard.writeText(request.link)
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
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-none border-2 border-white bg-black text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-widest">Request documents</DialogTitle>
          <DialogDescription className="text-neutral-400">
            Type whatever you need from this client — a secure link (plus a separate access code) lets them
            upload directly, no login needed on their end beyond the code.
          </DialogDescription>
        </DialogHeader>

        {!request ? (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Documents to request</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Signed NDA, GST Certificate…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addItem()
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addItem}>
                  Add
                </Button>
              </div>
              {items.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {items.map((item) => (
                    <span
                      key={item}
                      className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
                    >
                      {item}
                      <button type="button" onClick={() => removeItem(item)} aria-label={`Remove ${item}`}>
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label>Link expires in</Label>
              <Select value={expiresInHours} onValueChange={setExpiresInHours}>
                <SelectTrigger className="w-full rounded-xl">
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
            <DialogFooter className="mt-2">
              <Button onClick={onSubmit} className="rounded-xl" disabled={createRequest.isPending}>
                Create link
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border/10 bg-secondary/50 p-3">
              <code className="min-w-0 flex-1 truncate text-xs font-mono pl-2 text-foreground/80">
                {request.link}
              </code>
              <Button size="sm" variant="outline" className="rounded-lg" onClick={onCopy}>
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                Copy
              </Button>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border/10 bg-secondary/50 p-3 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Access code</span>
              <code className="rounded-md bg-background px-2 py-0.5 font-mono font-semibold text-foreground">
                {request.accessCode}
              </code>
            </div>
            <p className="text-xs text-muted-foreground">
              Share both with the client. It only works for the documents listed above and both expire
              automatically.
            </p>
            <ManualSendButtons
              emailHref={contactEmail ? buildGmailComposeUrl(contactEmail, `Document Request — GO-TO Friend`, emailBody) : undefined}
              whatsappHref={contactPhone ? buildWhatsappUrl(contactPhone, whatsappText) : undefined}
              storageKey={`notified_client_doc_request_${request.link.split('/').pop()}`}
            />
            <DialogFooter className="mt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
