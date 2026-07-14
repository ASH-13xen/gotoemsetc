const { Schema, model } = require('mongoose');

// One document per client per monthly cycle — cycles are anchored to
// Client.onboardedAt (not calendar months), so cycle N runs from
// onboardedAt + (N-1) months through the day before cycle N+1 starts.
// Bookkeeping fields here are what make the generator/reminder/rollover
// cron idempotent (mirrors Interview.reminderSentAt's guard pattern).
const taskCycleSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    cycleNumber: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    tasksGeneratedAt: { type: Date },
    reminderSentAt: { type: Date },
    // Set once incomplete tasks in this cycle have been swept to "missed"
    // after endDate passed — guards the sweep from running more than once.
    closedAt: { type: Date },
  },
  { timestamps: true }
);

taskCycleSchema.index({ client: 1, cycleNumber: 1 }, { unique: true });

module.exports = model('TaskCycle', taskCycleSchema);
