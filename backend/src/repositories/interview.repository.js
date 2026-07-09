const Interview = require('../models/Interview');
const { INTERVIEW_STATUS } = require('../config/constants');

function findActiveByApplicant(applicantId) {
  return Interview.findOne({
    applicant: applicantId,
    status: { $ne: INTERVIEW_STATUS.CANCELLED },
  }).sort({ createdAt: -1 });
}

function create(data) {
  return Interview.create(data);
}

function updateById(id, data) {
  return Interview.findByIdAndUpdate(id, data, { new: true, runValidators: true });
}

// Today's still-scheduled interviews that haven't had a reminder sent yet —
// used by the daily reminder cron job.
function findDueForReminder(startOfDay, endOfDay) {
  return Interview.find({
    status: INTERVIEW_STATUS.SCHEDULED,
    scheduledAt: { $gte: startOfDay, $lte: endOfDay },
    reminderSentAt: null,
  }).populate('applicant');
}

module.exports = { findActiveByApplicant, create, updateById, findDueForReminder };
