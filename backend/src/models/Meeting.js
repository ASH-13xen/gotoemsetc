const { Schema, model } = require('mongoose');

const meetingSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    topic: { type: String, required: true, trim: true },
    agenda: { type: String, trim: true },
    // Minutes of meeting — only fillable once meetingDate has passed
    // (enforced in meeting.service.js), so it starts empty at scheduling time.
    mom: { type: String },
    meetingDate: { type: Date, required: true },
    // Employees are owned by the EMS side of the shared backend — referenced
    // here, not duplicated.
    attendees: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
  },
  { timestamps: true }
);

meetingSchema.index({ client: 1, meetingDate: -1 });

module.exports = model('Meeting', meetingSchema);
