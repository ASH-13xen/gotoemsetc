const ClientChatMessage = require('../models/ClientChatMessage');

// Populated before returning so both the REST response and the live
// WebSocket broadcast carry a ready-to-render sender, not a bare ObjectId.
async function create(data) {
  const message = await ClientChatMessage.create(data);
  return message.populate('sender', 'firstName lastName designation');
}

function listForClient(clientId) {
  return ClientChatMessage.find({ client: clientId }).sort({ createdAt: 1 }).populate('sender', 'firstName lastName designation');
}

module.exports = { create, listForClient };
