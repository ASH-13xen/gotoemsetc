// Simple relative-luminance threshold, not a full WCAG contrast computation
// — good enough to pick readable text over an arbitrary brand hex. Shared by
// the logo badge and the header, since both paint text directly on top of a
// client-chosen color that could be light (cream, pale yellow) or dark.
export function readableTextColor(hex: string) {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#111111' : '#ffffff'
}

// readableTextColor's output is always pure black or white, so a plain hex
// -> rgb split is enough here (no need to handle arbitrary hex inputs).
export function withAlpha(hex: string, alpha: number) {
  const isBlack = hex === '#111111'
  const channel = isBlack ? 17 : 255
  return `rgba(${channel}, ${channel}, ${channel}, ${alpha})`
}
