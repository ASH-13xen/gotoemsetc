const { Schema, model } = require('mongoose');

// One thing a person acknowledged in their Action centre (frontendall
// components/layout/ActionCentre.tsx) — `key` names the item, e.g.
// "salary:<batchId>" or "ot-cm:<requestId>". Notices acknowledged this way are
// gone for that person; things still needing their decision move to the
// centre's "Acknowledged" list until decided. Each person's own; old ones
// expire after six months, long after the item itself is settled.
const actionAckSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    key: { type: String, required: true, trim: true },
    at: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 183 },
  },
  { versionKey: false }
);

actionAckSchema.index({ user: 1, key: 1 }, { unique: true });

module.exports = model('ActionAck', actionAckSchema);
