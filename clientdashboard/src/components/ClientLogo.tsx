import type { ClientProfile } from '@/lib/api'
import { readableTextColor } from '@/lib/color'

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

// Real logo when TaskClient.logoUrl is set; otherwise a generated initials
// badge in the client's own theme colors, so every demo account looks
// distinct without needing actual logo files uploaded anywhere.
export function ClientLogo({ client, size = 44 }: { client: ClientProfile; size?: number }) {
  if (client.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external/user-provided URL, not a local asset
      <img
        src={client.logoUrl}
        alt={`${client.clientName} logo`}
        className="shrink-0 rounded-xl object-cover"
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl font-black tracking-tight"
      style={{
        width: size,
        height: size,
        backgroundColor: client.theme.primaryColor,
        color: readableTextColor(client.theme.primaryColor),
        fontSize: size * 0.4,
      }}
    >
      {initials(client.brandName || client.clientName)}
    </div>
  )
}
