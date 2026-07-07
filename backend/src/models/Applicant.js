const { Schema, model } = require('mongoose');
const { APPLICANT_STATUS } = require('../config/constants');

const resumeSchema = new Schema(
  { url: String, publicId: String, originalFilename: String },
  { _id: false }
);

const applicantSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    positionAppliedFor: { type: String, trim: true },
    dateApplied: { type: Date, required: true },
    resume: resumeSchema,

    status: {
      type: String,
      enum: Object.values(APPLICANT_STATUS),
      default: APPLICANT_STATUS.APPLIED,
    },
    decisionDate: Date,
    selectionNotes: String, // why they were selected — filled when hired
    rejectionReason: String, // filled when rejected

    linkedEmployee: { type: Schema.Types.ObjectId, ref: 'Employee' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

applicantSchema.index({ firstName: 'text', lastName: 'text', email: 'text', positionAppliedFor: 'text' });

module.exports = model('Applicant', applicantSchema);
