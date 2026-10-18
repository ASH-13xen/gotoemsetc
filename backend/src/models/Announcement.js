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
    // Who put it aside with "Later" — it stays in their Announcements list
    // (and on the button's count) but doesn't open by itself any more.
    laterBy: [
      {
        _id: false,
        employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
        at: { type: Date, default: Date.now },
      },
    ],
    // 'general' is one HR/the CEO wrote; 'performance_flag' is the automatic
    // notice someone gets when they receive a flag (not listed with the
    // general ones on the management page).
    kind: { type: String, enum: ['general', 'performance_flag'], default: 'general' },
    flagColor: { type: String, enum: ['red', 'green', null], default: null },
  },
  { timestamps: true }
);

module.exports = model('Announcement', announcementSchema);
