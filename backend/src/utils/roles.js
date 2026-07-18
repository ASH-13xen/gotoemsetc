const { USER_ROLES } = require('../config/constants');

// HR is admin-equivalent everywhere except attendance-edit age, which is
// enforced separately (see attendance.service.js#assertCanEditAttendanceDate).
// Single source of truth so every admin-only check in the codebase extends
// to HR consistently rather than drifting file by file.
function isAdminLike(user) {
  return Boolean(user) && (user.role === USER_ROLES.ADMIN || user.role === USER_ROLES.HR);
}

module.exports = { isAdminLike };
