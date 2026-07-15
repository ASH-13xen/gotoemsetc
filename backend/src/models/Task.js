const { Schema, model } = require('mongoose');
const { TASK_STATUS, STEP_STATUS, APPROVAL_STATUS } = require('../config/constants');

// Each step is tracked independently — its own assignees, due date, status,
// and optional approval gate — rather than the task having one flat status.
const taskStepSchema = new Schema({
  label: { type: String, required: true },
  order: { type: Number, required: true },
  // Free-text brief employees fill in describing what's expected for this
  // step (e.g. under "Plan of Action" for Reel #1) — separate from the
  // step's label, which stays admin-controlled.
  whatToDo: { type: String, trim: true },
  status: { type: String, enum: Object.values(STEP_STATUS), default: STEP_STATUS.TODO },
  assignedEmployees: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
  dueDate: { type: Date },
  requiresApproval: { type: Boolean, default: false },
  approvalStatus: { type: String, enum: Object.values(APPROVAL_STATUS), default: APPROVAL_STATUS.NOT_REQUIRED },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
  approvedAt: { type: Date },
  completedBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
  completedAt: { type: Date },
  // Guards the daily overdue sweep from re-notifying about the same
  // still-overdue step every single day.
  overdueNotifiedAt: { type: Date },
});

const attachmentSchema = new Schema(
  {
    label: { type: String, required: true },
    url: { type: String, required: true },
    addedBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// One document per deliverable instance per cycle — e.g. cycle 3's "Reel #2"
// for a client is its own Task, snapshotting the section's step pipeline at
// generation time (so editing the template later doesn't retroactively
// change in-flight tasks).
const taskSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    cycle: { type: Schema.Types.ObjectId, ref: 'TaskCycle', required: true, index: true },
    quotationTemplate: { type: Schema.Types.ObjectId, ref: 'QuotationTemplate' },
    sectionName: { type: String, required: true },
    itemLabel: { type: String, required: true },
    itemIndex: { type: Number, required: true },
    description: { type: String, trim: true },
    steps: [taskStepSchema],
    status: { type: String, enum: Object.values(TASK_STATUS), default: TASK_STATUS.PENDING },
    assignedTeam: { type: Schema.Types.ObjectId, ref: 'Team' },
    assignedEmployees: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
    leadEmployee: { type: Schema.Types.ObjectId, ref: 'Employee' },
    attachments: [attachmentSchema],
    // Set when this task was created to carry forward an incomplete task
    // from a prior (now-closed) cycle, and on the original task when it
    // gets carried forward — see task.service.js rolloverTask.
    rolledOverFrom: { type: Schema.Types.ObjectId, ref: 'Task' },
    rolledOverTo: { type: Schema.Types.ObjectId, ref: 'Task' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

taskSchema.index({ client: 1, cycle: 1 });

module.exports = model('Task', taskSchema);
