const employeeRepository = require('../repositories/employee.repository');
const counterRepository = require('../repositories/counter.repository');
const userRepository = require('../repositories/user.repository');
const orgChartService = require('./orgChart.service');
const activityService = require('./activity.service');
const notificationService = require('./notification.service');
const ApiError = require('../utils/ApiError');
const { can, isSelf } = require('../utils/roles');
const { ACCESS } = require('../config/access');
const { NOTIFICATION_TYPES, INVENTORY_ITEM_CATEGORY, EMPLOYEE_STATUS } = require('../config/constants');

async function listEmployees(params) {
  return employeeRepository.list(params);
}

// One-time, lazy carry-forward into the newer categorized inventory system:
// an employee's existing single Mobile/Laptop (the old `inventory` object)
// becomes their first Office Phone / Office Laptop item the first time
// their record is read after this feature shipped. Never touches
// `inventory` itself (still the source the Hardware Consent Form reads),
// and never runs again once inventoryItems has at least one entry — so a
// later Personal Phone/Laptop the employee adds by hand is never
// overwritten or duplicated.
function synthesizeLegacyInventoryItems(inventory) {
  if (!inventory) return [];
  const items = [];
  if (inventory.hasMobile) {
    items.push({
      category: INVENTORY_ITEM_CATEGORY.OFFICE_PHONE,
      deviceName: inventory.deviceName,
      serialNumber: inventory.imeiOrSerialNumber,
      color: inventory.deviceColor,
      condition: inventory.deviceCondition,
      password: inventory.password,
      theftProtection: inventory.theftProtection,
      findMyDevice: inventory.findMyDevice,
      thumbOrFace: inventory.thumbOrFace,
      simProvider: inventory.simProvider,
      simPhoneNumber: inventory.simPhoneNumber,
      screenGuard: inventory.screenGuard,
      backCover: inventory.backCover,
      powerAdapter: inventory.powerAdapter,
      cable: inventory.cable,
      mobileOS: inventory.mobileOS || undefined,
      appleId: inventory.appleId,
      whatsappTwoFactor: inventory.whatsappTwoFactor,
      whatsappTwoFactorBackupMail: inventory.whatsappTwoFactorBackupMail,
      whatsappTwoFactorPin: inventory.whatsappTwoFactorPin,
      whatsappNameUpdated: inventory.whatsappNameUpdated,
      whatsappProfiling: inventory.whatsappProfiling,
      whatsappBackupInEmployeeMail: inventory.whatsappBackupInEmployeeMail,
      galleryBackupInEmployeeMail: inventory.galleryBackupInEmployeeMail,
      trueCallerUpdated: inventory.trueCallerUpdated,
    });
  }
  if (inventory.hasLaptop) {
    items.push({
      category: INVENTORY_ITEM_CATEGORY.OFFICE_LAPTOP,
      deviceName: inventory.laptopDeviceName,
      serialNumber: inventory.laptopSerialNumber,
      color: inventory.laptopColor,
      condition: inventory.laptopCondition,
      password: inventory.laptopPassword,
      theftProtection: inventory.laptopTheftProtection,
      findMyDevice: inventory.laptopFindMyDevice,
      thumbOrFace: inventory.laptopThumbOrFace,
      mouse: inventory.laptopMouse,
    });
  }
  return items;
}

async function getEmployee(id) {
  const employee = await employeeRepository.findById(id);
  if (!employee) throw ApiError.notFound('Employee not found');
  if ((employee.inventoryItems ?? []).length === 0) {
    const migrated = synthesizeLegacyInventoryItems(employee.inventory);
    if (migrated.length > 0) {
      return employeeRepository.updateById(id, { inventoryItems: migrated });
    }
  }
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

// An employee can only be off-boarded with their last working day on record
// — it decides their final salary slip (see
// salaryCalculation.service.js#clipToEmployment). `existing` is the record
// before this change (null when creating).
function assertOffboardingHasLastDay(data, existing) {
  const status = data.status ?? existing?.status;
  if (status !== EMPLOYEE_STATUS.OFFBOARDED) return;
  const lastDay = data.endDate !== undefined ? data.endDate : existing?.endDate;
  if (!lastDay) throw ApiError.badRequest('A last working day is required to off-board an employee');
}

async function createEmployee(data) {
  assertOffboardingHasLastDay(data, null);
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

// Fields nobody may change on their own record — their pay, payroll and
// employment status. Someone else (HR, the CEO or admin) has to.
const SELF_LOCKED_FIELDS = [
  'monthlyPay',
  'ctcAnnual',
  'salaryComponents',
  'payDate',
  'excludeFromPayroll',
  'probationCompleted',
  'status',
  'endDate',
  'dateOfJoining',
  'employeeCode',
];

function sameValue(a, b) {
  const norm = (v) => {
    if (v === undefined || v === null || v === '') return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };
  return norm(a) === norm(b);
}

async function updateEmployee(id, data, actor) {
  // employeeCode (the biometric device PIN) is EMS-for-everyone only —
  // silently dropped for anyone else rather than erroring, so the rest of
  // their edit still goes through.
  const payload = can(actor, ACCESS.EMS_ALL) ? data : { ...data, employeeCode: undefined };
  const existing = await employeeRepository.findById(id);
  if (!existing) throw ApiError.notFound('Employee not found');
  if (isSelf(actor, id)) {
    const changed = SELF_LOCKED_FIELDS.filter((f) => payload[f] !== undefined && !sameValue(payload[f], existing[f]));
    if (changed.length) {
      throw ApiError.forbidden(`You can't change your own ${changed.join(', ')} — someone else has to`);
    }
  }
  assertOffboardingHasLastDay(payload, existing);
  // Ticking "probation completed" ends probation early from today; unticking
  // it goes back to the automatic joining-date + 3 months.
  if (payload.probationCompleted === true && !existing.probationCompleted) payload.probationCompletedAt = new Date();
  if (payload.probationCompleted === false) payload.probationCompletedAt = null;
  const employee = await employeeRepository.updateById(id, payload);
  if (!employee) throw ApiError.notFound('Employee not found');
  await activityService.log(employee._id, 'EMPLOYEE_UPDATED', { fields: Object.keys(payload) });
  // An off-boarded employee can no longer sign in to the EMS.
  if (employee.status === EMPLOYEE_STATUS.OFFBOARDED) {
    await userRepository.deactivateForEmployee(employee._id);
    await orgChartService.removeEmployeeEverywhere(employee._id);
  }
  return employee;
}

async function deleteEmployee(id) {
  const employee = await employeeRepository.softDeleteById(id);
  if (!employee) throw ApiError.notFound('Employee not found');
  await userRepository.deactivateForEmployee(employee._id);
  await orgChartService.removeEmployeeEverywhere(employee._id);
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

  const [adminUsers, ceoUsers] = await Promise.all([userRepository.findAdmins(), userRepository.findCeos()]);
  const recipientIds = [...new Set([...adminUsers, ...ceoUsers].map((u) => u._id.toString()))];
  if (recipientIds.length === 0) return;

  await notificationService.createForUsers(recipientIds, {
    type: color === 'red' ? NOTIFICATION_TYPES.EMPLOYEE_RED_FLAG_MILESTONE : NOTIFICATION_TYPES.EMPLOYEE_GREEN_FLAG_MILESTONE,
    title: color === 'red' ? 'Performance concern' : 'Performance milestone',
    message,
    employee: employee._id,
  });
}

async function addFlag(id, { color, note, date }, addedBy, actor) {
  if (isSelf(actor, id)) throw ApiError.forbidden("You can't flag yourself");
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

async function removeFlag(id, flagId, actor) {
  if (isSelf(actor, id)) throw ApiError.forbidden("You can't change your own flags");
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
  synthesizeLegacyInventoryItems,
};
