const { Schema, model } = require('mongoose');
const { TASK_STAGE, TASK_STATUS, TASK_PRIORITY } = require('../config/constants');

const commentSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const attachmentSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    resourceType: { type: String, required: true },
    originalFilename: String,
    mimeType: String,
    sizeBytes: Number,
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const taskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    // Optional — internal/ad-hoc tickets have no client.
    client: { type: Schema.Types.ObjectId, ref: 'Client', index: true },

    stage: { type: String, enum: Object.values(TASK_STAGE), default: TASK_STAGE.CUSTOM },
    status: { type: String, enum: Object.values(TASK_STATUS), default: TASK_STATUS.TODO },
    priority: { type: String, enum: Object.values(TASK_PRIORITY), default: TASK_PRIORITY.MEDIUM },
    dueDate: Date,

    assigneeEmployees: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
    assigneeTeam: { type: Schema.Types.ObjectId, ref: 'Team' },

    // Generic prerequisite links — used to gate the Calendar stage on the
    // three parallel content-production tasks being done.
    dependsOn: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
    autoUnlock: { type: Boolean, default: false },

    // Increments per client each time it loops through the fixed pipeline, so
    // repeated cycles for the same client don't collide.
    cycle: { type: Number, default: 1 },

    comments: [commentSchema],
    attachments: [attachmentSchema],

    isDeleted: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

taskSchema.index({ client: 1, cycle: 1, stage: 1 });
taskSchema.index({ status: 1, dueDate: 1 });
taskSchema.index({ assigneeEmployees: 1 });

module.exports = model('Task', taskSchema);
