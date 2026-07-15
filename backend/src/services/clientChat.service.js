const ApiError = require('../utils/ApiError');
const clientChatMessageRepository = require('../repositories/clientChatMessage.repository');
const clientRepository = require('../repositories/client.repository');

async function listMessages(clientId) {
  return clientChatMessageRepository.listForClient(clientId);
}

async function postMessage(clientId, senderEmployeeId, body) {
  return clientChatMessageRepository.create({ client: clientId, sender: senderEmployeeId, body });
}

// Admin-only roster of who can read/post in this client's chat — kept as
// its own action (rather than folded into the generic client PATCH) so it
// can be gated separately.
async function updateChatAccess(clientId, employeeIds) {
  const client = await clientRepository.updateById(clientId, { chatAllowedEmployees: employeeIds });
  if (!client) throw ApiError.notFound('Client not found');
  return client;
}

module.exports = { listMessages, postMessage, updateChatAccess };
