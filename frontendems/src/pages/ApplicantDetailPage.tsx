import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Download, FileText } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
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
    <div className="border-b-2 border-neutral-200 pb-3">
      <p className="text-xs font-black uppercase tracking-widest text-neutral-500">{label}</p>
      <p className="text-lg font-bold text-neutral-900 mt-1 uppercase tracking-wide">{value || '—'}</p>
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

  const emailBody = `Hi ${name},\n\nYour ${isOnline ? 'online' : 'in-person'} interview for ${position} ${verb} ${when}.${modeDetail}\n\nWe look forward to speaking with you.\n\nThanks,\n${companyName} HR`
  const whatsappText = `Hi ${name}, your ${isOnline ? 'online' : 'in-person'} interview for ${position} ${verb} ${when}.${modeDetail}`
  const subject = `Interview ${isReschedule ? 'rescheduled' : 'scheduled'} — ${position}`

  return (
    <ManualSendButtons
      emailHref={applicant.email ? buildGmailComposeUrl(applicant.email, subject, emailBody) : undefined}
      whatsappHref={applicant.phone ? buildWhatsappUrl(applicant.phone, whatsappText) : undefined}
    />
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
      <div className="mx-auto max-w-2xl space-y-4 p-6 bg-white">
        <Skeleton className="h-12 w-48 bg-neutral-200 rounded-none" />
        <Skeleton className="h-64 w-full bg-neutral-200 rounded-none" />
      </div>
    )
  }

  const { applicant, activeInterview } = data
  const interviewHasPassed = Boolean(activeInterview && new Date(activeInterview.scheduledAt).getTime() <= Date.now())
  const canReview = applicant.status === 'interview_scheduled' && interviewHasPassed

  return (
    <div className="min-h-screen bg-white text-neutral-900 p-6">
      <main className="mx-auto max-w-3xl space-y-8">
        {/* HERO HEADER */}
        <div className="grid grid-cols-1 md:grid-cols-3 border-2 border-neutral-900 bg-white">
          {/* Identity Tile */}
          <div className="md:col-span-2 border-b-2 md:border-b-0 md:border-r-2 border-neutral-900 p-8 flex flex-col justify-between min-h-55">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-black tracking-widest text-neutral-500 uppercase">APPLICANT PROFILE</span>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-neutral-900">
                {applicant.firstName} {applicant.lastName}
              </h1>
              <p className="text-sm font-bold text-neutral-500 mt-1 uppercase tracking-widest">
                {applicant.positionAppliedFor || 'NO POSITION SPECIFIED'}
              </p>
            </div>
            <div className="mt-4 flex gap-2">
              <ApplicantStatusBadge status={applicant.status} />
            </div>
          </div>

          {/* Action Tiles */}
          <div className="grid grid-cols-1 divide-y-2 divide-neutral-900">
            {/* Back Button */}
            <div
              onClick={() => navigate('/applicants')}
              className="bg-primary text-white p-6 flex flex-col justify-between cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all min-h-25"
            >
              <span className="text-xs font-black tracking-widest opacity-80 uppercase">NAVIGATION</span>
              <span className="text-2xl font-extrabold uppercase tracking-wide">BACK TO LIST</span>
            </div>

            {applicant.status === 'pending' && (
              <ScheduleInterviewDialog
                applicantId={applicant._id}
                trigger={
                  <div className="bg-amber-600 text-white p-6 flex flex-col justify-between cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all min-h-25">
                    <span className="text-xs font-black tracking-widest opacity-80 uppercase">NEXT STEP</span>
                    <span className="text-2xl font-extrabold uppercase tracking-wide">SCHEDULE MEETING</span>
                  </div>
                }
              />
            )}

            {applicant.status === 'interview_scheduled' && !interviewHasPassed && (
              <ScheduleInterviewDialog
                applicantId={applicant._id}
                isReschedule
                trigger={
                  <div className="bg-amber-600 text-white p-6 flex flex-col justify-between cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all min-h-25">
                    <span className="text-xs font-black tracking-widest opacity-80 uppercase">INTERVIEW UPCOMING</span>
                    <span className="text-2xl font-extrabold uppercase tracking-wide">RESCHEDULE</span>
                  </div>
                }
              />
            )}

            {canReview && !reviewMode && (
              <div
                onClick={() => setReviewMode(true)}
                className="bg-emerald-700 text-white p-6 flex flex-col justify-between cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all min-h-25"
              >
                <span className="text-xs font-black tracking-widest opacity-80 uppercase">INTERVIEW COMPLETE</span>
                <span className="text-2xl font-extrabold uppercase tracking-wide">REVIEW APPLICANT</span>
              </div>
            )}

            {canReview && reviewMode && (
              <>
                <HireDialog
                  applicantId={applicant._id}
                  trigger={
                    <div className="bg-emerald-600 text-white p-6 flex flex-col justify-between cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all min-h-25">
                      <span className="text-xs font-black tracking-widest opacity-80 uppercase">DECISION</span>
                      <span className="text-2xl font-extrabold uppercase tracking-wide">HIRE TALENT</span>
                    </div>
                  }
                />
                <RejectDialog
                  applicantId={applicant._id}
                  trigger={
                    <div className="bg-red-600 text-white p-6 flex flex-col justify-between cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all min-h-25">
                      <span className="text-xs font-black tracking-widest opacity-80 uppercase">DECISION</span>
                      <span className="text-2xl font-extrabold uppercase tracking-wide">REJECT APPLICANT</span>
                    </div>
                  }
                />
              </>
            )}
          </div>
        </div>

        {activeInterview && applicant.status === 'interview_scheduled' && (
          <div className="border-2 border-neutral-900 bg-white p-6 space-y-4">
            <h2 className="text-2xl font-black uppercase tracking-widest border-b-2 border-neutral-900 pb-3 text-neutral-900">
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
              <p className="text-xs font-black uppercase tracking-widest text-neutral-500 mb-2">
                NOTIFY THE APPLICANT
              </p>
              <InterviewSendButtons applicant={applicant} interview={activeInterview} />
            </div>
          </div>
        )}

        {/* DETAILS SECTION */}
        <div className="border-2 border-neutral-900 bg-white p-6 space-y-6">
          <h2 className="text-2xl font-black uppercase tracking-widest border-b-2 border-neutral-900 pb-3 text-neutral-900">
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
            <p className="text-xs font-black uppercase tracking-widest text-neutral-500 mb-2">RESUME FILE(S)</p>
            {applicant.resumes && applicant.resumes.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {applicant.resumes.map((resume, i) => (
                  <a
                    key={i}
                    href={resume.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-14 items-center gap-2 border-2 border-neutral-900 bg-transparent px-6 font-bold uppercase tracking-wider text-neutral-900 hover:bg-neutral-900 hover:text-white transition-colors"
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
        </div>

        {applicant.status === 'hired' && (
          <div className="border-2 border-neutral-900 bg-white p-6 space-y-6">
            <h2 className="text-2xl font-black uppercase tracking-widest border-b-2 border-neutral-900 pb-3 text-neutral-900">
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
                  className="w-full md:w-fit h-14 border-2 border-neutral-900 bg-primary text-white px-6 font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
                >
                  VIEW EMPLOYEE RECORD
                </button>
              )}
            </div>
            <div className="pt-2">
              <p className="text-xs font-black uppercase tracking-widest text-neutral-500 mb-2">
                NOTIFY THE APPLICANT
              </p>
              <HireSendButtons applicant={applicant} />
            </div>
          </div>
        )}

        {applicant.status === 'rejected' && (
          <div className="border-2 border-neutral-900 bg-white p-6 space-y-6">
            <h2 className="text-2xl font-black uppercase tracking-widest border-b-2 border-neutral-900 pb-3 text-neutral-900">
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
              <p className="text-xs font-black uppercase tracking-widest text-neutral-500 mb-2">
                NOTIFY THE APPLICANT
              </p>
              <RejectSendButtons applicant={applicant} />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
