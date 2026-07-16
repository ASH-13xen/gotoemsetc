const ApiError = require('../utils/ApiError');
const { APPLICANT_STATUS, INTERVIEW_STATUS, NOTIFICATION_TYPES } = require('../config/constants');
const interviewRepository = require('../repositories/interview.repository');
const applicantRepository = require('../repositories/applicant.repository');
const userRepository = require('../repositories/user.repository');
const notificationService = require('./notification.service');
const emailService = require('./email.service');
const env = require('../config/env');
const { formatDateTime } = require('../utils/dateFormat');
const logger = require('../utils/logger');

// In-app notification only — actually telling the applicant is handled
// separately by sendInterviewEmails() (auto email via Resend) and a manual
// "Send WhatsApp" button on the frontend.
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

// Emails the applicant directly, and sends a copy to the HR inbox — via
// Resend, so it goes out automatically with no admin action needed.
async function sendInterviewEmails(applicant, interview) {
  const applicantName = `${applicant.firstName} ${applicant.lastName || ''}`.trim();
  const position = applicant.positionAppliedFor || 'the role';
  const when = formatDateTime(interview.scheduledAt);
  const isReschedule = Boolean(interview.rescheduledAt);
  const isOnline = interview.meetingType === 'online';
  const verb = isReschedule ? 'has been rescheduled to' : 'is scheduled for';
  const modeDetail = isOnline
    ? interview.meetingLink
      ? ` Join here: ${interview.meetingLink}`
      : ' This will be an online interview — the link will follow separately.'
    : interview.location
      ? ` Location: ${interview.location}`
      : ' This will be an in-person interview.';

  const subject = `Interview ${isReschedule ? 'rescheduled' : 'scheduled'} — ${position}`;
  const bodyLine = `Your ${isOnline ? 'online' : 'in-person'} interview for ${position} ${verb} ${when}.${modeDetail}`;

  const sends = [];

  if (applicant.email) {
    sends.push(
      emailService.sendEmail({
        to: applicant.email,
        subject,
        html: `<p>Hi ${applicantName},</p><p>${bodyLine}</p><p>We look forward to speaking with you.</p><p>Thanks,<br/>${env.companyName} HR</p>`,
      })
    );
  }

  if (env.hrNotificationEmail) {
    sends.push(
      emailService.sendEmail({
        to: env.hrNotificationEmail,
        subject: `[Copy] ${subject} — ${applicantName}`,
        html: `<p>${bodyLine}</p><p>Applicant: ${applicantName} (${applicant.email || 'no email on file'}, ${applicant.phone || 'no phone on file'})</p>`,
      })
    );
  }

  const results = await Promise.allSettled(sends);
  for (const result of results) {
    if (result.status === 'rejected') {
      logger.error({ err: result.reason }, 'Interview email send failed');
    }
  }
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
  sendInterviewEmails(updatedApplicant, interview).catch((err) =>
    logger.error({ err }, 'sendInterviewEmails failed')
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
