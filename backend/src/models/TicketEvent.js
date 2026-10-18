const { Schema, model } = require('mongoose');
const { TICKET_EVENT } = require('../config/constants');

// A ticket's permanent record: one entry per thing that happened — who, as
// what, when (to the second, server time), the step and colour before and
// after, and any note or changed values. Entries are only ever added: the
// hooks below refuse every update and delete, so the record can be trusted
// for analysis later. Names are copied in at the time, so the record still
// reads correctly if someone is renamed or leaves.
const changeSchema = new Schema(
  { field: { type: String, required: true }, from: { type: Schema.Types.Mixed }, to: { type: Schema.Types.Mixed } },
  { _id: false }
);

const ticketEventSchema = new Schema(
  {
    ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    type: { type: String, enum: Object.values(TICKET_EVENT), required: true },
    at: { type: Date, default: Date.now, immutable: true },

    // Null for what the system does on its own (going overdue).
    byUser: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    byEmployee: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    byName: { type: String, trim: true },
    // The post or step role they acted as ("Content Manager · ALPHA", "CEO").
    actingAs: { type: String, trim: true },
    // Set when the CEO or admin completed a step that wasn't theirs.
    onBehalfOf: { type: String, trim: true },

    fromStage: { type: String },
    toStage: { type: String },
    fromColor: { type: String },
    toColor: { type: String },
    fromLabel: { type: String },
    toLabel: { type: String },

    note: { type: String, trim: true },
    changes: [changeSchema],
    // Anything else worth keeping (the full ticket as raised, a link, …).
    meta: { type: Schema.Types.Mixed },
  },
  { versionKey: false }
);

ticketEventSchema.index({ ticket: 1, at: 1 });

function refuse() {
  throw new Error('A ticket record cannot be changed or deleted');
}
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete', 'findOneAndReplace']) {
  ticketEventSchema.pre(op, refuse);
}
ticketEventSchema.pre('save', function onlyNew() {
  if (!this.isNew) refuse();
});

module.exports = model('TicketEvent', ticketEventSchema);
