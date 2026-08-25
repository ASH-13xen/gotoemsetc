import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Download, FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'
import { ApplicantStatusBadge } from '@/components/applicants/ApplicantStatusBadge'
import { HireDialog } from '@/components/applicants/HireDialog'
import { RejectDialog } from '@/components/applicants/RejectDialog'
import { ScheduleInterviewDialog } from '@/components/applicants/ScheduleInterviewDialog'
import { ManualSendButtons } from '@/components/common/ManualSendButtons'
import { buildWhatsappUrl } from '@/lib/manualSend'
import { useApplicant } from '@/hooks/useApplicants'
import { useEmployee } from '@/hooks/useEmployees'
import type { Applicant, Interview } from '@/api/applicants.api'

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border pb-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || '—'}</p>
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="border-b border-border pb-3 text-base font-semibold text-foreground">{children}</h2>
}

// Covers all 4 combinations (online/offline × scheduled/rescheduled) off
// two booleans rather than 4 separate hardcoded templates — same content,
// less duplication to keep in sync.
function InterviewSendButtons({ applicant, interview }: { applicant: Applicant; interview: Interview }) {
  const name = `${applicant.firstName} ${applicant.lastName || ''}`.trim()
  const position = applicant.positionAppliedFor || 'the role'
  const when = new Date(interview.scheduledAt).toLocaleString()
  const isReschedule = Boolean(interview.rescheduledAt)
  const isOnline = interview.meetingType === 'online'

  const verb = isReschedule ? 'has been rescheduled to' : 'is scheduled for'
  const modeDetail = isOnline
    ? interview.meetingLink
      ? ` Join here: ${interview.meetingLink}`
      : ' This will be an online interview — the link will follow separately.'
    : interview.location
      ? ` Location: ${interview.location}`
      : ' This will be an in-person interview.'

  const whatsappText = `Hi ${name}, your ${isOnline ? 'online' : 'in-person'} interview for ${position} ${verb} ${when}.${modeDetail}`

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Email sent automatically to the applicant and hr@gotofriend.in.
      </p>
      <ManualSendButtons
        whatsappHref={applicant.phone ? buildWhatsappUrl(applicant.phone, whatsappText) : undefined}
        storageKey={`notified_interview_${applicant._id}`}
      />
    </div>
  )
}

function HireSendButtons({ applicant }: { applicant: Applicant }) {
  const { data: employeeData } = useEmployee(applicant.linkedEmployee)
  const name = `${applicant.firstName} ${applicant.lastName || ''}`.trim()
  const position = applicant.positionAppliedFor || 'the role'
  const startDate = employeeData?.employee.dateOfJoining
    ? new Date(employeeData.employee.dateOfJoining).toLocaleDateString()
    : undefined
  const reason = applicant.selectionNotes || ''
  const startDetail = startDate ? ` Your start date is ${startDate}.` : ''

  const whatsappText = `Congratulations ${name}! We're delighted to offer you the position of ${position}.${startDetail} Why we chose you: ${reason}. Welcome to the team!`

  return (
    <ManualSendButtons
      whatsappHref={applicant.phone ? buildWhatsappUrl(applicant.phone, whatsappText) : undefined}
      storageKey={`notified_hire_${applicant._id}`}
    />
  )
}

function RejectSendButtons({ applicant }: { applicant: Applicant }) {
  const name = `${applicant.firstName} ${applicant.lastName || ''}`.trim()
  const position = applicant.positionAppliedFor || 'the role'
  const reason = applicant.rejectionReason || ''

  const whatsappText = `Hi ${name}, thank you for applying for ${position} and for interviewing with us. After careful consideration, we won't be moving forward at this time. Feedback: ${reason}. We wish you the best in your search.`

  return (
    <ManualSendButtons
      whatsappHref={applicant.phone ? buildWhatsappUrl(applicant.phone, whatsappText) : undefined}
      storageKey={`notified_reject_${applicant._id}`}
    />
  )
}

const EXPERIENCE_LABELS: Record<string, string> = {
  fresher: 'Fresher',
  '0-1': '0-1 Year',
  '1-2': '1-2 Year',
  '2-3': '2-3 Year',
  '3-4': '3-4 Year',
  '4+': '4+ Years',
}

const AVAILABILITY_LABELS: Record<string, string> = {
  immediately: 'Immediately',
  '15_days': '15 days notice',
  '30_days': '30 days notice',
  '60_days': '60 days notice',
}

export default function ApplicantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, isLoading } = useApplicant(id)
  const [reviewMode, setReviewMode] = useState(false)

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-8">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const { applicant, activeInterview } = data
  const interviewHasPassed = Boolean(activeInterview && new Date(activeInterview.scheduledAt).getTime() <= Date.now())
  const canReview = applicant.status === 'interview_scheduled' && interviewHasPassed

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 py-8">
      <PageHeader
        eyebrow="Applicant profile"
        title={`${applicant.firstName} ${applicant.lastName}`}
        description={applicant.positionAppliedFor || 'No position specified'}
        actions={
          <Button variant="outline" onClick={() => navigate('/applicants')}>
            Back to pipeline
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <ApplicantStatusBadge status={applicant.status} />

        {applicant.status === 'pending' && (
          <ScheduleInterviewDialog applicantId={applicant._id} trigger={<Button size="sm">Schedule interview</Button>} />
        )}

        {applicant.status === 'interview_scheduled' && !interviewHasPassed && (
          <ScheduleInterviewDialog
            applicantId={applicant._id}
            isReschedule
            trigger={
              <Button size="sm" variant="outline">
                Reschedule interview
              </Button>
            }
          />
        )}

        {canReview && !reviewMode && (
          <Button size="sm" onClick={() => setReviewMode(true)}>
            Review applicant
          </Button>
        )}

        {canReview && reviewMode && (
          <>
            <HireDialog
              applicantId={applicant._id}
              positionAppliedFor={applicant.positionAppliedFor}
              trigger={<Button size="sm">Hire applicant</Button>}
            />
            <RejectDialog
              applicantId={applicant._id}
              trigger={
                <Button size="sm" variant="destructive">
                  Reject applicant
                </Button>
              }
            />
          </>
        )}
      </div>

      {activeInterview && applicant.status === 'interview_scheduled' && (
        <Card className="gap-4 p-6">
          <SectionTitle>Interview</SectionTitle>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Field
              label={interviewHasPassed ? 'Was scheduled for' : 'Scheduled for'}
              value={new Date(activeInterview.scheduledAt).toLocaleString()}
            />
            <Field label="Type" value={activeInterview.meetingType === 'online' ? 'Online' : 'Offline (in-person)'} />
            {activeInterview.meetingType === 'online' ? (
              <Field label="Meeting link" value={activeInterview.meetingLink} />
            ) : (
              <Field label="Location" value={activeInterview.location} />
            )}
            <Field label="Notes" value={activeInterview.notes} />
          </div>
          <div className="pt-2">
            <p className="mb-2 text-xs text-muted-foreground">Notify the applicant</p>
            <InterviewSendButtons applicant={applicant} interview={activeInterview} />
          </div>
        </Card>
      )}

      {/* DETAILS SECTION */}
      <Card className="gap-6 p-6">
        <SectionTitle>Applicant details</SectionTitle>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Field label="Email" value={applicant.email} />
          <Field label="WhatsApp number" value={applicant.phone} />
          <Field label="Instagram" value={applicant.instagramId} />
          <Field label="Date applied" value={new Date(applicant.dateApplied).toLocaleDateString()} />
          <Field
            label="Experience"
            value={applicant.experienceLevel ? EXPERIENCE_LABELS[applicant.experienceLevel] : undefined}
          />
          <Field
            label="Availability"
            value={applicant.availability ? AVAILABILITY_LABELS[applicant.availability] : undefined}
          />
          <Field label="Own laptop?" value={applicant.hasLaptop === undefined ? undefined : applicant.hasLaptop ? 'Yes' : 'No'} />
          <Field
            label="From Raipur / willing to relocate?"
            value={applicant.willingToRelocate === undefined ? undefined : applicant.willingToRelocate ? 'Yes' : 'No'}
          />
          <Field label="How they found us" value={applicant.howDidYouFindUs} />
          <Field
            label="Work style preference"
            value={applicant.workStylePreference === 'alone' ? 'Alone' : applicant.workStylePreference === 'team' ? 'Team' : undefined}
          />
          <Field label="Current salary" value={applicant.currentSalary} />
          <Field label="Expected salary" value={applicant.expectedSalary} />
        </div>

        <div className="grid grid-cols-1 gap-6">
          <Field label="Why they want to join" value={applicant.whyJoinCompany} />
          <Field label="Why we should hire them" value={applicant.whyHireYou} />
        </div>

        <div className="pt-2">
          <p className="mb-2 text-xs text-muted-foreground">Resume file(s)</p>
          {applicant.resumes && applicant.resumes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {applicant.resumes.map((resume, i) => (
                <a
                  key={i}
                  href={resume.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-secondary/40 px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary/70"
                >
                  <Download className="size-3.5" />
                  {resume.originalFilename || `Download resume ${i + 1}`}
                </a>
              ))}
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="size-4" />
              No resume uploaded
            </p>
          )}
        </div>
      </Card>

      {applicant.status === 'hired' && (
        <Card className="gap-6 p-6">
          <SectionTitle>Hire details</SectionTitle>
          <div className="grid grid-cols-1 gap-6">
            <Field
              label="Decision date"
              value={applicant.decisionDate ? new Date(applicant.decisionDate).toLocaleDateString() : undefined}
            />
            <Field label="Why they were selected" value={applicant.selectionNotes} />
            {applicant.linkedEmployee && (
              <Button className="w-fit" onClick={() => navigate(`/employees/${applicant.linkedEmployee}`)}>
                View employee record
              </Button>
            )}
          </div>
          <div className="pt-2">
            <p className="mb-2 text-xs text-muted-foreground">Notify the applicant</p>
            <HireSendButtons applicant={applicant} />
          </div>
        </Card>
      )}

      {applicant.status === 'rejected' && (
        <Card className="gap-6 p-6">
          <SectionTitle>Rejection details</SectionTitle>
          <div className="grid grid-cols-1 gap-6">
            <Field
              label="Decision date"
              value={applicant.decisionDate ? new Date(applicant.decisionDate).toLocaleDateString() : undefined}
            />
            <Field label="Reason" value={applicant.rejectionReason} />
          </div>
          <div className="pt-2">
            <p className="mb-2 text-xs text-muted-foreground">Notify the applicant</p>
            <RejectSendButtons applicant={applicant} />
          </div>
        </Card>
      )}
    </div>
  )
}
