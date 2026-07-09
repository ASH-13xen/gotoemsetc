const { Schema, model } = require('mongoose');
const { INTERVIEW_STATUS } = require('../config/constants');

const interviewSchema = new Schema(
  {
    applicant: { type: Schema.Types.ObjectId, ref: 'Applicant', required: true, index: true },
    scheduledBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    scheduledAt: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(INTERVIEW_STATUS),
      default: INTERVIEW_STATUS.SCHEDULED,
    },
    notes: { type: String, trim: true },
    // Guards the daily reminder cron from sending the same reminder twice.
    reminderSentAt: { type: Date },
  },
  { timestamps: true }
);

interviewSchema.index({ applicant: 1, status: 1 });

module.exports = model('Interview', interviewSchema);
