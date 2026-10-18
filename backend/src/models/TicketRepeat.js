const { Schema, model } = require('mongoose');
const { TICKET_REPEAT } = require('../config/constants');

// A ticket that is raised again automatically — every day, week, month or
// year — until someone stops it. `input` is what the first ticket was raised
// with (title, pipeline, people…); each new copy is raised by the same person,
// at 9:00 am IST on its date, through the normal raise (so the Organisation
// chart's rule still applies), and due as far after its date as the first one
// was. See services/ticketRepeat.service.js.
const ticketRepeatSchema = new Schema(
  {
    repeat: { type: String, enum: Object.values(TICKET_REPEAT), required: true },
    raisedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    input: { type: Schema.Types.Mixed, required: true },
    // The first ticket's date (IST) — monthly/yearly keep its day of month.
    anchorDay: { type: String, required: true },
    // How far after its date each copy is due: whole days, then the time (IST).
    dueDays: { type: Number, required: true },
    dueMin: { type: Number, required: true },
    // When the next copy is raised.
    nextDay: { type: String, required: true },
    nextAt: { type: Date, required: true, index: true },
    raisedCount: { type: Number, default: 1 },
    lastTicket: { type: Schema.Types.ObjectId, ref: 'Ticket' },
    active: { type: Boolean, default: true, index: true },
    stoppedAt: { type: Date },
    stoppedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    stopReason: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = model('TicketRepeat', ticketRepeatSchema);
