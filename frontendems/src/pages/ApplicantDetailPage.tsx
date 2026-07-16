import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Download, FileText } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { ApplicantStatusBadge } from '@/components/applicants/ApplicantStatusBadge'
import { HireDialog } from '@/components/applicants/HireDialog'
import { RejectDialog } from '@/components/applicants/RejectDialog'
import { ScheduleInterviewDialog } from '@/components/applicants/ScheduleInterviewDialog'
import { ManualSendButtons } from '@/components/common/ManualSendButtons'
import { buildGmailComposeUrl, buildWhatsappUrl } from '@/lib/manualSend'
import { useApplicant } from '@/hooks/useApplicants'
import { useEmployee } from '@/hooks/useEmployees'
import { useConfig } from '@/hooks/useConfig'
import type { Applicant, Interview } from '@/api/applicants.api'

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="border-b border-border/40 pb-3">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-foreground mt-1 uppercase tracking-wide">{value || '—'}</p>
    </div>
  )
}

// Covers all 4 combinations (online/offline × scheduled/rescheduled) off
// two booleans rather than 4 separate hardcoded templates — same content,
// less duplication to keep in sync.
function InterviewSendButtons({ applicant, interview }: { applicant: Applicant; interview: Interview }) {
  const { data: config } = useConfig()
  const companyName = config?.companyName ?? 'us'
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
      <p className="text-xs font-semibold text-muted-foreground">
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
  const { data: config } = useConfig()
  const { data: employeeData } = useEmployee(applicant.linkedEmployee)
  const companyName = config?.companyName ?? 'us'
  const name = `${applicant.firstName} ${applicant.lastName || ''}`.trim()
  const position = applicant.positionAppliedFor || 'the role'
  const startDate = employeeData?.employee.dateOfJoining
    ? new Date(employeeData.employee.dateOfJoining).toLocaleDateString()
    : undefined
  const reason = applicant.selectionNotes || ''
  const startDetail = startDate ? ` Your start date is ${startDate}.` : ''

  const emailBody = `Hi ${name},\n\nCongratulations! We're delighted to offer you the position of ${position}.${startDetail} Why we chose you: ${reason}\n\nWelcome to the team!\n\nThanks,\n${companyName} HR`
  const whatsappText = `Congratulations ${name}! We're delighted to offer you the position of ${position}.${startDetail} Why we chose you: ${reason}. Welcome to the team!`

  return (
    <ManualSendButtons
      emailHref={applicant.email ? buildGmailComposeUrl(applicant.email, `You're hired — ${companyName}`, emailBody) : undefined}
      whatsappHref={applicant.phone ? buildWhatsappUrl(applicant.phone, whatsappText) : undefined}
      storageKey={`notified_hire_${applicant._id}`}
    />
  )
}

function RejectSendButtons({ applicant }: { applicant: Applicant }) {
  const { data: config } = useConfig()
  const companyName = config?.companyName ?? 'us'
  const name = `${applicant.firstName} ${applicant.lastName || ''}`.trim()
  const position = applicant.positionAppliedFor || 'the role'
  const reason = applicant.rejectionReason || ''

  const emailBody = `Hi ${name},\n\nThank you for applying for ${position} and for interviewing with us. After careful consideration, we won't be moving forward at this time.\n\nFeedback: ${reason}\n\nWe wish you the best in your search.\n\nThanks,\n${companyName} HR`
  const whatsappText = `Hi ${name}, thank you for applying for ${position} and for interviewing with us. After careful consideration, we won't be moving forward at this time. Feedback: ${reason}. We wish you the best in your search.`

  return (
    <ManualSendButtons
      emailHref={applicant.email ? buildGmailComposeUrl(applicant.email, `Update on your application — ${position}`, emailBody) : undefined}
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
      <div className="mx-auto max-w-2xl space-y-4 py-4 bg-transparent">
        <Skeleton className="h-12 w-48 bg-secondary/40 rounded-xl" />
        <Skeleton className="h-64 w-full bg-secondary/40 rounded-xl" />
      </div>
    )
  }

  const { applicant, activeInterview } = data
  const interviewHasPassed = Boolean(activeInterview && new Date(activeInterview.scheduledAt).getTime() <= Date.now())
  const canReview = applicant.status === 'interview_scheduled' && interviewHasPassed

  return (
    <div className="space-y-8 py-4">
      <main className="mx-auto max-w-3xl space-y-8">
        {/* HERO HEADER */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Identity Tile */}
          <Card className="md:col-span-2 p-8 flex flex-col justify-between min-h-[220px]">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">APPLICANT PROFILE</span>
              <h1 className="text-4xl md:text-5xl font-extrabold uppercase tracking-tighter text-foreground">
                {applicant.firstName} {applicant.lastName}
              </h1>
              <p className="text-sm font-semibold text-muted-foreground mt-1 uppercase tracking-widest">
                {applicant.positionAppliedFor || 'NO POSITION SPECIFIED'}
              </p>
            </div>
            <div className="mt-4">
              <ApplicantStatusBadge status={applicant.status} />
            </div>
          </Card>
 
          {/* Action Tiles */}
          <div className="flex flex-col gap-4">
            {/* Back Button */}
            <div
              onClick={() => navigate('/applicants')}
              className="bg-primary/10 text-primary p-6 rounded-2xl flex flex-col justify-between cursor-pointer hover:shadow-glow hover:-translate-y-0.5 active:scale-[0.99] transition-all min-h-[100px]"
            >
              <span className="text-[10px] font-bold tracking-widest text-primary/70 uppercase">NAVIGATION</span>
              <span className="text-2xl font-extrabold uppercase tracking-wide">BACK TO PIPELINE</span>
            </div>
 
            {/* Schedule Interview */}
            {applicant.status === 'pending' && (
              <ScheduleInterviewDialog
                applicantId={applicant._id}
                trigger={
                  <div className="bg-secondary text-secondary-foreground p-6 rounded-2xl flex flex-col justify-between cursor-pointer hover:shadow-glow hover:-translate-y-0.5 active:scale-[0.99] transition-all min-h-[100px]">
                    <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">SCHEDULER</span>
                    <span className="text-2xl font-extrabold uppercase tracking-wide">SCHEDULE INTERVIEW</span>
                  </div>
                }
              />
            )}
 
            {applicant.status === 'interview_scheduled' && !interviewHasPassed && (
              <ScheduleInterviewDialog
                applicantId={applicant._id}
                isReschedule
                trigger={
                  <div className="bg-amber-500/10 text-amber-700 p-6 rounded-2xl flex flex-col justify-between cursor-pointer hover:shadow-glow hover:-translate-y-0.5 active:scale-[0.99] transition-all min-h-[100px]">
                    <span className="text-[10px] font-bold tracking-widest text-amber-700/70 uppercase">INTERVIEW UPCOMING</span>
                    <span className="text-2xl font-extrabold uppercase tracking-wide">RESCHEDULE</span>
                  </div>
                }
              />
            )}
 
            {canReview && !reviewMode && (
              <div
                onClick={() => setReviewMode(true)}
                className="bg-emerald-500/10 text-emerald-700 p-6 rounded-2xl flex flex-col justify-between cursor-pointer hover:shadow-glow hover:-translate-y-0.5 active:scale-[0.99] transition-all min-h-[100px]"
              >
                <span className="text-[10px] font-bold tracking-widest text-emerald-700/70 uppercase">INTERVIEW COMPLETE</span>
                <span className="text-2xl font-extrabold uppercase tracking-wide">REVIEW APPLICANT</span>
              </div>
            )}
 
            {/* Hire/Reject options */}
            {canReview && reviewMode && (
              <>
                <HireDialog
                  applicantId={applicant._id}
                  trigger={
                    <div className="bg-emerald-500/10 text-emerald-700 p-6 rounded-2xl flex flex-col justify-between cursor-pointer hover:shadow-glow hover:-translate-y-0.5 active:scale-[0.99] transition-all min-h-[100px]">
                      <span className="text-[10px] font-bold tracking-widest text-emerald-700/70 uppercase">DECISION</span>
                      <span className="text-2xl font-extrabold uppercase tracking-wide">HIRE APPLICANT</span>
                    </div>
                  }
                />
                <RejectDialog
                  applicantId={applicant._id}
                  trigger={
                    <div className="bg-destructive/10 text-destructive p-6 rounded-2xl flex flex-col justify-between cursor-pointer hover:shadow-glow hover:-translate-y-0.5 active:scale-[0.99] transition-all min-h-[100px]">
                      <span className="text-[10px] font-bold tracking-widest text-destructive/70 uppercase">DECISION</span>
                      <span className="text-2xl font-extrabold uppercase tracking-wide">REJECT APPLICANT</span>
                    </div>
                  }
                />
              </>
            )}
          </div>
        </div>

        {activeInterview && applicant.status === 'interview_scheduled' && (
          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold uppercase tracking-widest border-b border-border/15 pb-3 text-foreground">
              INTERVIEW
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                NOTIFY THE APPLICANT
              </p>
              <InterviewSendButtons applicant={applicant} interview={activeInterview} />
            </div>
          </Card>
        )}

        {/* DETAILS SECTION */}
        <Card className="p-6 space-y-6">
          <h2 className="text-2xl font-bold uppercase tracking-widest border-b border-border/15 pb-3 text-foreground">
            APPLICANT DETAILS
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

          <div className="pt-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">RESUME FILE(S)</p>
            {applicant.resumes && applicant.resumes.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {applicant.resumes.map((resume, i) => (
                  <a
                    key={i}
                    href={resume.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-12 items-center gap-2 rounded-xl bg-secondary/50 px-6 text-sm font-semibold uppercase tracking-wider text-foreground hover:bg-secondary transition-all"
                  >
                    <Download className="size-4" />
                    {resume.originalFilename || `DOWNLOAD RESUME ${i + 1}`}
                  </a>
                ))}
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm text-neutral-500 font-bold uppercase tracking-wider">
                <FileText className="size-4" />
                No resume uploaded
              </p>
            )}
          </div>
        </Card>

        {applicant.status === 'hired' && (
          <Card className="p-6 space-y-6">
            <h2 className="text-2xl font-bold uppercase tracking-widest border-b border-border/15 pb-3 text-foreground">
              HIRE DETAILS
            </h2>
            <div className="grid grid-cols-1 gap-6">
              <Field
                label="Decision date"
                value={applicant.decisionDate ? new Date(applicant.decisionDate).toLocaleDateString() : undefined}
              />
              <Field label="Why they were selected" value={applicant.selectionNotes} />
              {applicant.linkedEmployee && (
                <button
                  onClick={() => navigate(`/employees/${applicant.linkedEmployee}`)}
                  className="w-full md:w-fit h-12 rounded-xl bg-primary text-primary-foreground px-6 text-sm font-semibold uppercase tracking-wider hover:brightness-105 hover:-translate-y-0.5 transition-all shadow-button border-0 cursor-pointer"
                >
                  VIEW EMPLOYEE RECORD
                </button>
              )}
            </div>
            <div className="pt-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                NOTIFY THE APPLICANT
              </p>
              <HireSendButtons applicant={applicant} />
            </div>
          </Card>
        )}

        {applicant.status === 'rejected' && (
          <Card className="p-6 space-y-6">
            <h2 className="text-2xl font-bold uppercase tracking-widest border-b border-border/15 pb-3 text-foreground">
              REJECTION DETAILS
            </h2>
            <div className="grid grid-cols-1 gap-6">
              <Field
                label="Decision date"
                value={applicant.decisionDate ? new Date(applicant.decisionDate).toLocaleDateString() : undefined}
              />
              <Field label="Reason" value={applicant.rejectionReason} />
            </div>
            <div className="pt-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                NOTIFY THE APPLICANT
              </p>
              <RejectSendButtons applicant={applicant} />
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
