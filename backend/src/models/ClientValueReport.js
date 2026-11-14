const { Schema, model } = require('mongoose');

// The client value report (services/clientValue.service.js) — `key: 'settings'`
// holds the margin a client must make to be "worth it"; every other document
// is one month's report, frozen when the CEO/admin closes the month, so later
// edits to time or salaries can't rewrite what that month turned out to be.
const clientValueReportSchema = new Schema(
  {
    key: { type: String, required: true, unique: true }, // 'settings' or "2026-11"
    targetMarginPct: { type: Number, default: 30 },
    closedAt: { type: Date },
    closedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    data: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = model('ClientValueReport', clientValueReportSchema);
