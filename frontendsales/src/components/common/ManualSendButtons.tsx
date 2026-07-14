import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

// Ported as-is from frontendems's components/common/ManualSendButtons.tsx.
// Both hrefs are plain mailto/wa.me-style URLs built by lib/manualSend.ts —
// clicking either just opens the admin's own Gmail/WhatsApp with the
// message prefilled, they still have to hit send themselves. No backend
// call happens here.
export function ManualSendButtons({
  emailHref,
  whatsappHref,
  storageKey,
  onEmailClick,
  onWhatsappClick,
  checked: checkedProp,
  onCheckedChange,
}: {
  emailHref?: string
  whatsappHref?: string
  storageKey?: string
  onEmailClick?: () => void
  onWhatsappClick?: () => void
  checked?: boolean
  onCheckedChange?: (value: boolean) => void
}) {
  const isControlled = checkedProp !== undefined && onCheckedChange !== undefined
  const [uncontrolledChecked, setUncontrolledChecked] = useState(false)
  const checked = isControlled ? checkedProp : uncontrolledChecked

  useEffect(() => {
    if (!isControlled && storageKey) {
      const stored = localStorage.getItem(storageKey)
      setUncontrolledChecked(stored === 'true')
    }
  }, [isControlled, storageKey])

  const handleToggle = (val: boolean) => {
    if (isControlled) {
      onCheckedChange!(val)
      return
    }
    setUncontrolledChecked(val)
    if (storageKey) {
      localStorage.setItem(storageKey, val ? 'true' : 'false')
    }
  }

  if (!emailHref && !whatsappHref) return null

  return (
    <div className="flex flex-wrap items-center gap-4 mt-2">
      <div className="flex flex-wrap gap-3">
        {emailHref && (
          <Button
            asChild
            className="h-12 px-6 bg-[#EA4335] text-white hover:bg-[#EA4335]/90 hover:scale-[1.01] active:scale-[0.99] transition-all rounded-xl shadow-md border-0 cursor-pointer text-sm font-bold uppercase tracking-wider gap-2 flex items-center shrink-0"
          >
            <a href={emailHref} target="_blank" rel="noreferrer" onClick={() => onEmailClick?.()}>
              <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
              Send Gmail
            </a>
          </Button>
        )}
        {whatsappHref && (
          <Button
            asChild
            className="h-12 px-6 bg-[#25D366] text-white hover:bg-[#25D366]/90 hover:scale-[1.01] active:scale-[0.99] transition-all rounded-xl shadow-md border-0 cursor-pointer text-sm font-bold uppercase tracking-wider gap-2 flex items-center shrink-0"
          >
            <a href={whatsappHref} target="_blank" rel="noreferrer" onClick={() => onWhatsappClick?.()}>
              <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.517 2.266 2.27 3.51 5.276 3.508 8.48-.017 6.66-5.356 11.996-11.97 11.996-2.005-.001-3.973-.503-5.719-1.46L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.403.002 9.773-4.364 9.784-9.769.004-2.617-1.015-5.079-2.871-6.938C16.331 2.039 13.877.99 11.258.991c-5.407 0-9.78 4.364-9.791 9.771-.001 1.71.464 3.385 1.349 4.887L1.815 21.87l6.326-1.66z"/>
              </svg>
              Send WhatsApp
            </a>
          </Button>
        )}
      </div>

      {(storageKey || isControlled) && (
        <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors ml-1">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => handleToggle(e.target.checked)}
            className="size-4.5 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
          />
          <span>Mark as notified</span>
        </label>
      )}
    </div>
  )
}
