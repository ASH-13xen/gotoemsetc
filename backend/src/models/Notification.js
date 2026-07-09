const { Schema, model } = require('mongoose');
const { NOTIFICATION_TYPES } = require('../config/constants');

const notificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(NOTIFICATION_TYPES), required: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    applicant: { type: Schema.Types.ObjectId, ref: 'Applicant' },
    interview: { type: Schema.Types.ObjectId, ref: 'Interview' },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = model('Notification', notificationSchema);
