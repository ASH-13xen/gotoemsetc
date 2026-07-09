const ApiError = require('../utils/ApiError');
const { APPLICANT_STATUS, INTERVIEW_STATUS, NOTIFICATION_TYPES, DELIVERY_STATUS } = require('../config/constants');
const interviewRepository = require('../repositories/interview.repository');
const applicantRepository = require('../repositories/applicant.repository');
const userRepository = require('../repositories/user.repository');
const notificationService = require('./notification.service');
const emailService = require('./email.service');
const whatsappService = require('./whatsapp.service');
const { interviewScheduledEmail, formatDateTime } = require('../templates/email/interviewScheduled');
const { interviewRescheduledEmail } = require('../templates/email/interviewRescheduled');
const logger = require('../utils/logger');

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

// Independent of sendScheduleWhatsapp on purpose — each channel's delivery
// status needs to land in the DB as soon as *that* channel resolves, not
// held up waiting on the other one.
async function sendScheduleEmail(applicant, interview, isReschedule) {
  if (!applicant.email) {
    await interviewRepository.updateById(interview._id, { email: { status: DELIVERY_STATUS.SKIPPED } });
    return;
  }

  const { subject, html } = isReschedule
    ? interviewRescheduledEmail({ applicant, scheduledAt: interview.scheduledAt })
    : interviewScheduledEmail({ applicant, scheduledAt: interview.scheduledAt });
  const result = await emailService.sendEmail({ to: applicant.email, subject, html });

  await interviewRepository.updateById(interview._id, {
    email: result.success
      ? { status: DELIVERY_STATUS.SENT }
      : { status: DELIVERY_STATUS.FAILED, error: result.error },
  });
}

async function sendScheduleWhatsapp(applicant, interview, isReschedule) {
  if (!applicant.phone) {
    await interviewRepository.updateById(interview._id, { whatsapp: { status: DELIVERY_STATUS.SKIPPED } });
    return;
  }

  const result = await whatsappService.sendTemplateMessage({
    to: applicant.phone,
    templateName: isReschedule ? 'interview_rescheduled' : 'interview_scheduled',
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

  await interviewRepository.updateById(interview._id, {
    whatsapp: result.success
      ? { status: DELIVERY_STATUS.SENT }
      : { status: DELIVERY_STATUS.FAILED, error: result.error },
  });
}

async function scheduleInterview(applicantId, { scheduledAt, notes }, actingUser) {
  const applicant = await applicantRepository.findById(applicantId);
  if (!applicant) throw ApiError.notFound('Applicant not found');
  if ([APPLICANT_STATUS.HIRED, APPLICANT_STATUS.REJECTED].includes(applicant.status)) {
    throw ApiError.conflict('This applicant has already been decided on');
  }

  const existing = await interviewRepository.findActiveByApplicant(applicantId);
  const isReschedule = Boolean(existing);
  const pendingDelivery = { status: DELIVERY_STATUS.PENDING };

  const interview = existing
    ? await interviewRepository.updateById(existing._id, {
        scheduledAt,
        notes,
        status: INTERVIEW_STATUS.SCHEDULED,
        reminderSentAt: null,
        scheduledBy: actingUser.id,
        email: pendingDelivery,
        whatsapp: pendingDelivery,
      })
    : await interviewRepository.create({
        applicant: applicantId,
        scheduledBy: actingUser.id,
        scheduledAt,
        notes,
        email: pendingDelivery,
        whatsapp: pendingDelivery,
      });

  const updatedApplicant = await applicantRepository.updateById(applicantId, {
    status: APPLICANT_STATUS.INTERVIEW_SCHEDULED,
  });

  // Fire-and-forget, and independent of each other: the SMTP + WhatsApp
  // round trips can each take several seconds, and the request itself
  // shouldn't hang on either one — the interview record starts at `pending`
  // for both channels (returned in this response) and each flips to
  // sent/failed/skipped on its own once it resolves; the frontend polls for
  // that update.
  sendScheduleEmail(updatedApplicant, interview, isReschedule).catch((err) =>
    logger.error({ err }, 'sendScheduleEmail failed')
  );
  sendScheduleWhatsapp(updatedApplicant, interview, isReschedule).catch((err) =>
    logger.error({ err }, 'sendScheduleWhatsapp failed')
  );
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
