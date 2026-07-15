import { useState } from 'react'
import { toast } from 'sonner'
import { Copy, PenLine } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SignaturePad } from '@/components/signature/SignaturePad'
import { ManualSendButtons } from '@/components/common/ManualSendButtons'
import { buildGmailComposeUrl, buildWhatsappUrl } from '@/lib/manualSend'
import { useAdminSignQuotation } from '@/hooks/useQuotations'

interface AdminSignDialogProps {
  clientId: string
  quotationId: string
  canSign: boolean
  clientName: string
  contactEmail?: string
  contactPhone?: string
}

export function AdminSignDialog({
  clientId,
  quotationId,
  canSign,
  clientName,
  contactEmail,
  contactPhone,
}: AdminSignDialogProps) {
  const [open, setOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [notified, setNotified] = useState(false)
  const adminSign = useAdminSignQuotation(clientId)

  const handleConfirm = (signatureDataUrl: string) => {
    adminSign.mutate(
      { quotationId, signatureDataUrl },
      {
        onSuccess: (result) => setShareUrl(result.shareUrl),
        onError: () => toast.error('Could not save signature'),
      }
    )
  }

  const copyLink = () => {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl)
    toast.success('Link copied to clipboard')
  }

  const emailBody = shareUrl
    ? `Hi ${clientName},\n\nPlease review and sign your quotation using the secure link below:\n${shareUrl}\n\nThanks,\nGO-TO Friend`
    : ''
  const whatsappText = shareUrl
    ? `Hi ${clientName}, please review and sign your quotation using this secure link: ${shareUrl}`
    : ''

  if (!canSign && !open) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setShareUrl(null)
          setNotified(false)
        }
      }}
    >
      {canSign && (
        <Button className="bg-primary text-white hover:opacity-90" onClick={() => setOpen(true)}>
          <PenLine className="size-4" />
          Sign & Share
        </Button>
      )}
      <DialogContent className="rounded-none border-2 border-foreground bg-card text-foreground">
        {shareUrl ? (
          <>
            <DialogHeader>
              <DialogTitle className="tracking-widest uppercase">Ready to Share</DialogTitle>
            </DialogHeader>
            <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
              Send this link to the client — they'll be able to view and sign the quotation.
            </p>
            <div className="flex gap-2">
              <Input readOnly value={shareUrl} className="rounded-none border-2 border-foreground bg-background text-foreground" />
              <Button variant="outline" onClick={copyLink}>
                <Copy className="size-4" />
              </Button>
            </div>
            <ManualSendButtons
              emailHref={contactEmail ? buildGmailComposeUrl(contactEmail, 'Your Quotation — GO-TO Friend', emailBody) : undefined}
              whatsappHref={contactPhone ? buildWhatsappUrl(contactPhone, whatsappText) : undefined}
              checked={notified}
              onCheckedChange={setNotified}
            />
            <Button className="bg-primary text-white hover:opacity-90" onClick={() => setOpen(false)}>
              Done
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="tracking-widest uppercase">Sign as GO-TO Friend</DialogTitle>
            </DialogHeader>
            <SignaturePad
              onConfirm={handleConfirm}
              onCancel={() => setOpen(false)}
              confirmLabel={adminSign.isPending ? 'SAVING…' : 'OK, USE THIS SIGNATURE'}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
