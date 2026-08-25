const { Schema, model } = require('mongoose');

// Recipients are resolved once at creation time (a snapshot list of Employee
// ids), not a live "all active employees" query — so an employee added or
// removed later doesn't retroactively change who was actually sent an
// already-created announcement.
const announcementSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipients: [{ type: Schema.Types.ObjectId, ref: 'Employee', required: true }],
    acknowledgedBy: [
      {
        _id: false,
        employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
        acknowledgedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = model('Announcement', announcementSchema);
