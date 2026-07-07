import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { WizardShell } from '@/components/wizard/WizardShell'
import { TemplateSelectStep } from '@/components/wizard/TemplateSelectStep'
import { FieldRenderer } from '@/components/wizard/FieldRenderer'
import { SalaryComponentsEditor } from '@/components/wizard/SalaryComponentsEditor'
import { ReviewGenerateStep } from '@/components/wizard/ReviewGenerateStep'
import { buildStepSchema } from '@/lib/dynamicFieldSchema'
import { getByPath } from '@/lib/utils'
import { useEmployee, useUpdateEmployee } from '@/hooks/useEmployees'
import { useTemplates } from '@/hooks/useTemplates'
import { useGenerateDocuments } from '@/hooks/useDocuments'
import type { TemplateField } from '@/api/templates.api'
import type { GenerateResult } from '@/api/documents.api'
import type { SalaryComponent } from '@/api/employees.api'

function formatValueForInput(value: unknown, type: TemplateField['type']): string {
  if (value === undefined || value === null) return ''
  if (type === 'date') {
    const date = value instanceof Date ? value : new Date(String(value))
    if (Number.isNaN(date.getTime())) return ''
    return date.toISOString().slice(0, 10)
  }
  return String(value)
}

export default function EmployeeWizardPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: employeeData, isLoading: employeeLoading } = useEmployee(id)
  const { data: templatesData, isLoading: templatesLoading } = useTemplates()
  const updateEmployee = useUpdateEmployee(id ?? '')
  const generateDocuments = useGenerateDocuments(id ?? '')

  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([])
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [salaryComponents, setSalaryComponents] = useState<SalaryComponent[]>([])
  const [salaryError, setSalaryError] = useState<string | undefined>()
  const [stepIndex, setStepIndex] = useState(0)
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({})
  const [results, setResults] = useState<GenerateResult[] | null>(null)
  const salaryBackfilledRef = useRef(false)

  const templates = templatesData?.templates ?? []
  const employee = employeeData?.employee

  const unionFields = useMemo(() => {
    const map = new Map<string, TemplateField>()
    for (const templateId of selectedTemplateIds) {
      const template = templates.find((t) => t._id === templateId)
      if (!template) continue
      for (const field of template.fields) {
        if (field.source === 'computed') continue
        if (!map.has(field.key)) map.set(field.key, field)
      }
    }
    return [...map.values()].sort((a, b) => a.order - b.order)
  }, [selectedTemplateIds, templates])

  const groups = useMemo(() => {
    const map = new Map<string, TemplateField[]>()
    for (const field of unionFields) {
      if (!map.has(field.group)) map.set(field.group, [])
      map.get(field.group)!.push(field)
    }
    return [...map.entries()]
  }, [unionFields])

  const needsSalaryComponents = useMemo(
    () =>
      selectedTemplateIds.some((templateId) =>
        templates.find((t) => t._id === templateId)?.loops.some((l) => l.key === 'salaryComponents')
      ),
    [selectedTemplateIds, templates]
  )

  // Backfill blanks from the employee record whenever the set of relevant
  // fields changes (e.g. admin selects another template) — never overwrites
  // something the admin already typed in this session.
  useEffect(() => {
    if (!employee) return
    setFieldValues((prev) => {
      const next = { ...prev }
      for (const field of unionFields) {
        if (next[field.key] !== undefined) continue
        if (field.source === 'employee') {
          const raw = getByPath(employee, field.mapsTo || field.key)
          next[field.key] = formatValueForInput(raw, field.type)
        } else {
          next[field.key] = field.defaultValue ?? ''
        }
      }
      return next
    })
  }, [unionFields, employee])

  // Backfill the salary structure once, from whatever's already on the
  // employee record — never overwrites edits made in this session.
  useEffect(() => {
    if (!employee || salaryBackfilledRef.current) return;
    if (employee.salaryComponents && employee.salaryComponents.length > 0) {
      setSalaryComponents(employee.salaryComponents)
    }
    salaryBackfilledRef.current = true
  }, [employee])

  const stepLabels = [
    'Documents',
    ...groups.map(([name]) => name),
    ...(needsSalaryComponents ? ['Salary Structure'] : []),
    'Review',
  ]
  const totalSteps = stepLabels.length
  const isTemplateStep = stepIndex === 0
  const isReviewStep = stepIndex === totalSteps - 1
  const isSalaryStep = needsSalaryComponents && stepIndex === totalSteps - 2
  const currentGroupFields = !isTemplateStep && !isReviewStep && !isSalaryStep ? groups[stepIndex - 1][1] : []

  if (employeeLoading || templatesLoading || !employeeData) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const handleFieldChange = (key: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }))
    setStepErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const goToStep = (index: number) => {
    setStepErrors({})
    setSalaryError(undefined)
    setStepIndex(Math.max(0, Math.min(totalSteps - 1, index)))
  }

  const handleNext = async () => {
    if (isTemplateStep) {
      if (selectedTemplateIds.length === 0) {
        toast.error('Select at least one document to continue')
        return
      }
      goToStep(stepIndex + 1)
      return
    }

    if (isSalaryStep) {
      const invalid = salaryComponents.length === 0 || salaryComponents.some((c) => !c.label.trim() || !c.monthlyAmount)
      if (invalid) {
        setSalaryError('Add at least one component with a label and a monthly amount')
        return
      }
      try {
        await updateEmployee.mutateAsync({ salaryComponents })
      } catch {
        toast.error('Could not save — check your connection and try again')
        return
      }
      goToStep(stepIndex + 1)
      return
    }

    const schema = buildStepSchema(currentGroupFields)
    const subset = Object.fromEntries(currentGroupFields.map((f) => [f.key, fieldValues[f.key] ?? '']))
    const result = schema.safeParse(subset)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        fieldErrors[String(issue.path[0])] = issue.message
      }
      setStepErrors(fieldErrors)
      return
    }

    const employeeSourcedUpdates: Record<string, string> = {}
    for (const field of currentGroupFields) {
      if (field.source === 'employee') {
        employeeSourcedUpdates[field.mapsTo || field.key] = fieldValues[field.key] ?? ''
      }
    }

    if (Object.keys(employeeSourcedUpdates).length > 0) {
      try {
        await updateEmployee.mutateAsync(employeeSourcedUpdates)
      } catch {
        toast.error('Could not save — check your connection and try again')
        return
      }
    }

    goToStep(stepIndex + 1)
  }

  const handleGenerate = async () => {
    setResults(null)
    const overrides: Record<string, string> = {}
    for (const field of unionFields) {
      if (field.source === 'manual') overrides[field.key] = fieldValues[field.key] ?? ''
    }

    try {
      const { results: generateResults } = await generateDocuments.mutateAsync({
        templateIds: selectedTemplateIds,
        overrides,
      })
      setResults(generateResults)
      if (generateResults.some((r) => r.status === 'failed')) {
        toast.warning('Some documents could not be generated — see details below')
      } else {
        toast.success('Documents generated')
      }
    } catch {
      toast.error('Could not generate documents')
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <main className="mx-auto max-w-3xl space-y-8">
        {/* HERO HEADER */}
        <div className="grid grid-cols-1 md:grid-cols-3 border-2 border-white bg-black">
          {/* Identity Tile */}
          <div className="md:col-span-2 border-b-2 md:border-b-0 md:border-r-2 border-white p-8 flex flex-col justify-between min-h-[160px]">
            <div>
              <span className="text-xs font-black tracking-widest text-neutral-400 uppercase">DOCUMENT GENERATION WIZARD</span>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white">
                GENERATE DOCS
              </h1>
            </div>
            <p className="text-sm font-bold text-neutral-400 mt-2 uppercase tracking-widest">
              {employee?.firstName} {employee?.lastName}
            </p>
          </div>

          {/* Action Navigation Tile */}
          <div
            onClick={() => navigate(`/employees/${id}`)}
            className="bg-primary text-white p-8 flex flex-col justify-between cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all min-h-[160px]"
          >
            <span className="text-xs font-black tracking-widest opacity-80 uppercase">NAVIGATION</span>
            <span className="text-3xl font-extrabold uppercase tracking-wide">BACK TO PROFILE</span>
          </div>
        </div>

        <div className="border-2 border-white bg-black p-6">
          <WizardShell stepLabels={stepLabels} currentStep={stepIndex} onStepClick={goToStep}>
            <AnimatePresence mode="wait">
              <motion.div
                key={stepIndex}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {isTemplateStep && (
                  <TemplateSelectStep
                    templates={templates}
                    selectedIds={selectedTemplateIds}
                    onToggle={(templateId) =>
                      setSelectedTemplateIds((prev) =>
                        prev.includes(templateId)
                          ? prev.filter((x) => x !== templateId)
                          : [...prev, templateId]
                      )
                    }
                  />
                )}

                {!isTemplateStep && !isReviewStep && !isSalaryStep && (
                  <div className="grid gap-6">
                    {currentGroupFields.map((field) => (
                      <FieldRenderer
                        key={field.key}
                        field={field}
                        value={fieldValues[field.key] ?? ''}
                        error={stepErrors[field.key]}
                        onChange={(value) => handleFieldChange(field.key, value)}
                      />
                    ))}
                  </div>
                )}

                {isSalaryStep && (
                  <SalaryComponentsEditor
                    value={salaryComponents}
                    onChange={setSalaryComponents}
                    error={salaryError}
                  />
                )}

                {isReviewStep && (
                  <ReviewGenerateStep
                    templates={templates.filter((t) => selectedTemplateIds.includes(t._id))}
                    fieldValues={fieldValues}
                    onGenerate={handleGenerate}
                    isGenerating={generateDocuments.isPending}
                    results={results}
                    salaryComponents={needsSalaryComponents ? salaryComponents : undefined}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </WizardShell>
        </div>

        {!isReviewStep && (
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              onClick={() => goToStep(stepIndex - 1)}
              disabled={stepIndex === 0}
              className="h-16 text-lg font-black tracking-widest rounded-none border-2 border-white text-white hover:bg-white hover:text-black uppercase"
            >
              BACK
            </Button>
            <Button
              onClick={handleNext}
              disabled={updateEmployee.isPending}
              className="bg-primary h-16 text-lg font-black tracking-widest rounded-none hover:opacity-90 border-none text-white uppercase"
            >
              {updateEmployee.isPending ? (
                <Loader2 className="size-5 animate-spin text-white" />
              ) : (
                'NEXT'
              )}
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
