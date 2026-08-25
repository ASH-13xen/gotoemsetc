const REMOTE_BASE_URLS = {
  frontendems: import.meta.env.VITE_EMS_URL || 'http://localhost:5173',
  frontendsales: import.meta.env.VITE_SALES_URL || 'http://localhost:5174',
  frontendfollowups: import.meta.env.VITE_FOLLOWUPS_URL || 'http://localhost:5175',
  frontendhr: import.meta.env.VITE_HR_URL || 'http://localhost:5178',
  frontendop: import.meta.env.VITE_OP_URL || 'http://localhost:5177',
  frontendfinance: import.meta.env.VITE_FINANCE_URL || 'http://localhost:5179',
} as const

const injected = new Set<string>()

// @originjs/vite-plugin-federation only shares JS module graphs — a remote's
// own Tailwind build (dist/assets/remote-style.css, a fixed filename by
// design — see each remote's vite.config.ts assetFileNames) never gets
// pulled into the host page automatically. Any of that remote's classes
// that don't happen to also appear somewhere in frontendall's own source
// silently do nothing (e.g. the EMS Dashboard's search bar collapsing to an
// icon-only box because `flex-1`/`w-48` never applied). Injected once per
// remote, the first time it's actually mounted.
export function ensureRemoteStyles(remoteName: keyof typeof REMOTE_BASE_URLS) {
  if (injected.has(remoteName)) return
  injected.add(remoteName)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `${REMOTE_BASE_URLS[remoteName]}/assets/remote-style.css`
  document.head.appendChild(link)
}
