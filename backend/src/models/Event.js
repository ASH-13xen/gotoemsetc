const { Schema, model } = require('mongoose');
const { EVENT_MODE, EVENT_STATUS } = require('../config/constants');

// Logged inline on the event rather than a separate collection — a small,
// display-only trail ("postponed from X to Y"), not something ever queried
// independently of its event.
const rescheduleEntrySchema = new Schema(
  {
    fromStartAt: { type: Date, required: true },
    toStartAt: { type: Date, required: true },
    note: { type: String, trim: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const eventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    // Optional — an event doesn't have to be for a CMS client.
    client: { type: Schema.Types.ObjectId, ref: 'Client' },
    mode: { type: String, enum: Object.values(EVENT_MODE), required: true },
    // Physical address for offline, meeting link for online.
    location: { type: String, trim: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date },
    coordinator: { type: Schema.Types.ObjectId, ref: 'Employee' },
    status: { type: String, enum: Object.values(EVENT_STATUS), default: EVENT_STATUS.UPCOMING },
    rescheduleHistory: [rescheduleEntrySchema],

    // Filled in by admin once the event has happened — visible to every
    // employee (events aren't access-gated the way Task Management clients
    // are).
    summary: {
      highlights: { type: String, trim: true },
      improvements: { type: String, trim: true },
      filledBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
      filledAt: { type: Date },
    },

    createdBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

eventSchema.index({ startAt: 1 });

module.exports = model('Event', eventSchema);
