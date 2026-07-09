const { Schema, model } = require('mongoose');
const { INTERVIEW_STATUS, DELIVERY_STATUS } = require('../config/constants');

const deliverySchema = new Schema(
  {
    status: { type: String, enum: Object.values(DELIVERY_STATUS), default: DELIVERY_STATUS.PENDING },
    error: { type: String },
  },
  { _id: false }
);

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

    // Reset to `pending` on every schedule/reschedule, then flipped to
    // sent/failed/skipped once the (backgrounded) email/WhatsApp send
    // resolves — see interview.service.js.
    email: { type: deliverySchema, default: () => ({}) },
    whatsapp: { type: deliverySchema, default: () => ({}) },
  },
  { timestamps: true }
);

interviewSchema.index({ applicant: 1, status: 1 });

module.exports = model('Interview', interviewSchema);
