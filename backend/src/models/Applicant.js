const { Schema, model } = require('mongoose');
const {
  APPLICANT_STATUS,
  APPLICANT_SOURCE,
  EXPERIENCE_LEVELS,
  AVAILABILITY_OPTIONS,
  WORK_STYLE_OPTIONS,
} = require('../config/constants');

const resumeSchema = new Schema(
  { url: String, publicId: String, originalFilename: String },
  { _id: false }
);

const applicantSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    // WhatsApp number — this is the only number the recruitment form
    // collects, and it's what interview/hire/reject messages are sent to.
    phone: { type: String, trim: true },
    instagramId: { type: String, trim: true, default: 'NA' },
    experienceLevel: { type: String, enum: EXPERIENCE_LEVELS },
    hasLaptop: { type: Boolean },
    // Covers "are you from Raipur, or willing to relocate" — true means
    // they're local or have agreed to relocate.
    willingToRelocate: { type: Boolean },
    positionAppliedFor: { type: String, trim: true },
    availability: { type: String, enum: AVAILABILITY_OPTIONS },
    howDidYouFindUs: { type: String, trim: true },
    whyJoinCompany: { type: String, trim: true },
    workStylePreference: { type: String, enum: WORK_STYLE_OPTIONS },
    whyHireYou: { type: String, trim: true },
    currentSalary: { type: String, trim: true },
    expectedSalary: { type: String, trim: true },

    dateApplied: { type: Date, required: true },
    resumes: [resumeSchema],

    source: { type: String, enum: Object.values(APPLICANT_SOURCE), default: APPLICANT_SOURCE.MANUAL },
    // Google Form response id — lets the webhook safely ignore Apps Script
    // retries instead of creating duplicate applicants.
    googleFormResponseId: { type: String, index: true, unique: true, sparse: true },

    status: {
      type: String,
      enum: Object.values(APPLICANT_STATUS),
      default: APPLICANT_STATUS.PENDING,
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
