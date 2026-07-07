import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { Building2, CheckCircle2, Download, Loader2, PenLine, ShieldAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SignaturePad } from '@/components/signature/SignaturePad'
import { getPublicQuotation, publicQuotationFileUrl, signPublicQuotation } from '@/api/quotations.api'

function CenteredMessage({ icon, title, description }: { icon: React.ReactNode; title: string; description?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-4 text-white">
      <div className="flex max-w-sm flex-col items-center gap-4 border-2 border-white p-8 text-center">
        {icon}
        <h1 className="text-xl font-black tracking-wider uppercase">{title}</h1>
        {description && <p className="text-sm font-bold tracking-widest text-neutral-400 uppercase">{description}</p>}
      </div>
    </div>
  )
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export default function PublicQuotationPage() {
  const { token } = useParams<{ token: string }>()
  const queryClient = useQueryClient()
  const [signOpen, setSignOpen] = useState(false)

  const quotationQuery = useQuery({
    queryKey: ['publicQuotation', token],
    queryFn: () => getPublicQuotation(token as string),
    enabled: Boolean(token),
    retry: false,
  })

  const signMutation = useMutation({
    mutationFn: (signatureDataUrl: string) => signPublicQuotation(token as string, signatureDataUrl),
    onSuccess: () => {
      setSignOpen(false)
      toast.success('Quotation signed — thank you!')
      triggerDownload(publicQuotationFileUrl(token as string), 'quotation-signed.pdf')
      queryClient.invalidateQueries({ queryKey: ['publicQuotation', token] })
    },
    onError: () => toast.error('Could not sign — please try again'),
  })

  if (quotationQuery.isLoading) {
    return <CenteredMessage icon={<Loader2 className="size-8 animate-spin text-neutral-400" />} title="LOADING…" />
  }

  if (quotationQuery.isError) {
    const message = isAxiosError(quotationQuery.error)
      ? (quotationQuery.error.response?.data as { message?: string } | undefined)?.message
      : undefined
    return (
      <CenteredMessage
        icon={<ShieldAlert className="size-8 text-destructive" />}
        title={message || 'LINK IS INVALID.'}
        description="Please contact us for a new link."
      />
    )
  }

  const quotation = quotationQuery.data
  if (!quotation || !token) return null

  const isSigned = quotation.status === 'signed'

  return (
    <div className="min-h-screen bg-black p-6 text-white">
      <main className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-center gap-2 text-neutral-400">
          <Building2 className="size-5" />
          <span className="text-xs font-black tracking-widest uppercase">{quotation.companyLabel}</span>
        </div>

        <div className="border-2 border-white bg-black p-8 space-y-6">
          <div className="border-b-2 border-white pb-4">
            <h1 className="text-2xl font-black tracking-widest text-white uppercase">{quotation.templateTitle}</h1>
            <p className="mt-2 text-sm font-bold tracking-wide text-neutral-400 uppercase">
              {quotation.clientName} — {quotation.brandName}
            </p>
          </div>

          <div className="border-2 border-neutral-800">
            <iframe title="Quotation PDF" src={publicQuotationFileUrl(token)} className="h-[70vh] w-full bg-white" />
          </div>

          {isSigned ? (
            <div className="flex flex-col items-center gap-3 border-2 border-emerald-500 bg-emerald-950/30 p-6 text-center">
              <CheckCircle2 className="size-8 text-emerald-400" />
              <p className="text-sm font-black tracking-widest text-emerald-400 uppercase">
                You've signed this quotation
              </p>
              <Button
                variant="outline"
                className="border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-black"
                onClick={() => triggerDownload(publicQuotationFileUrl(token), 'quotation-signed.pdf')}
              >
                <Download className="size-4" />
                Download Your Copy
              </Button>
            </div>
          ) : (
            <Button
              className="h-14 w-full bg-primary text-lg font-extrabold tracking-widest text-white uppercase hover:opacity-90"
              onClick={() => setSignOpen(true)}
            >
              <PenLine className="size-5" />
              Sign & Accept
            </Button>
          )}
        </div>
      </main>

      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent className="rounded-none border-2 border-white bg-black text-white">
          <DialogHeader>
            <DialogTitle className="tracking-widest uppercase">Sign This Quotation</DialogTitle>
          </DialogHeader>
          <SignaturePad
            onConfirm={(dataUrl) => signMutation.mutate(dataUrl)}
            onCancel={() => setSignOpen(false)}
            confirmLabel={signMutation.isPending ? 'SIGNING…' : 'OK, SIGN & ACCEPT'}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
