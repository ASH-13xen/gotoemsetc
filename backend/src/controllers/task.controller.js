const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const taskService = require('../services/task.service');
const taskCycleService = require('../services/taskCycle.service');
const taskDashboardService = require('../services/taskDashboard.service');
const { broadcastTaskMessage } = require('../websocket/taskChat');

function requireEmployeeLink(req) {
  if (!req.user.employeeLink) {
    throw ApiError.badRequest('Your account is not linked to an employee record.');
  }
  return req.user.employeeLink;
}

const listForClient = asyncHandler(async (req, res) => {
  const result = await taskService.listForClient(req.params.id, req.query.cycleId);
  res.json(result);
});

const syncCycle = asyncHandler(async (req, res) => {
  const result = await taskCycleService.syncClientCycle(req.params.id);
  res.json(result);
});

const getById = asyncHandler(async (req, res) => {
  const task = await taskService.getTask(req.params.id);
  res.json({ task });
});

const updateAssignment = asyncHandler(async (req, res) => {
  const task = await taskService.updateAssignment(req.params.id, req.body);
  res.json({ task });
});

const updateStepAssignment = asyncHandler(async (req, res) => {
  const task = await taskService.updateStepAssignment(req.params.id, req.params.stepId, req.body);
  res.json({ task });
});

const updateStepStatus = asyncHandler(async (req, res) => {
  const employeeId = requireEmployeeLink(req);
  const task = await taskService.updateStepStatus(req.params.id, req.params.stepId, req.body.status, employeeId);
  res.json({ task });
});

const decideStepApproval = asyncHandler(async (req, res) => {
  const employeeId = requireEmployeeLink(req);
  const task = await taskService.decideStepApproval(req.params.id, req.params.stepId, req.body.approved, employeeId);
  res.json({ task });
});

const addAttachment = asyncHandler(async (req, res) => {
  const employeeId = requireEmployeeLink(req);
  const task = await taskService.addAttachment(req.params.id, req.body, employeeId);
  res.status(201).json({ task });
});

const removeAttachment = asyncHandler(async (req, res) => {
  const task = await taskService.removeAttachment(req.params.id, Number(req.params.attachmentIndex));
  res.json({ task });
});

const rollover = asyncHandler(async (req, res) => {
  const task = await taskService.rolloverTask(req.params.id);
  res.status(201).json({ task });
});

const listMessages = asyncHandler(async (req, res) => {
  const messages = await taskService.listMessages(req.params.id);
  res.json({ messages });
});

const postMessage = asyncHandler(async (req, res) => {
  const employeeId = requireEmployeeLink(req);
  const message = await taskService.postMessage(req.params.id, employeeId, req.body.body);
  broadcastTaskMessage(req.params.id, message);
  res.status(201).json({ message });
});

const dashboard = asyncHandler(async (req, res) => {
  const result = await taskDashboardService.getDashboard(req.user);
  res.json(result);
});

const workloadSummary = asyncHandler(async (req, res) => {
  const summary = await taskDashboardService.getWorkloadSummary();
  res.json({ summary });
});

const workloadForEmployee = asyncHandler(async (req, res) => {
  const tasks = await taskDashboardService.getWorkloadForEmployee(req.params.employeeId);
  res.json({ tasks });
});

const contentCalendar = asyncHandler(async (req, res) => {
  const from = new Date(req.query.from);
  const to = new Date(req.query.to);
  const tasks = await taskDashboardService.getContentCalendar(req.user, from, to);
  res.json({ tasks });
});

module.exports = {
  listForClient,
  syncCycle,
  getById,
  updateAssignment,
  updateStepAssignment,
  updateStepStatus,
  decideStepApproval,
  addAttachment,
  removeAttachment,
  rollover,
  listMessages,
  postMessage,
  dashboard,
  workloadSummary,
  workloadForEmployee,
  contentCalendar,
};
