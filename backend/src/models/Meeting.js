const { Schema, model } = require('mongoose');

const meetingSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    mom: { type: String, required: true }, // minutes of meeting
    meetingDate: { type: Date, required: true },
    // Employees are owned by the EMS side of the shared backend — referenced
    // here, not duplicated.
    attendees: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
  },
  { timestamps: true }
);

meetingSchema.index({ client: 1, meetingDate: -1 });

module.exports = model('Meeting', meetingSchema);
