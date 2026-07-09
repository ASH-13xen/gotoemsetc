const ApiError = require('../utils/ApiError');
const { APPLICANT_STATUS, INTERVIEW_STATUS, NOTIFICATION_TYPES } = require('../config/constants');
const interviewRepository = require('../repositories/interview.repository');
const applicantRepository = require('../repositories/applicant.repository');
const userRepository = require('../repositories/user.repository');
const notificationService = require('./notification.service');
const emailService = require('./email.service');
const whatsappService = require('./whatsapp.service');
const { interviewScheduledEmail, formatDateTime } = require('../templates/email/interviewScheduled');

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

async function sendScheduledMessages(applicant, interview) {
  if (applicant.email) {
    const { subject, html } = interviewScheduledEmail({ applicant, scheduledAt: interview.scheduledAt });
    await emailService.sendEmail({ to: applicant.email, subject, html });
  }
  if (applicant.phone) {
    await whatsappService.sendTemplateMessage({
      to: applicant.phone,
      templateName: 'interview_scheduled',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: `${applicant.firstName} ${applicant.lastName || ''}`.trim() },
            { type: 'text', text: applicant.positionAppliedFor || 'the role' },
            { type: 'text', text: formatDateTime(interview.scheduledAt) },
          ],
        },
      ],
    });
  }
}

async function scheduleInterview(applicantId, { scheduledAt, notes }, actingUser) {
  const applicant = await applicantRepository.findById(applicantId);
  if (!applicant) throw ApiError.notFound('Applicant not found');
  if ([APPLICANT_STATUS.HIRED, APPLICANT_STATUS.REJECTED].includes(applicant.status)) {
    throw ApiError.conflict('This applicant has already been decided on');
  }

  const existing = await interviewRepository.findActiveByApplicant(applicantId);
  const interview = existing
    ? await interviewRepository.updateById(existing._id, {
        scheduledAt,
        notes,
        status: INTERVIEW_STATUS.SCHEDULED,
        reminderSentAt: null,
        scheduledBy: actingUser.id,
      })
    : await interviewRepository.create({
        applicant: applicantId,
        scheduledBy: actingUser.id,
        scheduledAt,
        notes,
      });

  const updatedApplicant = await applicantRepository.updateById(applicantId, {
    status: APPLICANT_STATUS.INTERVIEW_SCHEDULED,
  });

  await sendScheduledMessages(updatedApplicant, interview);
  await notifySchedulers(updatedApplicant, interview, actingUser.id);

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
