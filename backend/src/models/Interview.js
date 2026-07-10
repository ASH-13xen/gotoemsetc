const { Schema, model } = require('mongoose');
const { INTERVIEW_STATUS, MEETING_TYPE } = require('../config/constants');

const interviewSchema = new Schema(
  {
    applicant: { type: Schema.Types.ObjectId, ref: 'Applicant', required: true, index: true },
    scheduledBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    scheduledAt: { type: Date, required: true },
    meetingType: { type: String, enum: Object.values(MEETING_TYPE), required: true },
    // Only one of these is normally filled, matching meetingType — kept as
    // two separate optional fields rather than one generic "details" string
    // so each has an obvious purpose in the schema itself.
    location: { type: String, trim: true },
    meetingLink: { type: String, trim: true },
    status: {
      type: String,
      enum: Object.values(INTERVIEW_STATUS),
      default: INTERVIEW_STATUS.SCHEDULED,
    },
    notes: { type: String, trim: true },
    // Guards the daily reminder cron from sending the same reminder twice.
    reminderSentAt: { type: Date },
    // Set (once) the first time this interview is rescheduled — lets the
    // frontend pick reschedule-worded message templates over the original
    // "scheduled" ones without needing a separate history table.
    rescheduledAt: { type: Date },
  },
  { timestamps: true }
);

interviewSchema.index({ applicant: 1, status: 1 });

module.exports = model('Interview', interviewSchema);
