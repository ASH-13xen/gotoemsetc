import { useState } from 'react'
import { toast } from 'sonner'
import { Copy, PenLine } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SignaturePad } from '@/components/signature/SignaturePad'
import { useAdminSignQuotation } from '@/hooks/useQuotations'

interface AdminSignDialogProps {
  clientId: string
  quotationId: string
  canSign: boolean
}

export function AdminSignDialog({ clientId, quotationId, canSign }: AdminSignDialogProps) {
  const [open, setOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
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

  if (!canSign && !open) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setShareUrl(null)
      }}
    >
      {canSign && (
        <Button className="bg-primary text-white hover:opacity-90" onClick={() => setOpen(true)}>
          <PenLine className="size-4" />
          Sign & Share
        </Button>
      )}
      <DialogContent className="rounded-none border-2 border-white bg-black text-white">
        {shareUrl ? (
          <>
            <DialogHeader>
              <DialogTitle className="tracking-widest uppercase">Ready to Share</DialogTitle>
            </DialogHeader>
            <p className="text-xs font-bold tracking-widest text-neutral-400 uppercase">
              Send this link to the client — they'll be able to view and sign the quotation.
            </p>
            <div className="flex gap-2">
              <Input readOnly value={shareUrl} className="rounded-none border-2 border-white bg-black text-white" />
              <Button variant="outline" onClick={copyLink}>
                <Copy className="size-4" />
              </Button>
            </div>
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
