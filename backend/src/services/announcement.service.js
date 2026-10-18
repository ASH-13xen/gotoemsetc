const ApiError = require('../utils/ApiError');
const announcementRepository = require('../repositories/announcement.repository');
const employeeRepository = require('../repositories/employee.repository');

// sendToAll resolves against every currently-active employee at creation
// time; employeeIds is used as-is otherwise (deduped). Either way the result
// is a snapshot — see Announcement.js's comment on `recipients`.
async function resolveRecipients({ sendToAll, employeeIds }) {
  if (sendToAll) {
    const employees = await employeeRepository.listActive();
    return employees.map((e) => e._id);
  }
  return [...new Set(employeeIds || [])];
}

async function createAnnouncement({ title, message, sendToAll, employeeIds }, createdByUserId) {
  const recipients = await resolveRecipients({ sendToAll, employeeIds });
  if (recipients.length === 0) {
    throw ApiError.badRequest('Select at least one employee, or send to everyone');
  }
  return announcementRepository.create({ title, message, createdBy: createdByUserId, recipients });
}

// Admin-side management view, with ack progress per announcement so it's
// visible at a glance who's still outstanding.
async function listAllAnnouncements() {
  const announcements = await announcementRepository.listAll();
  return announcements.map((a) => ({
    _id: a._id,
    title: a.title,
    message: a.message,
    createdBy: a.createdBy,
    createdAt: a.createdAt,
    recipients: a.recipients,
    acknowledgedCount: a.acknowledgedBy.length,
    totalRecipients: a.recipients.length,
  }));
}

// Self-scoped — returns [] for an account with no linked employee record
// (e.g. a pure admin/HR login), same convention as the other "pending for
// me" modals (PendingWarningsModal, ComplaintReviewModal).
// Each carries `later` — whether this employee put it aside — so the
// Announcements button can count everything but only open for new ones.
async function listPendingForEmployee(employeeId) {
  if (!employeeId) return [];
  const pending = await announcementRepository.listPendingForEmployee(employeeId);
  return pending.map((a) => ({
    _id: a._id,
    title: a.title,
    message: a.message,
    kind: a.kind || 'general',
    flagColor: a.flagColor || null,
    createdAt: a.createdAt,
    later: (a.laterBy || []).some((l) => String(l.employee) === String(employeeId)),
  }));
}

async function seeLater(id, employeeId) {
  const announcement = await announcementRepository.findById(id);
  if (!announcement) throw ApiError.notFound('Announcement not found');
  if (!announcement.recipients.some((r) => r.toString() === employeeId)) {
    throw ApiError.forbidden('This announcement was not sent to you');
  }
  return (await announcementRepository.markLater(id, employeeId)) || announcement;
}

// The notice someone gets when they receive a performance flag — colour and
// note only; who gave it stays in the flag history for the CEO and admin.
async function announceFlag(employeeId, { color, note }, createdByUserId) {
  return announcementRepository.create({
    title: color === 'red' ? 'You received a red flag' : 'You received a green flag',
    message: note?.trim() || (color === 'red' ? 'A red performance flag was added to your record.' : 'A green performance flag was added to your record — well done!'),
    createdBy: createdByUserId,
    recipients: [employeeId],
    kind: 'performance_flag',
    flagColor: color,
  });
}

// Idempotent — acknowledging twice (e.g. a double click) is a no-op the
// second time rather than an error.
async function acknowledgeAnnouncement(id, employeeId) {
  const announcement = await announcementRepository.findById(id);
  if (!announcement) throw ApiError.notFound('Announcement not found');
  if (!announcement.recipients.some((r) => r.toString() === employeeId)) {
    throw ApiError.forbidden('This announcement was not sent to you');
  }
  return announcementRepository.addAcknowledgement(id, employeeId);
}

module.exports = { createAnnouncement, listAllAnnouncements, listPendingForEmployee, acknowledgeAnnouncement, seeLater, announceFlag };
