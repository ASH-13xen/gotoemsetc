const { Schema, model } = require('mongoose');

const auditLogSchema = new Schema(
  {
    actor: {
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      username: String,
      role: String,
    },
    action: { type: String, required: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ 'actor.userId': 1 });

module.exports = model('AuditLog', auditLogSchema);
