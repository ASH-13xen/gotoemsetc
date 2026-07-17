const asyncHandler = require('../utils/asyncHandler');
const employeeService = require('../services/employee.service');
const activityService = require('../services/activity.service');
const { shapeForRole } = require('../utils/fieldGate');

const list = asyncHandler(async (req, res) => {
  const result = await employeeService.listEmployees(req.query);
  res.json({ ...result, items: shapeForRole('Employee', result.items, req.user.role) });
});

const getById = asyncHandler(async (req, res) => {
  const employee = await employeeService.getEmployee(req.params.id);
  res.json({ employee: shapeForRole('Employee', employee, req.user.role) });
});

const birthdays = asyncHandler(async (req, res) => {
  const employees = await employeeService.listBirthdays();
  res.json({ employees });
});

const create = asyncHandler(async (req, res) => {
  const employee = await employeeService.createEmployee(req.body);
  req.auditContext = {
    action: 'employee.create',
    resourceType: 'Employee',
    resourceId: employee._id,
    metadata: { employeeCode: employee.employeeCode },
  };
  res.status(201).json({ employee: shapeForRole('Employee', employee, req.user.role) });
});

const update = asyncHandler(async (req, res) => {
  const employee = await employeeService.updateEmployee(req.params.id, req.body, req.user.role);
  req.auditContext = {
    action: 'employee.update',
    resourceType: 'Employee',
    resourceId: employee._id,
    metadata: req.body,
  };
  res.json({ employee: shapeForRole('Employee', employee, req.user.role) });
});

const remove = asyncHandler(async (req, res) => {
  await employeeService.deleteEmployee(req.params.id);
  req.auditContext = { action: 'employee.delete', resourceType: 'Employee', resourceId: req.params.id };
  res.status(204).send();
});

const activity = asyncHandler(async (req, res) => {
  const activityLog = await activityService.listForEmployee(req.params.id);
  res.json({ activityLog });
});

module.exports = { list, getById, birthdays, create, update, remove, activity };
