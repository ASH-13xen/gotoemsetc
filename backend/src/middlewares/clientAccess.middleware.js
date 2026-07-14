const ApiError = require('../utils/ApiError');
const clientRepository = require('../repositories/client.repository');
const taskRepository = require('../repositories/task.repository');
const { canAccessClientTasks } = require('../utils/clientAccess');

// Gates any route where :id (or the given param) is a client — used on the
// nested /clients/:id/tasks-family of routes.
function requireClientAccess(paramName = 'id') {
  return async (req, res, next) => {
    try {
      const client = await clientRepository.findById(req.params[paramName]);
      if (!client) return next(ApiError.notFound('Client not found'));
      if (!canAccessClientTasks(req.user, client)) {
        return next(ApiError.forbidden("You're not assigned to this client."));
      }
      req.client = client;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Same check, but starting from a task id — resolves the task's client
// first (used by the top-level /tasks/:id-family of routes).
function requireTaskClientAccess(paramName = 'id') {
  return async (req, res, next) => {
    try {
      const task = await taskRepository.findRaw(req.params[paramName]);
      if (!task) return next(ApiError.notFound('Task not found'));
      const client = await clientRepository.findById(task.client);
      if (!client) return next(ApiError.notFound('Client not found'));
      if (!canAccessClientTasks(req.user, client)) {
        return next(ApiError.forbidden("You're not assigned to this client."));
      }
      req.client = client;
      req.task = task;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireClientAccess, requireTaskClientAccess };
