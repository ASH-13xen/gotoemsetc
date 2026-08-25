const employeeRepository = require('../repositories/employee.repository');
const counterRepository = require('../repositories/counter.repository');
const userRepository = require('../repositories/user.repository');
const activityService = require('./activity.service');
const notificationService = require('./notification.service');
const ApiError = require('../utils/ApiError');
const { isAdminLike } = require('../utils/roles');
const { NOTIFICATION_TYPES } = require('../config/constants');

async function listEmployees(params) {
  return employeeRepository.list(params);
}

async function getEmployee(id) {
  const employee = await employeeRepository.findById(id);
  if (!employee) throw ApiError.notFound('Employee not found');
  return employee;
}

// Same active-employee source the attendance classifier cron reads from —
// reshaped down to just enough for a "pick a colleague" list. Deliberately
// separate from listEmployees(), which is gated behind directory-access
// permissions most plain workers don't have; Task Management needs every
// employee to browse this to assign tasks/subtasks, so it stays open to
// any authenticated user (see employee.routes.js) and only ever exposes
// these few non-sensitive fields.
async function listDirectory() {
  const employees = await employeeRepository.listActive();
  return employees.map((e) => ({
    _id: e._id,
    firstName: e.firstName,
    lastName: e.lastName,
    designation: e.designation,
    employeeCode: e.employeeCode,
  }));
}

// Same active-employee-with-dob source the birthday reminder cron reads
// from — reshaped down to just what a calendar view needs, not the full
// employee document.
async function listBirthdays() {
  const employees = await employeeRepository.listAllWithDob();
  return employees.map((e) => ({
    _id: e._id,
    firstName: e.firstName,
    lastName: e.lastName,
    employeeCode: e.employeeCode,
    dob: e.dob,
  }));
}

// Every new employee starts with these two placeholder rows in Extra
// Details — HR fills the actual values in manually once the company
// mailbox is set up, rather than leaving the section empty with no hint
// that it's still outstanding.
const DEFAULT_EXTRA_DETAILS = [
  { key: 'COMPANY MAIL ID', value: '' },
  { key: 'COMPANY MAIL PASSWORD', value: '' },
];

async function createEmployee(data) {
  // Plain incrementing number, starting at 1001 — see
  // scripts/seedEmployeeCounter.js, which seeds the counter to 1000 so the
  // first call here returns 1001. Doubles as the biometric device PIN,
  // editable afterward via updateEmployee (admin/HR only) to match whatever
  // PIN actually gets set on the physical device.
  const seq = await counterRepository.nextSequence('employeeCode');
  const employeeCode = String(seq);
  const extraDetails = data.extraDetails?.length ? data.extraDetails : DEFAULT_EXTRA_DETAILS;
  const employee = await employeeRepository.create({ ...data, employeeCode, extraDetails });
  await activityService.log(employee._id, 'EMPLOYEE_CREATED', { employeeCode });
  return employee;
}

async function updateEmployee(id, data, actingUserRole) {
  // employeeCode (the biometric device PIN) is admin/HR-only — silently
  // dropped for anyone else rather than erroring, so the rest of a
  // non-admin's edit still goes through.
  const payload = isAdminLike({ role: actingUserRole }) ? data : { ...data, employeeCode: undefined };
  const employee = await employeeRepository.updateById(id, payload);
  if (!employee) throw ApiError.notFound('Employee not found');
  await activityService.log(employee._id, 'EMPLOYEE_UPDATED', { fields: Object.keys(payload) });
  return employee;
}

async function deleteEmployee(id) {
  const employee = await employeeRepository.softDeleteById(id);
  if (!employee) throw ApiError.notFound('Employee not found');
  await activityService.log(employee._id, 'EMPLOYEE_REMOVED', {});
  return employee;
}

// Simple milestone gamification, per the product ask — checked against the
// exact running total after this flag (not "every 3rd"), so each tier fires
// once. Red has one tier (3 — poor performance); green has three (3, 6, 10),
// each a different message. Best-effort: notification failures never block
// the flag itself from being recorded.
async function notifyFlagMilestone(employee, color) {
  const count = employee.flags.filter((f) => f.color === color).length;
  const employeeName = `${employee.firstName} ${employee.lastName || ''}`.trim();

  let message = null;
  if (color === 'red' && count === 3) {
    message = `${employeeName} has reached 3 red flags — poor performance pattern, please review.`;
  } else if (color === 'green' && count === 3) {
    message = `${employeeName} has reached 3 green flags — consistently good performance.`;
  } else if (color === 'green' && count === 6) {
    message = `${employeeName} has reached 6 green flags — time to award the employee.`;
  } else if (color === 'green' && count === 10) {
    message = `${employeeName} has reached 10 green flags — time to reward the employee.`;
  }
  if (!message) return;

  const [hrUsers, ceoUsers] = await Promise.all([userRepository.findHr(), userRepository.findCeos()]);
  const recipientIds = [...new Set([...hrUsers, ...ceoUsers].map((u) => u._id.toString()))];
  if (recipientIds.length === 0) return;

  await notificationService.createForUsers(recipientIds, {
    type: color === 'red' ? NOTIFICATION_TYPES.EMPLOYEE_RED_FLAG_MILESTONE : NOTIFICATION_TYPES.EMPLOYEE_GREEN_FLAG_MILESTONE,
    title: color === 'red' ? 'Performance concern' : 'Performance milestone',
    message,
    employee: employee._id,
  });
}

async function addFlag(id, { color, note, date }, addedBy) {
  const employee = await employeeRepository.addFlag(id, { color, note, date, addedBy });
  if (!employee) throw ApiError.notFound('Employee not found');
  await activityService.log(employee._id, 'EMPLOYEE_FLAG_ADDED', { color, note, date });
  await notifyFlagMilestone(employee, color).catch(() => {});
  return employee;
}

// Flattened across every employee, most recent first — backs frontendall's
// Performance Flags history section (see routes/employee.routes.js's
// GET /flags/history, gated the same as HR Work).
async function getFlagHistory() {
  const employees = await employeeRepository.listAllForFlagHistory();
  const entries = [];
  for (const employee of employees) {
    for (const flag of employee.flags) {
      entries.push({
        _id: flag._id,
        employeeId: employee._id,
        employeeName: `${employee.firstName} ${employee.lastName || ''}`.trim(),
        employeeCode: employee.employeeCode,
        color: flag.color,
        note: flag.note,
        date: flag.date,
      });
    }
  }
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return entries;
}

async function removeFlag(id, flagId) {
  const employee = await employeeRepository.removeFlag(id, flagId);
  if (!employee) throw ApiError.notFound('Employee not found');
  await activityService.log(employee._id, 'EMPLOYEE_FLAG_REMOVED', { flagId });
  return employee;
}

module.exports = {
  listEmployees,
  getEmployee,
  listDirectory,
  listBirthdays,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  addFlag,
  removeFlag,
  getFlagHistory,
};
