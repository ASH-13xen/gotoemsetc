const { Schema, model } = require('mongoose');

// Time someone set aside on their Weekly Calendar to work on a ticket — by
// dragging it from the "Tickets to plan" tray onto the week. It is their own
// plan: nobody else sees it, it never makes them busy and it may sit over
// meetings. `kind` says what it points at: a ticket, a content-calendar item,
// or a month of daily stories (a content calendar). See
// services/ticketPlan.service.js.
const ticketPlanSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ['ticket', 'calendar', 'stories'], required: true },
    ref: { type: Schema.Types.ObjectId, required: true },
    // As it was when planned — so the block still reads right after the
    // ticket moves on.
    code: { type: String, trim: true },
    title: { type: String, trim: true },
    day: { type: String, required: true }, // YYYY-MM-DD (IST)
    startMin: { type: Number, required: true },
    endMin: { type: Number, required: true },
  },
  { timestamps: true }
);

ticketPlanSchema.index({ user: 1, day: 1 });

module.exports = model('TicketPlan', ticketPlanSchema);
