const { Schema, model } = require('mongoose');

// Freeform internal notes on a client — staff-only, never surfaced on any
// client-facing page (public quotation view, upload link, etc).
const clientNoteSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    body: { type: String, required: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

clientNoteSchema.index({ client: 1, createdAt: -1 });

module.exports = model('ClientNote', clientNoteSchema);
