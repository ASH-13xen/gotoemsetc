import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Copy, Link2, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ManualSendButtons } from '@/components/common/ManualSendButtons'
import { buildGmailComposeUrl, buildWhatsappUrl } from '@/lib/manualSend'
import { useRegenerateShareLink } from '@/hooks/useQuotations'

// Persistent, always-available counterpart to AdminSignDialog's one-shot
// "Ready to Share" screen — that dialog only shows the link once, right
// after signing, and it's gone for good once closed. This lets the admin
// pull it back up (and re-open the WhatsApp/Gmail buttons) any time a
// quotation is awaiting the client's signature, not just in that first
// moment. Each fetch mints a fresh link and invalidates the previous one,
// since only the link's hash is ever stored server-side.
export function QuotationShareLink({
  clientId,
  quotationId,
  clientName,
  contactEmail,
  contactPhone,
}: {
  clientId: string
  quotationId: string
  clientName: string
  contactEmail?: string
  contactPhone?: string
}) {
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const getLink = useRegenerateShareLink(clientId)

  const onFetch = () => {
    getLink.mutate(quotationId, {
      onSuccess: (result) => {
        setShareUrl(result.shareUrl)
        setCopied(false)
      },
      onError: () => toast.error('Could not generate a share link'),
    })
  }

  const copyLink = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    toast.success('Link copied')
  }

  const emailBody = shareUrl
    ? `Hi ${clientName},\n\nPlease review and sign your quotation using the secure link below:\n${shareUrl}\n\nThanks,\nGO-TO Friend`
    : ''
  const whatsappText = shareUrl ? `Hi ${clientName}, please review and sign your quotation using this secure link: ${shareUrl}` : ''

  if (!shareUrl) {
    return (
      <Button size="sm" variant="outline" onClick={onFetch} disabled={getLink.isPending}>
        {getLink.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
        Get share link
      </Button>
    )
  }

  return (
    <div className="grid w-full gap-2 rounded-xl border border-border bg-secondary/30 p-3">
      <div className="flex min-w-0 items-center gap-2">
        <code className="min-w-0 flex-1 truncate text-xs font-mono text-foreground/80">{shareUrl}</code>
        <Button size="sm" variant="outline" className="shrink-0 rounded-lg" onClick={copyLink}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          Copy
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0 rounded-lg"
          onClick={onFetch}
          disabled={getLink.isPending}
          title="Generate a new link — this invalidates the one above"
        >
          {getLink.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
        </Button>
      </div>
      <ManualSendButtons
        emailHref={contactEmail ? buildGmailComposeUrl(contactEmail, 'Your Quotation — GO-TO Friend', emailBody) : undefined}
        whatsappHref={contactPhone ? buildWhatsappUrl(contactPhone, whatsappText) : undefined}
        storageKey={`notified_quotation_share_${quotationId}`}
      />
    </div>
  )
}
