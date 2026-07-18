const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const clientChatService = require('../services/clientChat.service');
const { broadcastClientMessage } = require('../websocket/clientChat');
const { isAdminLike } = require('../utils/roles');

// Same admin-or-linked-employee attribution pattern as task.controller.js.
function requireEmployeeLink(req) {
  if (req.user.employeeLink) return req.user.employeeLink;
  if (isAdminLike(req.user)) return null;
  throw ApiError.badRequest('Your account is not linked to an employee record.');
}

const listMessages = asyncHandler(async (req, res) => {
  const messages = await clientChatService.listMessages(req.params.id);
  res.json({ messages });
});

const postMessage = asyncHandler(async (req, res) => {
  const employeeId = requireEmployeeLink(req);
  const message = await clientChatService.postMessage(req.params.id, employeeId, req.body.body);
  broadcastClientMessage(req.params.id, message);
  res.status(201).json({ message });
});

const updateChatAccess = asyncHandler(async (req, res) => {
  const client = await clientChatService.updateChatAccess(req.params.id, req.body.chatAllowedEmployees);
  res.json({ client });
});

module.exports = { listMessages, postMessage, updateChatAccess };
