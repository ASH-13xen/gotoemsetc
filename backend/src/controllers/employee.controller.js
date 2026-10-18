const asyncHandler = require('../utils/asyncHandler');
const employeeService = require('../services/employee.service');
const activityService = require('../services/activity.service');
const { shapeForRole } = require('../utils/fieldGate');
const { can } = require('../utils/roles');
const { ACCESS } = require('../config/access');

const list = asyncHandler(async (req, res) => {
  const result = await employeeService.listEmployees(req.query);
  res.json({ ...result, items: shapeForRole('Employee', result.items, req.user) });
});

const getById = asyncHandler(async (req, res) => {
  const employee = await employeeService.getEmployee(req.params.id);
  res.json({ employee: shapeForRole('Employee', employee, req.user) });
});

const anniversaries = asyncHandler(async (req, res) => {
  const employees = await employeeService.listAnniversaries();
  res.json({ employees });
});

const completeProbation = asyncHandler(async (req, res) => {
  const employee = await employeeService.completeProbation(req.params.id, req.file, req.user);
  req.auditContext = { action: 'employee.completeProbation', resourceType: 'Employee', resourceId: employee._id };
  res.json({ employee: shapeForRole('Employee', employee, req.user) });
});

const changeSalary = asyncHandler(async (req, res) => {
  const employee = await employeeService.changeSalary(req.params.id, req.body, req.file, req.user);
  req.auditContext = { action: 'employee.changeSalary', resourceType: 'Employee', resourceId: employee._id, metadata: req.body };
  res.json({ employee: shapeForRole('Employee', employee, req.user) });
});

const birthdays = asyncHandler(async (req, res) => {
  const employees = await employeeService.listBirthdays();
  res.json({ employees });
});

const directory = asyncHandler(async (req, res) => {
  const items = await employeeService.listDirectory();
  res.json({ items });
});

const create = asyncHandler(async (req, res) => {
  const employee = await employeeService.createEmployee(req.body, req.user);
  req.auditContext = {
    action: 'employee.create',
    resourceType: 'Employee',
    resourceId: employee._id,
    metadata: { employeeCode: employee.employeeCode },
  };
  res.status(201).json({ employee: shapeForRole('Employee', employee, req.user) });
});

const update = asyncHandler(async (req, res) => {
  const employee = await employeeService.updateEmployee(req.params.id, req.body, req.user);
  req.auditContext = {
    action: 'employee.update',
    resourceType: 'Employee',
    resourceId: employee._id,
    metadata: req.body,
  };
  res.json({ employee: shapeForRole('Employee', employee, req.user) });
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

const addFlag = asyncHandler(async (req, res) => {
  const employee = await employeeService.addFlag(req.params.id, req.body, req.user.id, req.user);
  req.auditContext = {
    action: 'employee.flag.add',
    resourceType: 'Employee',
    resourceId: employee._id,
    metadata: req.body,
  };
  // A coordinator gives flags without seeing anyone's employee record.
  if (!can(req.user, ACCESS.EMS_ALL)) return res.status(201).json({ ok: true });
  res.status(201).json({ employee: shapeForRole('Employee', employee, req.user) });
});

const removeFlag = asyncHandler(async (req, res) => {
  const employee = await employeeService.removeFlag(req.params.id, req.params.flagId, req.user);
  req.auditContext = {
    action: 'employee.flag.remove',
    resourceType: 'Employee',
    resourceId: employee._id,
    metadata: { flagId: req.params.flagId },
  };
  res.json({ employee: shapeForRole('Employee', employee, req.user) });
});

const flagHistory = asyncHandler(async (req, res) => {
  const entries = await employeeService.getFlagHistory();
  res.json({ entries });
});

const flagsGiven = asyncHandler(async (req, res) => {
  res.json({ entries: await employeeService.getFlagsGivenBy(req.user.id) });
});

const flagPeople = asyncHandler(async (req, res) => {
  res.json({ people: await employeeService.listFlagPeople(req.user) });
});

module.exports = { list, getById, birthdays, anniversaries, completeProbation, changeSalary, directory, create, update, remove, activity, addFlag, removeFlag, flagHistory, flagsGiven, flagPeople };
