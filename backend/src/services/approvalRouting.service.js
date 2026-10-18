const logger = require('../utils/logger');
const AttendanceModificationRequest = require('../models/AttendanceModificationRequest');
const OvertimeRequest = require('../models/OvertimeRequest');
const Employee = require('../models/Employee');
const userRepository = require('../repositories/user.repository');
const notificationService = require('./notification.service');
const notifyRecipients = require('./notifyRecipients.service');
const orgTeams = require('./orgTeams.service');
const {
  ATTENDANCE_REQUEST_STATUS,
  ATTENDANCE_REQUEST_APPROVAL_STAGE,
  OVERTIME_REQUEST_STATUS,
  OVERTIME_REQUEST_STAGE,
  NOTIFICATION_TYPES,
} = require('../config/constants');

// ---------------------------------------------------------------------------
// Leave applications, modification requests and overtime all go to the
// applicant's content manager first, then HR (unpaid leave then the CEO).
// Who the content manager is follows the Organisation chart *as it is now*,
// not as it was when the request was made:
//   * waiting for a content manager, but there no longer is one who can act
//     (box emptied, person left, applicant became a CM) → moves on to HR;
//   * with HR without ever having had a content manager's approval, but the
//     applicant now has one → goes back to the content manager first.
// Run after every Organisation chart change, before anyone lists or acts on
// these requests, and once at start-up. Requests at the CEO step, or already
// passed on by a content manager, are never moved.
// ---------------------------------------------------------------------------

const AR = { ...ATTENDANCE_REQUEST_APPROVAL_STAGE };
const OT = { ...OVERTIME_REQUEST_STAGE };
const idOf = (v) => (v ? String(v._id || v) : null);
const nameOf = (e) => (e ? `${e.firstName} ${e.lastName || ''}`.trim() : 'An employee');
const dayOf = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const isLeave = (r) => Boolean(r.requestedStatus || r.requestedEarlyDeparture || r.requestedMultiDayLeave);
const kindOf = (r) => (isLeave(r) ? 'leave application' : 'attendance modification request');

async function tellContentManagers(cmIds, { type, title, message, employee }) {
  const users = await notifyRecipients.resolveUserIdsForEmployees(cmIds);
  if (users.length) await notificationService.createForUsers(users, { type, title, message, employee });
}

async function tellHr({ type, title, message, employee }) {
  const hr = await userRepository.findHr();
  if (hr.length) await notificationService.createForUsers(hr.map((u) => u._id), { type, title, message, employee });
}

// Where one pending leave/modification request belongs right now: the stage
// it should be at and, for the content manager step, who.
async function routeFor(request) {
  const cmIds = await orgTeams.contentManagersFor(request.employee);
  if (request.approvalStage === AR.CONTENT_MANAGER) return cmIds.length ? null : { stage: AR.HR, cmIds };
  if (request.approvalStage === AR.HR && !request.cmApprovedBy && cmIds.length) return { stage: AR.CONTENT_MANAGER, cmIds };
  return null;
}

async function moveAttendanceRequest(request, route, employee) {
  await AttendanceModificationRequest.updateOne(
    { _id: request._id, status: ATTENDANCE_REQUEST_STATUS.PENDING, approvalStage: request.approvalStage },
    { $set: { approvalStage: route.stage } }
  );
  const who = nameOf(employee);
  if (route.stage === AR.CONTENT_MANAGER) {
    await tellContentManagers(route.cmIds, {
      type: NOTIFICATION_TYPES.LEAVE_APPLICATION_PENDING_CM_REVIEW,
      title: `${isLeave(request) ? 'Leave application' : 'Modification request'} needs your review`,
      message: `${who}'s ${kindOf(request)} for ${dayOf(request.date)} needs your approval before it goes to HR: ${request.reason}`,
      employee: request.employee,
    });
  } else {
    await tellHr({
      type: NOTIFICATION_TYPES.ATTENDANCE_MODIFICATION_REQUESTED,
      title: `${isLeave(request) ? 'Leave application' : 'Modification request'} needs HR review`,
      message: `${who}'s ${kindOf(request)} for ${dayOf(request.date)} has no content manager to review it now, so it is with HR.`,
      employee: request.employee,
    });
  }
}

// Checks one leave/modification request just before someone acts on it.
// Returns the new stage when it had to move, else null.
async function rerouteAttendanceRequest(request) {
  if (request.status !== ATTENDANCE_REQUEST_STATUS.PENDING) return null;
  const route = await routeFor(request);
  if (!route) return null;
  const employee = await Employee.findById(request.employee).select('firstName lastName').lean();
  await moveAttendanceRequest(request, route, employee);
  return route.stage;
}

async function routeForOvertime(request) {
  const cmIds = await orgTeams.contentManagersFor(request.employee);
  if (request.stage === OT.CONTENT_MANAGER) return cmIds.length ? null : { stage: OT.HR, cmIds };
  if (request.stage === OT.HR && !request.cmApprovedBy && cmIds.length) return { stage: OT.CONTENT_MANAGER, cmIds };
  return null;
}

async function moveOvertime(request, route, employee) {
  await OvertimeRequest.updateOne(
    { _id: request._id, status: OVERTIME_REQUEST_STATUS.PENDING, stage: request.stage },
    { $set: { stage: route.stage } }
  );
  const who = nameOf(employee);
  if (route.stage === OT.CONTENT_MANAGER) {
    await tellContentManagers(route.cmIds, {
      type: NOTIFICATION_TYPES.OVERTIME_PENDING_CM_REVIEW,
      title: 'Overtime needs your review',
      message: `${who} — ${dayOf(request.date)}: overtime needs your approval before it goes to HR.`,
      employee: request.employee,
    });
  } else {
    await tellHr({
      type: NOTIFICATION_TYPES.OVERTIME_PENDING_HR_REVIEW,
      title: 'Overtime needs HR approval',
      message: `${who} — ${dayOf(request.date)}: there is no content manager to review it now, so it is with HR.`,
      employee: request.employee,
    });
  }
}

async function rerouteOvertime(request) {
  if (request.status !== OVERTIME_REQUEST_STATUS.PENDING) return null;
  const route = await routeForOvertime(request);
  if (!route) return null;
  const employee = await Employee.findById(request.employee?._id || request.employee).select('firstName lastName').lean();
  await moveOvertime(request, route, employee);
  return route.stage;
}

// Every pending request, checked. Cheap enough to run often (one chart read
// per applicant), throttled unless forced.
let lastRun = 0;
let running = null;
async function rerouteAll({ force = false } = {}) {
  if (running) return running;
  if (!force && Date.now() - lastRun < 60 * 1000) return { moved: 0 };
  lastRun = Date.now();
  running = (async () => {
    let moved = 0;
    const [requests, overtime] = await Promise.all([
      AttendanceModificationRequest.find({
        status: ATTENDANCE_REQUEST_STATUS.PENDING,
        approvalStage: { $in: [AR.CONTENT_MANAGER, AR.HR] },
      }).lean(),
      OvertimeRequest.find({ status: OVERTIME_REQUEST_STATUS.PENDING }).lean(),
    ]);
    const employees = await Employee.find({ _id: { $in: [...requests, ...overtime].map((r) => r.employee) } })
      .select('firstName lastName status isDeleted')
      .lean();
    const byId = new Map(employees.map((e) => [idOf(e._id), e]));
    for (const r of requests) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const route = await routeFor(r);
        // eslint-disable-next-line no-await-in-loop
        if (route) await moveAttendanceRequest(r, route, byId.get(idOf(r.employee)));
        if (route) moved += 1;
      } catch (err) {
        logger.error({ err, request: idOf(r._id) }, 'Could not re-route an attendance request');
      }
    }
    for (const r of overtime) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const route = await routeForOvertime(r);
        // eslint-disable-next-line no-await-in-loop
        if (route) await moveOvertime(r, route, byId.get(idOf(r.employee)));
        if (route) moved += 1;
      } catch (err) {
        logger.error({ err, request: idOf(r._id) }, 'Could not re-route an overtime request');
      }
    }
    if (moved) logger.info({ moved }, 'Approval requests re-routed to follow the Organisation chart');
    return { moved };
  })();
  try {
    return await running;
  } finally {
    running = null;
  }
}

module.exports = { rerouteAll, rerouteAttendanceRequest, rerouteOvertime, isLeave };
