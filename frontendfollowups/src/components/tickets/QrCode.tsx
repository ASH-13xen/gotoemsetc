import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

// A QR code that opens the ticket — drawn as SVG so it stays sharp when
// printed. Give either a fixed `size` or a sizing `className`.
export function QrCode({ value, size, className }: { value: string; size?: number; className?: string }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let alive = true
    QRCode.toString(value, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#111827', light: '#ffffff00' } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(''))
    return () => {
      alive = false
    }
  }, [value])
  return (
    <div
      className={`[&>svg]:block [&>svg]:size-full ${className || ''}`}
      style={size ? { width: size, height: size } : undefined}
      aria-label="QR code to open this ticket"
      role="img"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
