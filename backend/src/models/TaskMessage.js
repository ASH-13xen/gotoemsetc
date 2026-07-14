const { Schema, model } = require('mongoose');

// Per-task status chat — persisted so the thread survives a refresh, pushed
// live over WebSocket (see websocket/taskChat.js) so it behaves like a chat
// app instead of a comments box you have to reload.
const taskMessageSchema = new Schema(
  {
    task: { type: Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    body: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

taskMessageSchema.index({ task: 1, createdAt: 1 });

module.exports = model('TaskMessage', taskMessageSchema);
