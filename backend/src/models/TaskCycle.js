const { Schema, model } = require('mongoose');

// One document per client per cycle. Two kinds, matching the two shapes of
// engagement found across the real quotation templates (see
// taskCycle.service.js): 'recurring' cycles are anchored to
// Client.onboardedAt (not calendar months) and run monthly indefinitely —
// endDate is required. 'one_time' cycles back a single batch of deliverables
// spawned by one quantity/fixed-plan quotation (e.g. "4 podcasts") — they
// never close/rollover/remind, and endDate stays null.
// Bookkeeping fields here are what make the generator/reminder/rollover
// cron idempotent (mirrors Interview.reminderSentAt's guard pattern).
const taskCycleSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    // The quotation active when this cycle was created — tasks are generated
    // from THIS quotation's template, not whatever is currently on the
    // client, so a later plan change never retroactively alters an
    // already-generated (or not-yet-generated) past cycle.
    quotation: { type: Schema.Types.ObjectId, ref: 'Quotation' },
    kind: { type: String, enum: ['recurring', 'one_time'], default: 'recurring' },
    cycleNumber: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    tasksGeneratedAt: { type: Date },
    reminderSentAt: { type: Date },
    // Set once incomplete tasks in this cycle have been swept to "missed"
    // after endDate passed — guards the sweep from running more than once.
    // Never set for one_time cycles (they have no end to sweep).
    closedAt: { type: Date },
  },
  { timestamps: true }
);

taskCycleSchema.index({ client: 1, cycleNumber: 1 }, { unique: true });

module.exports = model('TaskCycle', taskCycleSchema);
