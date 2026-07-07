const employeeRepository = require('../repositories/employee.repository');
const counterRepository = require('../repositories/counter.repository');
const activityService = require('./activity.service');
const ApiError = require('../utils/ApiError');

async function listEmployees(params) {
  return employeeRepository.list(params);
}

async function getEmployee(id) {
  const employee = await employeeRepository.findById(id);
  if (!employee) throw ApiError.notFound('Employee not found');
  return employee;
}

async function createEmployee(data) {
  const seq = await counterRepository.nextSequence('employeeCode');
  const employeeCode = `EMS-${String(seq).padStart(4, '0')}`;
  const employee = await employeeRepository.create({ ...data, employeeCode });
  await activityService.log(employee._id, 'EMPLOYEE_CREATED', { employeeCode });
  return employee;
}

async function updateEmployee(id, data) {
  const employee = await employeeRepository.updateById(id, data);
  if (!employee) throw ApiError.notFound('Employee not found');
  await activityService.log(employee._id, 'EMPLOYEE_UPDATED', { fields: Object.keys(data) });
  return employee;
}

async function deleteEmployee(id) {
  const employee = await employeeRepository.softDeleteById(id);
  if (!employee) throw ApiError.notFound('Employee not found');
  await activityService.log(employee._id, 'EMPLOYEE_REMOVED', {});
  return employee;
}

module.exports = { listEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee };
