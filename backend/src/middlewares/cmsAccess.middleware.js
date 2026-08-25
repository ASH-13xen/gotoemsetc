const ApiError = require('../utils/ApiError');
const cmsAccess = require('../utils/cmsAccess');
const taskAccess = require('../utils/taskAccess');
const taskClientRepository = require('../repositories/taskClient.repository');
const clientCalendarRepository = require('../repositories/clientCalendar.repository');

// Write access to client records, plans, and calendars: admin/sales via
// isCmsAdmin, plus HR and manage_tasks holders via the pre-existing Task
// Management grant (the client registry was theirs before the CMS existed,
// and taking it away would be a regression for them).
//
// Note this is NOT the gate for scheduling content — that's narrower and
// per-team, see requireCanScheduleForCalendar below.
function requireCmsWrite(message) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (cmsAccess.isCmsAdmin(req.user) || taskAccess.hasFullTaskAccess(req.user)) return next();
    return next(ApiError.forbidden(message || 'You don\'t have permission to change client records.'));
  };
}

// Reads are open to every logged-in employee; which clients they actually
// get back is narrowed per-user by the service layer's visibility scoping,
// not here — a flat 403 would wrongly lock out an employee who legitimately
// sees a subset.
function requireCmsRead() {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    return next();
  };
}

// Loads the :calendarId ClientCalendar and checks the acting user may
// schedule/assign on it — CMS admins anywhere, a team leader only on their
// own team's calendar. Mirrors taskAccess.middleware.js's load-then-predicate
// shape so both read the same way.
function requireCanScheduleForCalendar(paramName = 'calendarId') {
  return async (req, res, next) => {
    try {
      const calendar = await clientCalendarRepository.findById(req.params[paramName]);
      if (!calendar) return next(ApiError.notFound('Calendar not found'));

      if (!cmsAccess.canScheduleForTeam(req.user, calendar.team)) {
        return next(ApiError.forbidden('You don\'t have permission to schedule for this client.'));
      }

      req.calendar = calendar;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Loads the :id TaskClient so downstream handlers don't re-fetch it.
function loadClient(paramName = 'id') {
  return async (req, res, next) => {
    try {
      const client = await taskClientRepository.findById(req.params[paramName]);
      if (!client) return next(ApiError.notFound('Client not found'));
      req.client = client;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  requireCmsWrite,
  requireCmsRead,
  requireCanScheduleForCalendar,
  loadClient,
};
