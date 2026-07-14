// Client-side "manual send" helpers — deliberately not backed by any API.
// Opens Gmail's compose window / a WhatsApp chat, both prefilled, so the
// admin just has to hit send from their own logged-in account. Ported
// as-is from frontendems's lib/manualSend.ts.

export function normalizePhoneForWhatsapp(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `91${digits}`
  return digits
}

export function buildGmailComposeUrl(to: string, subject: string, body: string): string {
  const params = new URLSearchParams({ view: 'cm', fs: '1', to, su: subject, body })
  return `https://mail.google.com/mail/?${params.toString()}`
}

export function buildWhatsappUrl(phone: string, text: string): string {
  return `https://wa.me/${normalizePhoneForWhatsapp(phone)}?text=${encodeURIComponent(text)}`
}
