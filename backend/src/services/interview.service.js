const ApiError = require('../utils/ApiError');
const { APPLICANT_STATUS, INTERVIEW_STATUS, NOTIFICATION_TYPES } = require('../config/constants');
const interviewRepository = require('../repositories/interview.repository');
const applicantRepository = require('../repositories/applicant.repository');
const userRepository = require('../repositories/user.repository');
const notificationService = require('./notification.service');
const { formatDateTime } = require('../utils/dateFormat');
const logger = require('../utils/logger');

// In-app notification only — actually telling the applicant (email/WhatsApp)
// is a manual step now: the frontend shows "Send Email"/"Send WhatsApp"
// buttons that open a prefilled Gmail compose window / WhatsApp chat for the
// admin to send themselves, rather than this calling Resend/Meta's APIs.
async function notifySchedulers(applicant, interview, actingUserId) {
  const admins = await userRepository.findAdmins();
  const recipientIds = [actingUserId, ...admins.map((a) => a._id)];
  const applicantName = `${applicant.firstName} ${applicant.lastName || ''}`.trim();
  const when = formatDateTime(interview.scheduledAt);

  await notificationService.createForUsers(recipientIds, {
    type: NOTIFICATION_TYPES.INTERVIEW_SCHEDULED,
    title: 'Interview scheduled',
    message: `Interview with ${applicantName} (${applicant.positionAppliedFor || 'applicant'}) scheduled for ${when}.`,
    applicant: applicant._id,
    interview: interview._id,
  });
}

async function scheduleInterview(applicantId, { scheduledAt, meetingType, location, meetingLink, notes }, actingUser) {
  const applicant = await applicantRepository.findById(applicantId);
  if (!applicant) throw ApiError.notFound('Applicant not found');
  if ([APPLICANT_STATUS.HIRED, APPLICANT_STATUS.REJECTED].includes(applicant.status)) {
    throw ApiError.conflict('This applicant has already been decided on');
  }

  const existing = await interviewRepository.findActiveByApplicant(applicantId);

  const interview = existing
    ? await interviewRepository.updateById(existing._id, {
        scheduledAt,
        meetingType,
        location,
        meetingLink,
        notes,
        status: INTERVIEW_STATUS.SCHEDULED,
        reminderSentAt: null,
        scheduledBy: actingUser.id,
        rescheduledAt: new Date(),
      })
    : await interviewRepository.create({
        applicant: applicantId,
        scheduledBy: actingUser.id,
        scheduledAt,
        meetingType,
        location,
        meetingLink,
        notes,
      });

  const updatedApplicant = await applicantRepository.updateById(applicantId, {
    status: APPLICANT_STATUS.INTERVIEW_SCHEDULED,
  });

  notifySchedulers(updatedApplicant, interview, actingUser.id).catch((err) =>
    logger.error({ err }, 'notifySchedulers failed')
  );

  return { applicant: updatedApplicant, interview };
}

async function cancelInterview(applicantId, interviewId) {
  const interview = await interviewRepository.updateById(interviewId, {
    status: INTERVIEW_STATUS.CANCELLED,
  });
  if (!interview) throw ApiError.notFound('Interview not found');

  const applicant = await applicantRepository.updateById(applicantId, {
    status: APPLICANT_STATUS.PENDING,
  });

  return { applicant, interview };
}

module.exports = { scheduleInterview, cancelInterview };
