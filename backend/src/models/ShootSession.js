const { Schema, model } = require('mongoose');

// A shoot: one day (and time) blocked by the Content Manager and the
// videographer, the reels shot that day — from any client — and, once done,
// each person's hours, shared across the reels by their weight
// (services/shootSession.service.js). Planning it takes each reel out of the
// shoot lineup; a reel not shot goes back with a reason.
const reelSchema = new Schema(
  {
    ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
    // Its share of the shoot's hours — equal unless the Content Manager says otherwise.
    weight: { type: Number, default: 1, min: 0 },
    status: { type: String, enum: ['planned', 'shot', 'not_shot', 'removed'], default: 'planned' },
    reason: { type: String, trim: true },
  },
  { _id: false }
);

const shootSessionSchema = new Schema(
  {
    day: { type: String, required: true, index: true }, // "2026-11-21", IST
    startMin: { type: Number, required: true }, // minutes from midnight
    endMin: { type: Number, required: true },
    location: { type: String, trim: true },
    note: { type: String, trim: true },
    people: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
    reels: [reelSchema],
    status: { type: String, enum: ['planned', 'done', 'cancelled'], default: 'planned', index: true },
    // The block on the Weekly Calendar.
    weeklyEvent: { type: Schema.Types.ObjectId, ref: 'WeeklyEvent', default: null },
    hours: [{ _id: false, employee: { type: Schema.Types.ObjectId, ref: 'Employee' }, minutes: Number }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    doneAt: Date,
    doneBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: Date,
    cancelReason: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = model('ShootSession', shootSessionSchema);
