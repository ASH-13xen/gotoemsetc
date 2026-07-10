import { Mail, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Both hrefs are plain mailto/wa.me-style URLs built by lib/manualSend.ts —
// clicking either just opens the admin's own Gmail/WhatsApp with the
// message prefilled, they still have to hit send themselves. No backend
// call happens here.
export function ManualSendButtons({
  emailHref,
  whatsappHref,
  size = 'sm',
}: {
  emailHref?: string
  whatsappHref?: string
  size?: 'sm' | 'default'
}) {
  if (!emailHref && !whatsappHref) return null

  return (
    <div className="flex flex-wrap gap-2">
      {emailHref && (
        <Button asChild size={size} variant="outline">
          <a href={emailHref} target="_blank" rel="noreferrer">
            <Mail className="size-3.5" />
            Send Email
          </a>
        </Button>
      )}
      {whatsappHref && (
        <Button asChild size={size} variant="outline">
          <a href={whatsappHref} target="_blank" rel="noreferrer">
            <MessageCircle className="size-3.5" />
            Send WhatsApp
          </a>
        </Button>
      )}
    </div>
  )
}
