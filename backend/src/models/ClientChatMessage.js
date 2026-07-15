const { Schema, model } = require('mongoose');

// One chat per client (not per task) — persisted so the thread survives a
// refresh, pushed live over WebSocket (see websocket/clientChat.js). Who can
// read/post is client.chatAllowedEmployees, an admin-managed roster
// separate from task assignment.
const clientChatMessageSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    // Optional — an admin account is an operator login, not necessarily
    // tied to an Employee record, so it can post with no sender to populate.
    // The frontend falls back to showing "Admin" when this is empty.
    sender: { type: Schema.Types.ObjectId, ref: 'Employee' },
    body: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

clientChatMessageSchema.index({ client: 1, createdAt: 1 });

module.exports = model('ClientChatMessage', clientChatMessageSchema);
