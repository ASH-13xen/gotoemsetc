const { Schema, model } = require('mongoose');

const activityLogSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    actorType: { type: String, enum: ['admin', 'employee-link'], default: 'admin' },
    action: { type: String, required: true },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = model('ActivityLog', activityLogSchema);
