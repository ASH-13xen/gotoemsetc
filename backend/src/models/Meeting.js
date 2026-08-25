const { Schema, model } = require('mongoose');
const { MEETING_TYPE, MEETING_STATUS, MOM_TASK_KIND } = require('../config/constants');

// The MOM lives inside the meeting it belongs to — a MOM never exists
// independently of exactly one meeting, so there's no separate model. Absent
// (undefined) until submitted.
const momSchema = new Schema(
  {
    summary: { type: String, trim: true },
    attendeesPresent: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
    attendeesAbsent: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
    decisions: [{ type: String, trim: true }],
    actionItems: [{ type: String, trim: true }],
    writtenBy: { type: Schema.Types.ObjectId, ref: 'User' },
    writtenAt: { type: Date },
  },
  { _id: false }
);

const rescheduleEntrySchema = new Schema(
  {
    from: { type: Date, required: true },
    to: { type: Date, required: true },
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

// Snapshotted at creation (title/description as originally written) so a
// later rename/edit of the task doesn't rewrite what the manual says
// happened at MOM time — the live `task` ref is what the manual reads for
// *current* status. See employeeTask.service.js#updateTask for how
// `taskEdits` below gets appended.
const spawnedTaskSchema = new Schema(
  {
    task: { type: Schema.Types.ObjectId, ref: 'EmployeeTask', required: true },
    titleSnapshot: { type: String, trim: true },
    descriptionSnapshot: { type: String, trim: true },
    kind: { type: String, enum: Object.values(MOM_TASK_KIND), required: true },
  },
  { _id: false }
);

const taskEditEntrySchema = new Schema(
  {
    task: { type: Schema.Types.ObjectId, ref: 'EmployeeTask', required: true },
    changedFields: [{ type: String }],
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const meetingSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: 'TaskClient', required: true, index: true },
    scheduledAt: { type: Date, required: true },
    status: { type: String, enum: Object.values(MEETING_STATUS), default: MEETING_STATUS.SCHEDULED },
    // true = entered after the fact (a past meeting being recorded for the
    // record) — starts 'completed' immediately, no reminder/late-flag logic
    // applies, since there was nothing to be "late" for.
    isLogged: { type: Boolean, default: false },

    meetingType: { type: String, enum: Object.values(MEETING_TYPE), required: true },
    location: { type: String, trim: true },
    meetingLink: { type: String, trim: true },

    // Validated against client.defaultTeam's roster at schedule time, then
    // left as-is — the invite list should stay historically accurate even
    // if the team's roster changes later.
    participants: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],

    rescheduledAt: { type: Date, default: null },
    rescheduleHistory: [rescheduleEntrySchema],
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },

    // Dedup guard for the 24h-late-MOM cron — see jobs/meetingReminder.job.js.
    lateFlaggedAt: { type: Date, default: null },

    mom: momSchema,

    spawnedTasks: [spawnedTaskSchema],
    taskEdits: [taskEditEntrySchema],

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

meetingSchema.index({ client: 1, scheduledAt: 1 });

module.exports = model('Meeting', meetingSchema);
