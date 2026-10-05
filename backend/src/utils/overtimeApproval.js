const {
  OVERTIME_APPROVAL_FROM,
  OVERTIME_REVIEW_THRESHOLD_MINUTES,
  OVERTIME_REQUEST_STATUS,
} = require('../config/constants');

// Days before the go-live date keep the old behaviour: whatever the scans
// work out is the day's overtime, with nobody approving it.
function needsOvertimeApproval(date) {
  return new Date(date).toISOString().slice(0, 10) >= OVERTIME_APPROVAL_FROM;
}

// More than the threshold has to be approved before it counts.
function isAboveReviewThreshold(minutes) {
  return (minutes || 0) > OVERTIME_REVIEW_THRESHOLD_MINUTES;
}

// The overtime that counts for a day given what the scans worked out and the
// day's overtime request (if any): an approved request always wins;
// otherwise biometric overtime up to the threshold counts as it is, and
// anything above it counts for nothing until HR approves.
function countedOvertime(date, biometricMinutes, request) {
  if (!needsOvertimeApproval(date)) return biometricMinutes;
  if (request && request.status === OVERTIME_REQUEST_STATUS.APPROVED) return request.approvedMinutes || 0;
  return isAboveReviewThreshold(biometricMinutes) ? 0 : biometricMinutes;
}

module.exports = { needsOvertimeApproval, isAboveReviewThreshold, countedOvertime };
