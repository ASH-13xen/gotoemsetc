const { Schema, model } = require('mongoose');
const { COMPLAINT_CATEGORY, COMPLAINT_STATUS } = require('../config/constants');

// Any employee can file one (see complaint.service.js#fileComplaint) — the
// full lifecycle is timestamped end to end so a future "time to resolve"
// metric can be computed without a migration: filedAt is `createdAt`
// (schema timestamps), notifiedAt is set the instant Operations/admin are
// notified (effectively the same moment as filing today, but kept as its
// own field since it's its own step in the product spec), completedAt/
// completedBy record when Operations closes it out, and reviewedAt/feedback
// record the filer's follow-up rating.
const feedbackSchema = new Schema(
  {
    speedRating: { type: Number, min: 1, max: 5, required: true },
    qualityRating: { type: Number, min: 1, max: 5, required: true },
    comments: { type: String, trim: true },
  },
  { _id: false }
);

const complaintSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    category: { type: String, enum: Object.values(COMPLAINT_CATEGORY), required: true },
    description: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(COMPLAINT_STATUS),
      default: COMPLAINT_STATUS.PENDING,
    },
    notifiedAt: { type: Date },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    completedAt: { type: Date },
    reviewedAt: { type: Date },
    feedback: { type: feedbackSchema },
  },
  { timestamps: true }
);

complaintSchema.index({ status: 1, createdAt: -1 });

module.exports = model('Complaint', complaintSchema);
