const { Schema, model } = require('mongoose');
const { ISSUE_CATEGORIES } = require('../utils/deviceCatalog');

// A problem with a device, reported by its holder (or noted by HR) — storage
// full, an app that won't install, the Apple ID not syncing… — until HR
// resolves it. Over time it shows which devices keep having which problems.
const deviceIssueSchema = new Schema(
  {
    device: { type: Schema.Types.ObjectId, ref: 'Device', required: true, index: true },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    category: { type: String, enum: Object.keys(ISSUE_CATEGORIES), required: true },
    description: { type: String, trim: true },
    status: { type: String, enum: ['open', 'resolved'], default: 'open', index: true },
    resolution: { type: String, trim: true },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
  },
  { timestamps: true }
);

module.exports = model('DeviceIssue', deviceIssueSchema);
