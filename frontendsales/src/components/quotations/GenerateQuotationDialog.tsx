import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuotationTemplates } from '@/hooks/useQuotationTemplates'
import { useGenerateQuotation } from '@/hooks/useQuotations'

interface GenerateQuotationDialogProps {
  clientId: string
  hasActiveQuotation: boolean
}

export function GenerateQuotationDialog({ clientId, hasActiveQuotation }: GenerateQuotationDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'warning' | 'form'>('form')
  const [templateId, setTemplateId] = useState('')
  const [planOptionKey, setPlanOptionKey] = useState('')

  const { data: templates } = useQuotationTemplates()
  const generateQuotation = useGenerateQuotation(clientId)

  const selectedTemplate = templates?.find((t) => t._id === templateId)
  const needsPlanOption = selectedTemplate && selectedTemplate.planType !== 'fixed'
  const canSubmit = Boolean(templateId) && (!needsPlanOption || Boolean(planOptionKey))

  const resetAndClose = () => {
    setOpen(false)
    setStep('form')
    setTemplateId('')
    setPlanOptionKey('')
  }

  const handleSubmit = () => {
    generateQuotation.mutate(
      { templateId, planOptionKey: needsPlanOption ? planOptionKey : undefined },
      {
        onSuccess: () => {
          toast.success(hasActiveQuotation ? 'New quotation generated — previous one superseded' : 'Quotation generated')
          resetAndClose()
        },
        onError: () => toast.error('Could not generate quotation'),
      }
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          resetAndClose()
        } else {
          setOpen(true)
          setStep(hasActiveQuotation ? 'warning' : 'form')
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className={hasActiveQuotation ? 'border-2 border-amber-500 bg-transparent text-amber-600 hover:bg-amber-500 hover:text-black' : 'bg-primary text-white hover:opacity-90'}>
          {hasActiveQuotation ? 'Change Quotation' : 'Generate Quotation'}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-none border-2 border-foreground bg-card text-foreground">
        {step === 'warning' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 tracking-widest uppercase">
                <TriangleAlert className="size-5 text-amber-600" />
                Replace Current Quotation?
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Starting a new quotation immediately replaces the current one — even if the client hasn't
                signed it yet. If the client had already signed and been onboarded off the current
                quotation, their status will revert to <span className="font-bold text-foreground">Lead</span>{' '}
                until the new one is signed.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={resetAndClose}>
                Cancel
              </Button>
              <Button className="bg-amber-500 text-black hover:bg-amber-400" onClick={() => setStep('form')}>
                Yes, Start New Quotation
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="tracking-widest uppercase">
                {hasActiveQuotation ? 'New Quotation' : 'Generate Quotation'}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Pick a template — client name and brand name are filled in automatically.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label className="text-xs font-black tracking-widest text-muted-foreground uppercase">Template</Label>
                <Select
                  value={templateId}
                  onValueChange={(v) => {
                    setTemplateId(v)
                    setPlanOptionKey('')
                  }}
                >
                  <SelectTrigger className="rounded-none border-2 border-foreground bg-card text-foreground">
                    <SelectValue placeholder="SELECT A TEMPLATE" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-2 border-foreground bg-card text-foreground">
                    {templates?.map((t) => (
                      <SelectItem key={t._id} value={t._id} disabled={!t.isConfigured}>
                        {t.title}
                        {!t.isConfigured ? ' (not configured)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {needsPlanOption && selectedTemplate && (
                <div className="grid gap-1.5">
                  <Label className="text-xs font-black tracking-widest text-muted-foreground uppercase">Plan</Label>
                  <Select value={planOptionKey} onValueChange={setPlanOptionKey}>
                    <SelectTrigger className="rounded-none border-2 border-foreground bg-card text-foreground">
                      <SelectValue placeholder="SELECT A PLAN" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border-2 border-foreground bg-card text-foreground">
                      {selectedTemplate.planOptions.map((option) => (
                        <SelectItem key={option.key} value={option.key}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                className="bg-primary text-white hover:opacity-90"
                disabled={!canSubmit || generateQuotation.isPending}
                onClick={handleSubmit}
              >
                {generateQuotation.isPending && <Loader2 className="size-4 animate-spin" />}
                Generate
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
