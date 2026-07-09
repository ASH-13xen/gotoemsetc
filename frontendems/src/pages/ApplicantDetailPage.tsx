import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Download, FileText } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { ApplicantStatusBadge } from '@/components/applicants/ApplicantStatusBadge'
import { HireDialog } from '@/components/applicants/HireDialog'
import { RejectDialog } from '@/components/applicants/RejectDialog'
import { ScheduleInterviewDialog } from '@/components/applicants/ScheduleInterviewDialog'
import { useApplicant } from '@/hooks/useApplicants'

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="border-b-2 border-neutral-900 pb-3">
      <p className="text-xs font-black uppercase tracking-widest text-neutral-400">{label}</p>
      <p className="text-lg font-bold text-white mt-1 uppercase tracking-wide">{value || '—'}</p>
    </div>
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
      <div className="mx-auto max-w-2xl space-y-4 p-6 bg-black">
        <Skeleton className="h-12 w-48 bg-neutral-800 rounded-none" />
        <Skeleton className="h-64 w-full bg-neutral-800 rounded-none" />
      </div>
    )
  }

  const { applicant, activeInterview } = data
  const interviewHasPassed = Boolean(activeInterview && new Date(activeInterview.scheduledAt).getTime() <= Date.now())
  const canReview = applicant.status === 'interview_scheduled' && interviewHasPassed

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <main className="mx-auto max-w-3xl space-y-8">
        {/* HERO HEADER */}
        <div className="grid grid-cols-1 md:grid-cols-3 border-2 border-white bg-black">
          {/* Identity Tile */}
          <div className="md:col-span-2 border-b-2 md:border-b-0 md:border-r-2 border-white p-8 flex flex-col justify-between min-h-55">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-black tracking-widest text-neutral-400 uppercase">APPLICANT PROFILE</span>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white">
                {applicant.firstName} {applicant.lastName}
              </h1>
              <p className="text-sm font-bold text-neutral-400 mt-1 uppercase tracking-widest">
                {applicant.positionAppliedFor || 'NO POSITION SPECIFIED'}
              </p>
            </div>
            <div className="mt-4 flex gap-2">
              <ApplicantStatusBadge status={applicant.status} />
            </div>
          </div>

          {/* Action Tiles */}
          <div className="grid grid-cols-1 divide-y-2 divide-white">
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
          <div className="border-2 border-white bg-black p-6 space-y-4">
            <h2 className="text-2xl font-black uppercase tracking-widest border-b-2 border-white pb-3 text-white">
              INTERVIEW
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field
                label={interviewHasPassed ? 'Was scheduled for' : 'Scheduled for'}
                value={new Date(activeInterview.scheduledAt).toLocaleString()}
              />
              <Field label="Notes" value={activeInterview.notes} />
            </div>
          </div>
        )}

        {/* DETAILS SECTION */}
        <div className="border-2 border-white bg-black p-6 space-y-6">
          <h2 className="text-2xl font-black uppercase tracking-widest border-b-2 border-white pb-3 text-white">
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
            <p className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-2">RESUME FILE(S)</p>
            {applicant.resumes && applicant.resumes.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {applicant.resumes.map((resume, i) => (
                  <a
                    key={i}
                    href={resume.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-14 items-center gap-2 border-2 border-white bg-transparent px-6 font-bold uppercase tracking-wider text-white hover:bg-white hover:text-black transition-colors"
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
          <div className="border-2 border-white bg-black p-6 space-y-6">
            <h2 className="text-2xl font-black uppercase tracking-widest border-b-2 border-white pb-3 text-white">
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
                  className="w-full md:w-fit h-14 border-2 border-white bg-primary text-white px-6 font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
                >
                  VIEW EMPLOYEE RECORD
                </button>
              )}
            </div>
          </div>
        )}

        {applicant.status === 'rejected' && (
          <div className="border-2 border-white bg-black p-6 space-y-6">
            <h2 className="text-2xl font-black uppercase tracking-widest border-b-2 border-white pb-3 text-white">
              REJECTION DETAILS
            </h2>
            <div className="grid grid-cols-1 gap-6">
              <Field
                label="Decision date"
                value={applicant.decisionDate ? new Date(applicant.decisionDate).toLocaleDateString() : undefined}
              />
              <Field label="Reason" value={applicant.rejectionReason} />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
