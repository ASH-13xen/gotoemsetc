const { Schema, model } = require('mongoose');

// Mirrors ActivityLog (the employee-side activity feed) exactly, but scoped
// to Client — kept as a separate model/collection rather than a shared
// polymorphic one so neither side risks breaking the other.
const clientActivityLogSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    actorType: { type: String, enum: ['admin', 'client-link'], default: 'admin' },
    action: { type: String, required: true },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = model('ClientActivityLog', clientActivityLogSchema);
