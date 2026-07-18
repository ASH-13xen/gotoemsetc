const employeeRepository = require('../repositories/employee.repository');
const counterRepository = require('../repositories/counter.repository');
const activityService = require('./activity.service');
const ApiError = require('../utils/ApiError');
const { isAdminLike } = require('../utils/roles');

async function listEmployees(params) {
  return employeeRepository.list(params);
}

async function getEmployee(id) {
  const employee = await employeeRepository.findById(id);
  if (!employee) throw ApiError.notFound('Employee not found');
  return employee;
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
  // first call here returns 1001.
  const seq = await counterRepository.nextSequence('employeeCode');
  const employeeCode = String(seq);
  // Biometric device PIN — auto-generated sequentially starting at 1000 (see
  // scripts/seedEcoIdCounter.js), editable afterward via updateEmployee
  // (admin/HR only).
  const ecoIdSeq = await counterRepository.nextSequence('ecoId');
  const ecoId = String(ecoIdSeq);
  const extraDetails = data.extraDetails?.length ? data.extraDetails : DEFAULT_EXTRA_DETAILS;
  const employee = await employeeRepository.create({ ...data, employeeCode, ecoId, extraDetails });
  await activityService.log(employee._id, 'EMPLOYEE_CREATED', { employeeCode, ecoId });
  return employee;
}

async function updateEmployee(id, data, actingUserRole) {
  // ecoId (the biometric device PIN) is admin/HR-only — silently dropped for
  // anyone else rather than erroring, so the rest of a non-admin's edit
  // still goes through.
  const payload = isAdminLike({ role: actingUserRole }) ? data : { ...data, ecoId: undefined };
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

async function addFlag(id, { color, note, date }, addedBy) {
  const employee = await employeeRepository.addFlag(id, { color, note, date, addedBy });
  if (!employee) throw ApiError.notFound('Employee not found');
  await activityService.log(employee._id, 'EMPLOYEE_FLAG_ADDED', { color, note, date });
  return employee;
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
  listBirthdays,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  addFlag,
  removeFlag,
};
