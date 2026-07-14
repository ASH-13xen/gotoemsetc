const { USER_ROLES } = require('../config/constants');

// client.assignedEmployees/mainEmployee usually arrive populated (full
// Employee documents, per client.repository.js) rather than raw ObjectIds —
// a populated Mongoose Document's own .toString() is not its _id, so every
// comparison here has to unwrap ._id first or it silently never matches.
function toId(value) {
  if (!value) return null;
  return (value._id || value).toString();
}

// Admins see everything; anyone else needs to actually be assigned to the
// client (as one of assignedEmployees or as mainEmployee) to see its task
// data. Not being assigned still lets you see the client exists (name,
// status) via the normal client list/detail endpoints — this only gates
// task-management specifics.
function canAccessClientTasks(user, client) {
  if (user.role === USER_ROLES.ADMIN) return true;
  if (!user.employeeLink) return false;
  const employeeId = user.employeeLink.toString();

  if (toId(client.mainEmployee) === employeeId) return true;
  return (client.assignedEmployees || []).some((emp) => toId(emp) === employeeId);
}

// For an array of clients — used by cross-client views (dashboard, workload,
// content calendar) to silently filter down to what this user may see,
// rather than 403ing an aggregate endpoint.
function filterAccessibleClients(user, clients) {
  if (user.role === USER_ROLES.ADMIN) return clients;
  return clients.filter((client) => canAccessClientTasks(user, client));
}

module.exports = { canAccessClientTasks, filterAccessibleClients };
