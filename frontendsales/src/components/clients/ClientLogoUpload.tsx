import { useRef } from 'react'
import { toast } from 'sonner'
import { Building2, Loader2, Upload } from 'lucide-react'
import { useUploadClientLogo } from '@/hooks/useClients'

export function ClientLogoUpload({ clientId, logoUrl, clientName }: { clientId: string; logoUrl?: string; clientName: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const uploadLogo = useUploadClientLogo(clientId)

  const onSelect = (file: File | undefined) => {
    if (!file) return
    uploadLogo.mutate(file, {
      onSuccess: () => toast.success('Logo updated'),
      onError: () => toast.error('Could not upload logo'),
    })
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="group relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-secondary/40"
      title="Upload client logo"
    >
      {logoUrl ? (
        <img src={logoUrl} alt={`${clientName} logo`} className="size-full object-cover" />
      ) : (
        <Building2 className="size-8 text-muted-foreground" />
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
        {uploadLogo.isPending ? (
          <Loader2 className="size-5 animate-spin text-white" />
        ) : (
          <Upload className="size-5 text-white" />
        )}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => onSelect(e.target.files?.[0])}
      />
    </button>
  )
}
