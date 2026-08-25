const userRepository = require('../repositories/user.repository');

// Shared employee-ref -> User-id resolution for anything that notifies
// people. Was taskNotify.service.js, which also held the old sales CMS
// Task/TaskCycle notification templates — those went with that system, and
// what remained is generic enough that the "task" name was misleading.
function toId(value) {
  if (!value) return null;
  return (value._id || value).toString();
}

// Tolerates a mix of populated Employee documents and raw ObjectIds, and
// silently drops employees who have no login of their own.
async function resolveUserIdsForEmployees(employeeRefs) {
  const unique = [...new Set((employeeRefs || []).map(toId).filter(Boolean))];
  if (unique.length === 0) return [];
  const users = await Promise.all(unique.map((id) => userRepository.findByEmployeeId(id)));
  return users.filter(Boolean).map((u) => u._id);
}

async function resolveAdminUserIds() {
  const admins = await userRepository.findAdmins();
  return admins.map((a) => a._id);
}

module.exports = { resolveUserIdsForEmployees, resolveAdminUserIds };
