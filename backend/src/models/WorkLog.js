const { Schema, model } = require('mongoose');

// A stretch of time someone worked — on a ticket (a client's, when the ticket
// is for one) or on other work (a meeting, internal work, training), which is
// overhead. Made by the work timer ("Start working" / "Pause"), which runs on
// one thing at a time and stops itself at lunch, at the end of the shift and,
// overnight, at the person's last scan; or added and corrected by a manager,
// every change kept in `edits` (services/workLog.service.js).
const editSchema = new Schema(
  {
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    byName: { type: String, trim: true },
    at: { type: Date, default: Date.now },
    note: { type: String, trim: true },
    from: { type: Schema.Types.Mixed },
    to: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const workLogSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    kind: { type: String, enum: ['ticket', 'other'], required: true },
    ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', default: null, index: true },
    // Copied from the ticket, so a client's time adds up without a join.
    client: { type: Schema.Types.ObjectId, ref: 'TaskClient', default: null, index: true },
    otherKind: { type: String, enum: ['meeting', 'internal', 'training', 'other', null], default: null },
    note: { type: String, trim: true },
    startedAt: { type: Date, required: true },
    // Null while the timer is running.
    endedAt: { type: Date, default: null },
    minutes: { type: Number, default: 0 },
    // Of those, outside the person's shift (worked as overtime).
    overtimeMinutes: { type: Number, default: 0 },
    stopReason: { type: String, enum: ['paused', 'switched', 'lunch', 'shift_end', 'left', 'day_end', 'manager', null], default: null },
    // timer: the work timer; manual: added by a manager; confirmed: the
    // hours someone confirmed (or changed) when handing a step on; shoot: a
    // shoot's hours, shared across its reels; meeting: a meeting's length.
    source: { type: String, enum: ['timer', 'manual', 'confirmed', 'shoot', 'meeting'], default: 'timer' },
    // Hours for a step (source 'confirmed'): which step, the estimate offered,
    // whether the person changed it and why, and — when someone else moved
    // the ticket — still waiting for them to confirm (it counts meanwhile).
    step: { type: String },
    estimateMinutes: { type: Number },
    changed: { type: Boolean, default: false },
    reason: { type: String, trim: true },
    pending: { type: Boolean, default: false, index: true },
    confirmedAt: { type: Date },
    autoConfirmed: { type: Boolean, default: false },
    batch: { type: String },
    // Timer stretches replaced by the confirmed figure for the same step.
    superseded: { type: Boolean, default: false },
    // Meetings: the Weekly Calendar event; shoots: the shoot.
    meeting: { type: Schema.Types.ObjectId, ref: 'WeeklyEvent', default: null },
    shoot: { type: Schema.Types.ObjectId, ref: 'ShootSession', default: null },
    edits: [editSchema],
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

workLogSchema.index({ employee: 1, startedAt: -1 });
workLogSchema.index({ startedAt: 1 });
// At most one running timer per person.
workLogSchema.index({ employee: 1 }, { unique: true, partialFilterExpression: { endedAt: null, deleted: false } });

module.exports = model('WorkLog', workLogSchema);
