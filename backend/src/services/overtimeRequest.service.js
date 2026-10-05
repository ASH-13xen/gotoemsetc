const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const OvertimeRequest = require('../models/OvertimeRequest');
const AttendanceRecord = require('../models/AttendanceRecord');
const employeeRepository = require('../repositories/employee.repository');
const userRepository = require('../repositories/user.repository');
const workTeamRepository = require('../repositories/workTeam.repository');
const attendanceService = require('./attendance.service');
const notificationService = require('./notification.service');
const notifyRecipients = require('./notifyRecipients.service');
const accessService = require('./access.service');
const teamRoles = require('../utils/teamRoles');
const { istDateKey } = require('../utils/istDate');
const { needsOvertimeApproval, isAboveReviewThreshold } = require('../utils/overtimeApproval');
const { can, isSelf } = require('../utils/roles');
const { ACCESS, GRANTS } = require('../config/access');
const {
  OVERTIME_REQUEST_STATUS,
  OVERTIME_REQUEST_STAGE,
  OVERTIME_APPROVAL_FROM,
  OVERTIME_REVIEW_THRESHOLD_MINUTES,
  TEAM_MEMBER_ROLE,
  NOTIFICATION_TYPES,
  PERMISSIONS,
  EMPLOYEE_STATUS,
} = require('../config/constants');

// Overtime has to be approved before it counts. A day's overtime comes from
// the scans (only days above OVERTIME_REVIEW_THRESHOLD_MINUTES are sent for
// review — less than that counts as it always did) or from the employee
// applying for it. Either way it goes to the content manager of the
// employee's team, who passes it to HR with a reason; an employee who IS the
// content manager, or whose team has none, goes straight to HR. Only HR's
// approval puts the minutes on the attendance record — and so on the
// calendar and the salary slip. Either step can change the minutes. A
// rejection at either step ends it.

const { PENDING, APPROVED, REJECTED } = OVERTIME_REQUEST_STATUS;
const { CONTENT_MANAGER, HR } = OVERTIME_REQUEST_STAGE;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Same window an employee has for any other attendance request.
const APPLY_CUTOFF_DAYS = 2;
const POPULATE = [{ path: 'employee', select: 'firstName lastName employeeCode designation' }];
// The content manager's name, for the people reviewing after them.
const POPULATE_REVIEW = [
  ...POPULATE,
  { path: 'cmApprovedBy', select: 'username employeeLink', populate: { path: 'employeeLink', select: 'firstName lastName' } },
];
// Who gave HR's decision — only for them and the people above them.
const ATTRIBUTION = [{ by: 'decidedBy', as: 'decidedAs' }];

const nameOf = (employee) => `${employee.firstName} ${employee.lastName || ''}`.trim();
const dayStr = (date) => new Date(date).toISOString().slice(0, 10);
const prettyDay = (date) =>
  new Date(date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const asHr = (actor) => accessService.actingRole(actor, GRANTS[ACCESS.HRMS]);
// Whoever may give the final approval — HR, and the CEO/admin above them.
const canDecideAsHr = (user) => can(user, ACCESS.HRMS) || (user.permissions || []).includes(PERMISSIONS.MARK_ATTENDANCE);

// The minutes on the table at each step: what the last person settled on,
// else what was applied for, else what the scans worked out.
const suggestedMinutes = (request) => request.cmMinutes ?? request.appliedMinutes ?? request.biometricMinutes ?? 0;

// Content manager first — unless the employee is on no team, is a content
// manager themself, or none of their teams has one (so nothing is ever
// unroutable). On several teams, a content manager of any of them will do.
async function resolveStage(employeeId) {
  const teams = await workTeamRepository.listForMember(employeeId);
  if (teams.some((t) => teamRoles.hasRole(t, employeeId, TEAM_MEMBER_ROLE.CONTENT_MANAGER))) return { stage: HR, cmIds: [] };
  const cmIds = [...new Set(teams.flatMap((t) => teamRoles.membersWithRole(t, TEAM_MEMBER_ROLE.CONTENT_MANAGER)))];
  return cmIds.length ? { stage: CONTENT_MANAGER, cmIds } : { stage: HR, cmIds: [] };
}

async function isContentManagerOf(applicantEmployeeId, cmEmployeeId) {
  if (!cmEmployeeId) return false;
  const teams = await workTeamRepository.listForMember(applicantEmployeeId);
  return teams.some((t) => teamRoles.hasRole(t, cmEmployeeId, TEAM_MEMBER_ROLE.CONTENT_MANAGER));
}

function describe(request) {
  const parts = [];
  if (request.appliedMinutes !== null && request.appliedMinutes !== undefined) parts.push(`applied for ${request.appliedMinutes} min`);
  if (request.biometricMinutes) parts.push(`${request.biometricMinutes} min by biometric`);
  return parts.join(', ') || 'overtime';
}

async function notifyReviewers(request, employee, cmIds) {
  const name = nameOf(employee);
  if (request.stage === CONTENT_MANAGER) {
    const ids = cmIds || (await resolveStage(employee._id)).cmIds;
    await notificationService.createForUsers(await notifyRecipients.resolveUserIdsForEmployees(ids), {
      type: NOTIFICATION_TYPES.OVERTIME_PENDING_CM_REVIEW,
      title: 'Overtime needs your review',
      message: `${name} — ${prettyDay(request.date)}: ${describe(request)}.${request.employeeReason ? ` Reason: ${request.employeeReason}` : ''}`,
      employee: employee._id,
    });
    return;
  }
  const hrUsers = await userRepository.findHr();
  await notificationService.createForUsers(
    hrUsers.map((u) => u._id),
    {
      type: NOTIFICATION_TYPES.OVERTIME_PENDING_HR_REVIEW,
      title: 'Overtime needs HR approval',
      message: request.cmReason
        ? `${name} — ${prettyDay(request.date)}: ${request.cmMinutes} min, passed on by their content manager. Reason: ${request.cmReason}`
        : `${name} — ${prettyDay(request.date)}: ${describe(request)}.${request.employeeReason ? ` Reason: ${request.employeeReason}` : ''}`,
      employee: employee._id,
    }
  );
}

async function notifyEmployee(request, type, title, message) {
  const user = await userRepository.findByEmployeeId(request.employee._id || request.employee);
  if (!user) return;
  await notificationService.createForUsers([user._id], { type, title, message, employee: request.employee._id || request.employee });
}

// An employee applying for overtime on a day (today or the last 2 days).
// One request per day: applying on a day the scans already raised adds the
// employee's own figure and reason to that same request.
async function apply(user, { date: dateStr, minutes, reason }) {
  if (!user.employeeLink) throw ApiError.badRequest('No employee record is linked to this account');
  const employee = await employeeRepository.findById(user.employeeLink);
  if (!employee) throw ApiError.notFound('Employee not found');

  const date = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw ApiError.badRequest('Invalid date');
  const today = new Date(`${istDateKey(new Date())}T00:00:00.000Z`);
  if (date.getTime() > today.getTime()) throw ApiError.badRequest('Overtime can only be applied for once the day has come');
  if ((today.getTime() - date.getTime()) / MS_PER_DAY > APPLY_CUTOFF_DAYS) {
    throw ApiError.badRequest('Overtime can only be applied for within 2 days of the day it was worked');
  }
  if (!needsOvertimeApproval(date)) throw ApiError.badRequest('Overtime approval does not apply to this date');

  const record = await AttendanceRecord.findOne({ employee: employee._id, date });
  const existing = await OvertimeRequest.findOne({ employee: employee._id, date });
  if (existing) {
    if (existing.status !== PENDING) throw ApiError.conflict('Overtime for this day has already been decided');
    if (existing.appliedMinutes !== null && existing.appliedMinutes !== undefined) {
      throw ApiError.conflict('You have already applied for overtime on this day — it is waiting for approval');
    }
    if (existing.stage !== CONTENT_MANAGER && existing.cmApprovedBy) {
      throw ApiError.conflict('Overtime for this day is already with HR for approval');
    }
    existing.appliedMinutes = minutes;
    existing.employeeReason = reason;
    await existing.save();
    return OvertimeRequest.findById(existing._id).populate(POPULATE);
  }

  const { stage, cmIds } = await resolveStage(employee._id);
  const request = await OvertimeRequest.create({
    employee: employee._id,
    date,
    biometricMinutes: record?.biometricOvertimeMinutes || 0,
    appliedMinutes: minutes,
    employeeReason: reason,
    stage,
  });
  await notifyReviewers(request, employee, cmIds);
  return OvertimeRequest.findById(request._id).populate(POPULATE);
}

// Raises a request for every closed day (before today, IST) whose biometric
// overtime is above the threshold, isn't counted yet and has no request.
// Run nightly, at start-up and — throttled — whenever an approver looks at
// their queue, so a missed night never leaves overtime unraised.
let lastSweepAt = 0;
async function raiseFromBiometric({ force = false } = {}) {
  if (!force && Date.now() - lastSweepAt < 10 * 60 * 1000) return 0;
  lastSweepAt = Date.now();

  const today = new Date(`${istDateKey(new Date())}T00:00:00.000Z`);
  const from = new Date(`${OVERTIME_APPROVAL_FROM}T00:00:00.000Z`);
  const records = await AttendanceRecord.find({
    date: { $gte: from, $lt: today },
    biometricOvertimeMinutes: { $gt: OVERTIME_REVIEW_THRESHOLD_MINUTES },
    overtimeMinutes: { $in: [0, null] },
  }).populate('employee', 'firstName lastName status isDeleted');
  if (records.length === 0) return 0;

  const existing = await OvertimeRequest.find({ date: { $gte: from, $lt: today } }).select('employee date');
  const have = new Set(existing.map((r) => `${r.employee}:${dayStr(r.date)}`));

  let raised = 0;
  for (const record of records) {
    const employee = record.employee;
    if (!employee || employee.isDeleted || employee.status !== EMPLOYEE_STATUS.ACTIVE) continue;
    if (have.has(`${employee._id}:${dayStr(record.date)}`)) continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      const { stage, cmIds } = await resolveStage(employee._id);
      // eslint-disable-next-line no-await-in-loop
      const request = await OvertimeRequest.create({
        employee: employee._id,
        date: record.date,
        biometricMinutes: record.biometricOvertimeMinutes,
        stage,
      });
      // eslint-disable-next-line no-await-in-loop
      await notifyReviewers(request, employee, cmIds);
      raised += 1;
    } catch (err) {
      // A duplicate (two sweeps at once) is fine; anything else is logged
      // and the rest still go through.
      if (err?.code !== 11000) logger.error({ err, employee: employee._id, date: record.date }, 'Could not raise overtime request');
    }
  }
  return raised;
}

async function loadPending(id) {
  const request = await OvertimeRequest.findById(id).populate(POPULATE);
  if (!request) throw ApiError.notFound('Overtime request not found');
  if (request.status !== PENDING) throw ApiError.conflict('This overtime has already been decided');
  return request;
}

function assertNotOwn(user, request) {
  if (isSelf(user, request.employee._id)) {
    throw ApiError.forbidden('This is your own overtime — someone else has to decide it');
  }
}

// Content manager → HR, with the minutes they vouch for and why.
async function approveAsContentManager(user, id, { minutes, reason }) {
  const request = await loadPending(id);
  if (request.stage !== CONTENT_MANAGER) throw ApiError.conflict('This overtime is not waiting for a content manager');
  assertNotOwn(user, request);
  if (!(await isContentManagerOf(request.employee._id, user.employeeLink))) {
    throw ApiError.forbidden("Only the content manager of this person's team can review this");
  }

  request.cmMinutes = minutes;
  request.cmReason = reason;
  request.cmApprovedBy = user.id;
  request.cmApprovedAt = new Date();
  request.stage = HR;
  await request.save();
  await notifyReviewers(request, request.employee);
  return request;
}

// HR's final approval — the only thing that puts overtime on attendance.
async function approve(user, id, { minutes, note }) {
  const request = await loadPending(id);
  if (!canDecideAsHr(user)) throw ApiError.forbidden('Only HR can give the final approval');
  if (request.stage !== HR) throw ApiError.conflict('This overtime is still with the content manager');
  assertNotOwn(user, request);

  const approvedMinutes = minutes ?? suggestedMinutes(request);
  if (!approvedMinutes) throw ApiError.badRequest('Enter the overtime minutes to approve');
  // Overtime can't sit on a working day with no status — HR marks the day first.
  await attendanceService.assertStatusForOvertime(request.employee._id, request.date, { overtimeMinutes: approvedMinutes });

  request.status = APPROVED;
  request.approvedMinutes = approvedMinutes;
  request.hrNote = note;
  request.decidedBy = user.id;
  request.decidedAs = asHr(user);
  request.decidedAt = new Date();
  await request.save();

  await AttendanceRecord.findOneAndUpdate(
    { employee: request.employee._id, date: request.date },
    // A day with no record yet (a Sunday worked off-site, say) gets one that
    // carries only the overtime, the same shape the scans would have written.
    { $set: { overtimeMinutes: approvedMinutes }, $setOnInsert: { isAutoMarked: true, isSettled: true } },
    { upsert: true, setDefaultsOnInsert: true }
  );

  await notifyEmployee(
    request,
    NOTIFICATION_TYPES.OVERTIME_APPROVED,
    'Overtime approved',
    `Your overtime on ${prettyDay(request.date)} was approved: ${approvedMinutes} min.`
  );
  return request;
}

// Either step can turn it down, and that ends it. Nothing changes on
// attendance — unapproved overtime was never counted.
async function reject(user, id, { reason }) {
  const request = await loadPending(id);
  assertNotOwn(user, request);
  if (request.stage === CONTENT_MANAGER) {
    if (!(await isContentManagerOf(request.employee._id, user.employeeLink))) {
      throw ApiError.forbidden("Only the content manager of this person's team can review this");
    }
  } else if (!canDecideAsHr(user)) {
    throw ApiError.forbidden('Only HR can decide this');
  }

  request.status = REJECTED;
  request.rejectedStage = request.stage;
  request.rejectionReason = reason;
  request.decidedBy = user.id;
  request.decidedAs = request.stage === HR ? asHr(user) : null;
  request.decidedAt = new Date();
  await request.save();

  await notifyEmployee(
    request,
    NOTIFICATION_TYPES.OVERTIME_REJECTED,
    'Overtime not approved',
    `Your overtime on ${prettyDay(request.date)} was not approved by ${request.rejectedStage === HR ? 'HR' : 'your content manager'}: ${reason}`
  );
  return request;
}

const shape = (user, docs) => accessService.shapeAttribution(user, docs, ATTRIBUTION);

// What is waiting on this person: as a content manager (their teams'
// requests) and/or as HR (everything at the HR step, plus — read-only —
// what is still with a content manager).
async function listForApprover(user) {
  await raiseFromBiometric().catch((err) => logger.error({ err }, 'Overtime sweep failed'));

  const out = { contentManager: [], hr: [], withContentManager: [], isContentManager: false, isHr: canDecideAsHr(user) };
  const sort = { date: 1, createdAt: 1 };

  if (user.employeeLink) {
    const teams = await workTeamRepository.listWhereEmployeeIsContentManager(user.employeeLink);
    if (teams.length) {
      out.isContentManager = true;
      const employeeIds = [...new Set(teams.flatMap((t) => [t.leader, ...t.members].map((id) => id.toString())))].filter(
        (id) => id !== String(user.employeeLink)
      );
      out.contentManager = await OvertimeRequest.find({ status: PENDING, stage: CONTENT_MANAGER, employee: { $in: employeeIds } })
        .sort(sort)
        .populate(POPULATE_REVIEW);
    }
  }
  if (out.isHr) {
    const [hr, withCm] = await Promise.all([
      OvertimeRequest.find({ status: PENDING, stage: HR }).sort(sort).populate(POPULATE_REVIEW),
      OvertimeRequest.find({ status: PENDING, stage: CONTENT_MANAGER }).sort(sort).populate(POPULATE_REVIEW),
    ]);
    out.hr = hr;
    out.withContentManager = withCm;
  }

  const own = (r) => isSelf(user, r.employee?._id);
  const withOwn = async (docs) =>
    (await shape(user, docs)).map(({ cmApprovedBy, ...d }) => ({
      ...d,
      cmApprovedByName: cmApprovedBy?.employeeLink ? nameOf(cmApprovedBy.employeeLink) : cmApprovedBy?.username || null,
      isOwn: own(d),
      suggestedMinutes: suggestedMinutes(d),
    }));
  out.contentManager = await withOwn(out.contentManager);
  out.hr = await withOwn(out.hr);
  out.withContentManager = await withOwn(out.withContentManager);
  return out;
}

function monthRange({ month, year }) {
  const now = new Date();
  const y = year || now.getUTCFullYear();
  const m = month ? month - 1 : now.getUTCMonth();
  return { $gte: new Date(Date.UTC(y, m, 1)), $lte: new Date(Date.UTC(y, m + 1, 0)) };
}

// One employee's requests for a month — themself, or HR looking at them.
async function listForEmployee(user, employeeId, query = {}) {
  if (!isSelf(user, employeeId) && !canDecideAsHr(user) && !can(user, ACCESS.EMS_ALL)) throw ApiError.forbidden();
  const requests = await OvertimeRequest.find({ employee: employeeId, date: monthRange(query) }).select('-cmApprovedBy').sort({ date: 1 });
  return shape(user, requests);
}

// The month's requests in the few fields a calendar needs — no access check
// of its own; the attendance route it rides along with already has one.
async function listDaySummaries(employeeId, query = {}) {
  return OvertimeRequest.find({ employee: employeeId, date: monthRange(query) })
    .select('date status stage biometricMinutes appliedMinutes cmMinutes approvedMinutes rejectedStage rejectionReason')
    .sort({ date: 1 })
    .lean();
}

// How many overtime decisions are still open for a month — shown before
// salary slips are generated, since unapproved overtime isn't paid.
async function countPendingForMonth({ month, year }) {
  return OvertimeRequest.countDocuments({ status: PENDING, date: monthRange({ month, year }) });
}

module.exports = {
  apply,
  raiseFromBiometric,
  approveAsContentManager,
  approve,
  reject,
  listForApprover,
  listForEmployee,
  listDaySummaries,
  countPendingForMonth,
  isAboveReviewThreshold,
};
