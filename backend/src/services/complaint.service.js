const ApiError = require('../utils/ApiError');
const complaintRepository = require('../repositories/complaint.repository');
const employeeRepository = require('../repositories/employee.repository');
const userRepository = require('../repositories/user.repository');
const notificationService = require('./notification.service');
const { NOTIFICATION_TYPES, COMPLAINT_STATUS } = require('../config/constants');

// Any employee files their own complaint (employeeId comes from
// req.user.employeeLink, never trusted from the request body) — notifies
// every admin plus whoever holds the operations_manager role the instant
// it's filed. notifiedAt is set to the same instant since notifying is a
// synchronous side effect of filing, not a separately-triggered step, but
// kept as its own field to match the product spec's distinct workflow box.
async function fileComplaint(employeeId, { category, description }) {
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  const now = new Date();
  const complaint = await complaintRepository.create({
    employee: employeeId,
    category,
    description,
    notifiedAt: now,
  });

  const employeeName = `${employee.firstName} ${employee.lastName || ''}`.trim();
  const [admins, opsManagers] = await Promise.all([
    userRepository.findAdmins(),
    userRepository.findOperationsManagers(),
  ]);
  const recipientIds = [...admins, ...opsManagers].map((u) => u._id);
  await notificationService.createForUsers(recipientIds, {
    type: NOTIFICATION_TYPES.COMPLAINT_FILED,
    title: 'New complaint filed',
    message: `${employeeName} filed a ${category} complaint: ${description}`,
    employee: employeeId,
  });

  return complaint;
}

async function listComplaints({ employeeId, status } = {}) {
  return complaintRepository.list({ employeeId, status });
}

// Operations-only (see requireOperationsAccess). Notifies the filer that
// it's their turn to review — the notification carries the complaint id so
// the review modal can be driven off unread notifications the same way
// PendingWarningsModal/AttendanceOutcomeModal already are.
async function markCompleted(id, completedByUserId) {
  const complaint = await complaintRepository.findById(id);
  if (!complaint) throw ApiError.notFound('Complaint not found');
  if (complaint.status !== COMPLAINT_STATUS.PENDING) {
    throw ApiError.conflict('This complaint has already been marked completed');
  }

  const updated = await complaintRepository.markCompleted(id, completedByUserId);

  const employeeUser = await userRepository.findByEmployeeId(complaint.employee);
  if (employeeUser) {
    await notificationService.createForUsers([employeeUser._id], {
      type: NOTIFICATION_TYPES.COMPLAINT_COMPLETED,
      title: 'Your complaint was resolved',
      message: 'Operations marked your complaint as completed — please rate the speed and quality of the resolution.',
      employee: complaint.employee,
      complaint: updated._id,
    });
  }

  return updated;
}

// Self-only — verified against the complaint's own employee, not trusted
// from the client, same reasoning as attendanceRequest.service.js#acknowledgeRequest.
// Only valid while 'completed': can't review one still pending, and it's
// already been reviewed once (terminal) otherwise.
async function submitFeedback(id, employeeId, { speedRating, qualityRating, comments }) {
  const complaint = await complaintRepository.findById(id);
  if (!complaint) throw ApiError.notFound('Complaint not found');
  if (complaint.employee.toString() !== employeeId) throw ApiError.forbidden();
  if (complaint.status !== COMPLAINT_STATUS.COMPLETED) {
    throw ApiError.conflict('This complaint is not awaiting your review');
  }

  return complaintRepository.submitFeedback(id, { speedRating, qualityRating, comments });
}

module.exports = { fileComplaint, listComplaints, markCompleted, submitFeedback };
