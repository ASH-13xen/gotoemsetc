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
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <div className="flex max-w-sm flex-col items-center gap-4 bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
        {icon}
        <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && <p className="text-sm font-semibold tracking-wide text-muted-foreground">{description}</p>}
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
    return <CenteredMessage icon={<Loader2 className="size-8 animate-spin text-primary" />} title="LOADING…" />
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
    <div className="min-h-screen bg-background p-6 text-foreground">
      <main className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Building2 className="size-5 text-primary" />
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{quotation.companyLabel}</span>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 space-y-6 shadow-sm">
          <div className="border-b border-border pb-4">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{quotation.templateTitle}</h1>
            <p className="mt-2 text-sm font-semibold tracking-wide text-muted-foreground">
              {quotation.clientName} — {quotation.brandName}
            </p>
          </div>

          <div className="border border-border rounded-xl overflow-hidden shadow-inner bg-white">
            <iframe title="Quotation PDF" src={publicQuotationFileUrl(token)} className="h-[70vh] w-full bg-white" />
          </div>

          {isSigned ? (
            <div className="flex flex-col items-center gap-3 border border-emerald-500/20 bg-emerald-500/10 p-6 text-center rounded-xl">
              <CheckCircle2 className="size-8 text-emerald-600" />
              <p className="text-sm font-semibold tracking-wider text-emerald-700 uppercase">
                You've signed this quotation
              </p>
              <Button
                variant="outline"
                className="border-emerald-500/30 text-emerald-700 hover:bg-emerald-600 hover:text-white"
                onClick={() => triggerDownload(publicQuotationFileUrl(token), 'quotation-signed.pdf')}
              >
                <Download className="size-4" />
                Download Your Copy
              </Button>
            </div>
          ) : (
            <Button
              className="h-12 w-full bg-primary text-base font-semibold tracking-wide text-primary-foreground hover:opacity-95 rounded-xl shadow-sm hover:shadow active:scale-[0.99] transition-all"
              onClick={() => setSignOpen(true)}
            >
              <PenLine className="size-5" />
              Sign & Accept
            </Button>
          )}
        </div>
      </main>

      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent className="rounded-2xl border border-border bg-card text-foreground shadow-xl">
          <DialogHeader>
            <DialogTitle className="tracking-tight text-foreground font-bold">Sign This Quotation</DialogTitle>
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
